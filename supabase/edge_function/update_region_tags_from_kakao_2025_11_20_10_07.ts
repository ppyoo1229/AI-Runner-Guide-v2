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

    // 카카오맵 검증된 코스들 조회
    const { data: courses, error: fetchError } = await supabase
      .from('running_courses_2025_11_20_10_07')
      .select('*')
      .eq('kakao_verified', true)
      .not('kakao_address', 'is', null);

    if (fetchError) {
      throw new Error(`코스 조회 실패: ${fetchError.message}`);
    }

    if (!courses || courses.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: '업데이트할 코스가 없습니다.',
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

    for (const course of courses) {
      try {
        console.log(`처리 중: ${course.name} - ${course.kakao_address}`);
        
        // 주소에서 지역 태그 추출
        const addressTags = parseAddressToTags(course.kakao_address);
        
        // 기존 태그와 병합
        const existingRegionTags = course.region_tags || [];
        const existingDistrictTags = course.district_tags || [];
        const existingNeighborhoodTags = course.neighborhood_tags || [];
        
        const mergedRegionTags = mergeTags(existingRegionTags, addressTags.region_tags);
        const mergedDistrictTags = mergeTags(existingDistrictTags, addressTags.district_tags);
        const mergedNeighborhoodTags = mergeTags(existingNeighborhoodTags, addressTags.neighborhood_tags);
        
        // 업데이트 데이터 준비
        const updateData = {
          region_tags: mergedRegionTags,
          district_tags: mergedDistrictTags,
          neighborhood_tags: mergedNeighborhoodTags,
        };
        
        // city, district도 첫 번째 태그로 업데이트
        if (mergedRegionTags.length > 0) {
          updateData.city = mergedRegionTags[0];
        }
        if (mergedDistrictTags.length > 0) {
          updateData.district = mergedDistrictTags[0];
        }
        
        // 데이터베이스 업데이트
        const { error: updateError } = await supabase
          .from('running_courses_2025_11_20_10_07')
          .update(updateData)
          .eq('id', course.id);

        if (updateError) {
          console.error(`업데이트 실패 (${course.name}):`, updateError);
          failCount++;
        } else {
          console.log(`✅ 성공: ${course.name} - regions=${mergedRegionTags.length}, districts=${mergedDistrictTags.length}, neighborhoods=${mergedNeighborhoodTags.length}`);
          successCount++;
        }

        processedCount++;

      } catch (error) {
        console.error(`처리 오류 (${course.name}):`, error);
        failCount++;
        processedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `지역 태그 업데이트 완료: 총 ${processedCount}개 처리, 성공 ${successCount}개, 실패 ${failCount}개`,
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
    console.error('지역 태그 업데이트 오류:', error);
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

function parseAddressToTags(address: string) {
  const regionTags = [];
  const districtTags = [];
  const neighborhoodTags = [];

  if (!address) {
    return {
      region_tags: regionTags,
      district_tags: districtTags,
      neighborhood_tags: neighborhoodTags
    };
  }

  // 시/도 추출
  const regionPatterns = [
    { pattern: /서울특별시|서울/g, tag: '서울' },
    { pattern: /경기도|경기/g, tag: '경기' },
    { pattern: /인천광역시|인천/g, tag: '인천' },
    { pattern: /부산광역시|부산/g, tag: '부산' },
    { pattern: /대구광역시|대구/g, tag: '대구' },
    { pattern: /대전광역시|대전/g, tag: '대전' },
    { pattern: /광주광역시|광주/g, tag: '광주' },
    { pattern: /울산광역시|울산/g, tag: '울산' },
    { pattern: /세종특별자치시|세종/g, tag: '세종' },
    { pattern: /강원특별자치도|강원도/g, tag: '강원도' },
    { pattern: /충청북도|충북/g, tag: '충청북도' },
    { pattern: /충청남도|충남/g, tag: '충청남도' },
    { pattern: /전라북도|전북/g, tag: '전라북도' },
    { pattern: /전라남도|전남/g, tag: '전라남도' },
    { pattern: /경상북도|경북/g, tag: '경상북도' },
    { pattern: /경상남도|경남/g, tag: '경상남도' },
    { pattern: /제주특별자치도|제주/g, tag: '제주' },
  ];

  for (const { pattern, tag } of regionPatterns) {
    if (pattern.test(address)) {
      regionTags.push(tag);
      break;
    }
  }

  // 시/군/구 추출
  const districtMatch = address.match(/([가-힣]+(?:구|시|군))/);
  if (districtMatch) {
    districtTags.push(districtMatch[1]);
  }

  // 동 단위 추출
  const neighborhoodMatch = address.match(/([가-힣]+(?:동|리))/);
  if (neighborhoodMatch) {
    neighborhoodTags.push(neighborhoodMatch[1]);
  }

  return {
    region_tags: [...new Set(regionTags)],
    district_tags: [...new Set(districtTags)],
    neighborhood_tags: [...new Set(neighborhoodTags)]
  };
}

function mergeTags(existing: string[], newTags: string[]): string[] {
  return [...new Set([...existing, ...newTags])];
}