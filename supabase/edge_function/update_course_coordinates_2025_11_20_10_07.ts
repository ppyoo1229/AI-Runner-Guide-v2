import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type, X-Application-Name',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Supabase 클라이언트 생성
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 카카오맵 API 키 가져오기
    const kakaoApiKey = Deno.env.get('KAKAO_REST_API_KEY');
    if (!kakaoApiKey) {
      throw new Error('KAKAO_REST_API_KEY가 설정되지 않았습니다');
    }

    // 모든 코스 조회
    const { data: courses, error: fetchError } = await supabase
      .from('running_courses_2025_11_20_10_07')
      .select('*')
      .is('kakao_verified', null); // 아직 카카오맵으로 검증되지 않은 코스만

    if (fetchError) {
      throw new Error(`코스 조회 실패: ${fetchError.message}`);
    }

    if (!courses || courses.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: '업데이트할 코스가 없습니다. 모든 코스가 이미 검증되었습니다.',
          processedCount: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let processedCount = 0;
    let successCount = 0;
    let failCount = 0;

    // 배치 처리 (API 제한 고려)
    for (const course of courses) {
      try {
        console.log(`처리 중: ${course.name} (${course.city} ${course.district})`);
        
        // 카카오맵 API로 좌표 검색
        const kakaoResult = await searchKakaoPlace(course.name, course.city, course.district, kakaoApiKey);
        
        if (kakaoResult) {
          // 코스 정보 업데이트
          const { error: updateError } = await supabase
            .from('running_courses_2025_11_20_10_07')
            .update({
              start_lat: kakaoResult.y,
              start_lng: kakaoResult.x,
              kakao_place_name: kakaoResult.place_name,
              kakao_address: kakaoResult.road_address_name || kakaoResult.address_name,
              kakao_place_id: kakaoResult.place_id,
              kakao_verified: true,
              kakao_verified_at: new Date().toISOString()
            })
            .eq('id', course.id);

          if (updateError) {
            console.error(`업데이트 실패 (${course.name}):`, updateError);
            failCount++;
          } else {
            console.log(`✅ 성공: ${course.name} -> ${kakaoResult.place_name}`);
            successCount++;
          }
        } else {
          console.log(`⚠️ 검색 결과 없음: ${course.name}`);
          failCount++;
        }

        processedCount++;

        // API 제한 방지 (1.2초 대기)
        await new Promise(resolve => setTimeout(resolve, 1200));

      } catch (error) {
        console.error(`처리 오류 (${course.name}):`, error);
        failCount++;
        processedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `좌표 매핑 완료: 총 ${processedCount}개 처리, 성공 ${successCount}개, 실패 ${failCount}개`,
        totalCourses: courses.length,
        processedCount,
        successCount,
        failCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('좌표 매핑 오류:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function searchKakaoPlace(courseName: string, city: string, district: string, apiKey: string) {
  const url = "https://dapi.kakao.com/v2/local/search/keyword.json";
  
  // 검색 쿼리 구성
  const queryItems = [courseName];
  if (city && city.trim()) {
    queryItems.push(city.trim());
  }
  if (district && district.trim()) {
    queryItems.push(district.trim());
  }
  
  const query = queryItems.join(' ').trim();
  
  const headers = {
    "Authorization": `KakaoAK ${apiKey}`,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  const params = new URLSearchParams({
    query: query,
    size: '1',
    page: '1'
  });

  try {
    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      console.error(`카카오 API 오류 (${response.status}): ${await response.text()}`);
      return null;
    }

    const data = await response.json();
    const documents = data.documents || [];

    if (documents.length === 0) {
      // 지역명 없이 재시도 (코스명만으로 검색)
      const retryParams = new URLSearchParams({
        query: courseName.trim(),
        size: '1',
        page: '1'
      });

      const retryResponse = await fetch(`${url}?${retryParams}`, {
        method: 'GET',
        headers: headers
      });

      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        const retryDocuments = retryData.documents || [];
        
        if (retryDocuments.length > 0) {
          const doc = retryDocuments[0];
          return {
            place_id: doc.id || "",
            place_name: doc.place_name || courseName,
            address_name: doc.address_name || "",
            road_address_name: doc.road_address_name || "",
            category_name: doc.category_name || "",
            x: parseFloat(doc.x || 0), // 경도
            y: parseFloat(doc.y || 0), // 위도
            phone: doc.phone || "",
          };
        }
      }
      
      return null;
    }

    const doc = documents[0];
    return {
      place_id: doc.id || "",
      place_name: doc.place_name || courseName,
      address_name: doc.address_name || "",
      road_address_name: doc.road_address_name || "",
      category_name: doc.category_name || "",
      x: parseFloat(doc.x || 0), // 경도
      y: parseFloat(doc.y || 0), // 위도
      phone: doc.phone || "",
    };

  } catch (error) {
    console.error(`카카오맵 검색 실패 (${courseName}):`, error);
    return null;
  }
}