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

    // 모든 코스 조회
    const { data: courses, error: fetchError } = await supabase
      .from('running_courses_2025_11_20_10_07')
      .select('id, name, start_lat, start_lng, distance_km')
      .not('start_lat', 'is', null)
      .not('start_lng', 'is', null);

    if (fetchError) {
      throw new Error(`코스 조회 실패: ${fetchError.message}`);
    }

    if (!courses || courses.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: '처리할 코스가 없습니다.',
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
        console.log(`처리 중: ${course.name}`);
        
        // 반경 3km 내 안전데이터 조회
        const safetyPoints = await getNearbySafetyPoints(
          supabase,
          course.start_lat,
          course.start_lng,
          3.0 // 3km 반경
        );
        
        console.log(`${safetyPoints.length}개의 안전 포인트 발견`);
        
        // 안전 점수 계산
        const safetyScores = computeSafetyScores(safetyPoints, course.distance_km || 3.0);
        
        // DB 업데이트
        const { error: updateError } = await supabase
          .from('running_courses_2025_11_20_10_07')
          .update(safetyScores)
          .eq('id', course.id);

        if (updateError) {
          console.error(`업데이트 실패 (${course.name}):`, updateError);
          failCount++;
        } else {
          console.log(`✅ 계산 완료: weight=${safetyScores.recommendation_weight}`);
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
        message: `안전 점수 계산 완료: 총 ${processedCount}개 처리, 성공 ${successCount}개, 실패 ${failCount}개`,
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
    console.error('안전 점수 계산 오류:', error);
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

async function getNearbySafetyPoints(supabase: any, centerLat: number, centerLng: number, radiusKm: number) {
  // 대략적인 위도/경도 범위 계산
  const latDelta = radiusKm / 111.0; // 1도 ≈ 111km
  const lngDelta = radiusKm / (111.0 * Math.cos(centerLat * Math.PI / 180));

  // Supabase에서 범위 내 데이터 조회
  const { data: points, error } = await supabase
    .from('safety_points_2025_11_20_10_07')
    .select('*')
    .gte('latitude', centerLat - latDelta)
    .lte('latitude', centerLat + latDelta)
    .gte('longitude', centerLng - lngDelta)
    .lte('longitude', centerLng + lngDelta);

  if (error || !points) {
    console.error('안전데이터 조회 오류:', error);
    return [];
  }

  // 정확한 거리 계산으로 필터링
  const nearbyPoints = [];
  for (const point of points) {
    const distance = calculateDistance(
      centerLat, centerLng,
      point.latitude, point.longitude
    );
    if (distance <= radiusKm) {
      nearbyPoints.push({
        ...point,
        distance_km: distance
      });
    }
  }

  return nearbyPoints;
}

function computeSafetyScores(safetyPoints: any[], courseLengthKm: number) {
  if (!safetyPoints || safetyPoints.length === 0) {
    return {
      safe_light_score: 0.0,
      safe_area_score: 0.0,
      avg_light_density: 0.0,
      avg_crime_index: 0.0,
      recommendation_weight: 0.0,
    };
  }

  // 조명 관련 포인트만 필터링
  const lightPoints = safetyPoints.filter(
    p => p.data_source === 'street_light' || p.data_source === 'security_light'
  );

  // 안전 점수 계산
  const safetyScores = safetyPoints.map(p => parseFloat(p.safety_score || 0));
  const avgSafetyScore = safetyScores.length > 0 ? 
    safetyScores.reduce((a, b) => a + b, 0) / safetyScores.length : 0.0;
  const maxSafetyScore = safetyScores.length > 0 ? Math.max(...safetyScores) : 0.0;

  // 조명 밀도 계산 (개/km)
  const lightDensity = lightPoints.length / Math.max(courseLengthKm, 0.5);

  // 조명 점수 (0~100)
  const safeLightScore = Math.min(100.0, 
    avgSafetyScore * (lightPoints.length / Math.max(safetyPoints.length, 1))
  );

  // 지역 안전 점수 (0~100)
  const safeAreaScore = Math.min(100.0, avgSafetyScore);

  // 평균 조명 밀도
  const avgLightDensity = lightDensity;

  // 범죄 지수 (안전 점수의 역수, 낮을수록 좋음)
  const avgCrimeIndex = Math.max(0.0, 100.0 - avgSafetyScore);

  // 추천 가중치 (종합 점수)
  const recommendationWeight = (
    safeLightScore * 0.4 +
    safeAreaScore * 0.3 +
    (100.0 - avgCrimeIndex) * 0.2 +
    Math.min(100.0, avgLightDensity * 5) * 0.1  // 밀도가 높을수록 좋음
  );

  return {
    safe_light_score: Math.round(safeLightScore * 100) / 100,
    safe_area_score: Math.round(safeAreaScore * 100) / 100,
    avg_light_density: Math.round(avgLightDensity * 100) / 100,
    avg_crime_index: Math.round(avgCrimeIndex * 100) / 100,
    recommendation_weight: Math.round(recommendationWeight * 100) / 100,
  };
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