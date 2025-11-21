import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type, X-Application-Name',
};

interface SearchParams {
  location?: string;
  distance?: number;
  duration?: number;
  keywords?: string[];
  courseType?: string;
  city?: string;
}

interface SafetyInfo {
  streetLights: number;
  securityLights: number;
  totalLights: number;
  lightDensity: number;
  safetyLevel: 'high' | 'medium' | 'low';
  facilities: string[];
  isNightSafe: boolean;
  isGroupFriendly: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { searchParams } = await req.json();
    
    if (!searchParams) {
      return new Response(
        JSON.stringify({ error: '검색 파라미터가 필요합니다.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 러닝코스 검색
    const courses = await searchRunningCourses(supabase, searchParams);
    
    // 각 코스에 대한 안전정보 추가
    const coursesWithSafety = await Promise.all(
      courses.map(async (course) => {
        const safetyInfo = await getSafetyInfo(supabase, course);
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
        total: coursesWithSafety.length,
        searchParams
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('코스 검색 오류:', error);
    return new Response(
      JSON.stringify({ 
        error: '코스 검색 중 오류가 발생했습니다.',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function searchRunningCourses(supabase: any, params: SearchParams) {
  let query = supabase
    .from('running_courses_2025_11_20_10_07')
    .select('*');

  // 위치 필터링
  if (params.location) {
    query = query.or(`city.ilike.%${params.location}%,district.ilike.%${params.location}%,name.ilike.%${params.location}%`);
  }

  // 도시 필터링
  if (params.city) {
    query = query.eq('city', params.city);
  }

  // 거리 필터링 (±20% 범위)
  if (params.distance) {
    const minDistance = params.distance * 0.8;
    const maxDistance = params.distance * 1.2;
    query = query.gte('distance_km', minDistance).lte('distance_km', maxDistance);
  }

  // 시간 필터링 (±20% 범위)
  if (params.duration) {
    const minDuration = params.duration * 0.8;
    const maxDuration = params.duration * 1.2;
    query = query.gte('estimated_duration_minutes', minDuration).lte('estimated_duration_minutes', maxDuration);
  }

  // 코스 유형 필터링
  if (params.courseType) {
    query = query.eq('course_type', params.courseType);
  }

  // 키워드 필터링
  if (params.keywords && params.keywords.length > 0) {
    for (const keyword of params.keywords) {
      if (keyword === '업힐') {
        query = query.eq('has_uphill', true);
      } else if (keyword === '야간가능') {
        query = query.contains('natural_tags', [keyword]);
      } else if (['공원', '하천', '트랙'].includes(keyword)) {
        query = query.eq('course_type', keyword);
      }
    }
  }

  // 결과 정렬 (거리 기준)
  query = query.order('distance_km', { ascending: true }).limit(20);

  const { data, error } = await query;
  
  if (error) {
    console.error('코스 검색 쿼리 오류:', error);
    throw error;
  }

  return data || [];
}

async function getSafetyInfo(supabase: any, course: any): Promise<SafetyInfo> {
  try {
    // 코스 중심 좌표 기준 반경 1km 내 안전데이터 조회
    const { data: safetyPoints, error } = await supabase
      .from('safety_points_2025_11_20_10_07')
      .select('*')
      .gte('latitude', course.start_lat - 0.009) // 약 1km
      .lte('latitude', course.start_lat + 0.009)
      .gte('longitude', course.start_lng - 0.009)
      .lte('longitude', course.start_lng + 0.009);

    if (error) {
      console.error('안전데이터 조회 오류:', error);
    }

    const points = safetyPoints || [];
    
    // 가로등/보안등 개수 계산
    const streetLights = points.filter(p => p.data_source === 'street_light').length;
    const securityLights = points.filter(p => p.data_source === 'security_light').length;
    const totalLights = streetLights + securityLights;
    
    // 조명 밀도 계산 (개/km)
    const lightDensity = course.distance_km > 0 ? totalLights / course.distance_km : 0;
    
    // 안전 레벨 결정
    let safetyLevel: 'high' | 'medium' | 'low' = 'low';
    if (lightDensity >= 10) {
      safetyLevel = 'high';
    } else if (lightDensity >= 5) {
      safetyLevel = 'medium';
    }

    // 시설물 정보 (태그 기반)
    const facilities = [];
    const tags = course.natural_tags || [];
    
    if (tags.includes('공원')) facilities.push('공원시설');
    if (tags.includes('트랙')) facilities.push('운동시설');
    if (tags.includes('한강')) facilities.push('편의시설');
    if (course.course_type === '공원') facilities.push('화장실', '주차장');
    if (course.course_type === '트랙') facilities.push('운동장', '샤워실');
    if (course.course_type === '하천') facilities.push('산책로', '자전거도로');

    // 야간 안전성 (조명 밀도 기준)
    const isNightSafe = lightDensity >= 5;
    
    // 그룹 러닝 친화성 (공원, 트랙, 넓은 코스)
    const isGroupFriendly = 
      course.course_type === '공원' || 
      course.course_type === '트랙' || 
      course.distance_km >= 3;

    return {
      streetLights,
      securityLights,
      totalLights,
      lightDensity: Math.round(lightDensity * 10) / 10,
      safetyLevel,
      facilities,
      isNightSafe,
      isGroupFriendly
    };

  } catch (error) {
    console.error('안전정보 계산 오류:', error);
    return {
      streetLights: 0,
      securityLights: 0,
      totalLights: 0,
      lightDensity: 0,
      safetyLevel: 'low',
      facilities: [],
      isNightSafe: false,
      isGroupFriendly: false
    };
  }
}