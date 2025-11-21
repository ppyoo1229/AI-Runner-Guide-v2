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
    const { parsed } = await req.json();
    
    if (!parsed) {
      throw new Error('파싱된 쿼리가 필요합니다');
    }

    // Supabase 클라이언트 생성
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 코스 검색
    const courses = await searchCourses(supabase, parsed);
    
    // 각 코스에 안전 정보 추가
    const coursesWithSafety = await Promise.all(
      courses.map(async (course) => {
        const safetyInfo = await calculateSafetyInfo(supabase, course);
        return {
          ...course,
          safetyInfo
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        courses: coursesWithSafety,
        total: coursesWithSafety.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('검색 오류:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function searchCourses(supabase: any, parsed: any) {
  let query = supabase
    .from('running_courses_2025_11_20_10_07')
    .select('*');

  // 1. 지역 필터링 (정확한 매칭)
  if (parsed.region) {
    // region_tags 배열에서 해당 지역 포함 여부 확인
    query = query.contains('region_tags', [parsed.region]);
  }

  if (parsed.district) {
    // district_tags 배열에서 해당 구/시 포함 여부 확인
    query = query.contains('district_tags', [parsed.district]);
  }

  if (parsed.neighborhood) {
    // neighborhood_tags 배열에서 해당 동 포함 여부 확인
    query = query.contains('neighborhood_tags', [parsed.neighborhood]);
  }

  // 2. 거리 필터링
  if (parsed.distance) {
    const tolerance = 1.0; // ±1km 허용
    query = query
      .gte('distance_km', parsed.distance - tolerance)
      .lte('distance_km', parsed.distance + tolerance);
  }

  // 3. 시간 필터링 (분 단위)
  if (parsed.duration) {
    const tolerance = 10; // ±10분 허용
    query = query
      .gte('estimated_duration_minutes', parsed.duration - tolerance)
      .lte('estimated_duration_minutes', parsed.duration + tolerance);
  }

  // 4. 코스 유형 필터링
  if (parsed.courseType) {
    query = query.eq('course_type', parsed.courseType);
  }

  // 5. 특수 조건 필터링
  if (parsed.isGroupRunning) {
    query = query.contains('natural_tags', ['크루러닝']);
  }

  if (parsed.isNightRunning) {
    query = query.contains('natural_tags', ['야간가능']);
  }

  // 6. 난이도 필터링
  if (parsed.difficulty === 'easy') {
    query = query.eq('has_uphill', false);
  } else if (parsed.difficulty === 'hard') {
    query = query.eq('has_uphill', true);
  }

  // 7. 키워드 검색 (코스명, 설명에서)
  if (parsed.location && !parsed.region) {
    // 지역이 파싱되지 않은 경우 텍스트 검색
    query = query.or(`name.ilike.%${parsed.location}%,description.ilike.%${parsed.location}%`);
  }

  // 8. 정렬 (추천도 기준)
  query = query.order('id', { ascending: true });

  // 9. 제한 (최대 20개)
  query = query.limit(20);

  const { data, error } = await query;

  if (error) {
    console.error('코스 검색 오류:', error);
    throw new Error('코스 검색에 실패했습니다');
  }

  return data || [];
}

async function calculateSafetyInfo(supabase: any, course: any) {
  try {
    // 코스 중심 좌표 기준 반경 2km 내 안전 데이터 조회
    const { data: safetyPoints, error } = await supabase
      .from('safety_points_2025_11_20_10_07')
      .select('*')
      .gte('latitude', course.start_lat - 0.018) // 약 2km
      .lte('latitude', course.start_lat + 0.018)
      .gte('longitude', course.start_lng - 0.018)
      .lte('longitude', course.start_lng + 0.018);

    if (error || !safetyPoints) {
      console.log('안전 데이터 조회 실패:', error);
      return null;
    }

    // 정확한 거리 계산으로 필터링
    const nearbyPoints = safetyPoints.filter(point => {
      const distance = calculateDistance(
        course.start_lat, course.start_lng,
        point.latitude, point.longitude
      );
      return distance <= 2.0; // 2km 이내
    });

    if (nearbyPoints.length === 0) {
      return null;
    }

    // 안전 정보 계산
    const streetLights = nearbyPoints.filter(p => p.data_source === 'street_light').length;
    const securityLights = nearbyPoints.filter(p => p.data_source === 'security_light').length;
    const totalLights = streetLights + securityLights;
    
    // 조명 밀도 (개/km)
    const lightDensity = Math.round(totalLights / Math.max(course.distance_km, 0.5));
    
    // 안전 레벨 계산
    let safetyLevel = 'low';
    if (lightDensity >= 15) {
      safetyLevel = 'high';
    } else if (lightDensity >= 8) {
      safetyLevel = 'medium';
    }

    // 야간 안전성 (조명 밀도 기준)
    const isNightSafe = lightDensity >= 10;
    
    // 그룹 러닝 친화성 (코스 길이와 안전성 기준)
    const isGroupFriendly = course.distance_km >= 2.0 && lightDensity >= 5;

    // 시설 정보 (임시 - 실제로는 별도 데이터 필요)
    const facilities = [];
    if (course.natural_tags?.includes('공원')) {
      facilities.push('화장실', '주차장');
    }
    if (course.natural_tags?.includes('트랙')) {
      facilities.push('주차장');
    }
    if (course.course_type === '하천') {
      facilities.push('화장실');
    }

    return {
      safetyLevel,
      totalLights,
      streetLights,
      securityLights,
      lightDensity,
      isNightSafe,
      isGroupFriendly,
      facilities,
      nearbyPointsCount: nearbyPoints.length
    };

  } catch (error) {
    console.error('안전 정보 계산 오류:', error);
    return null;
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}