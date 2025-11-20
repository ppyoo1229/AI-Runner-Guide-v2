/**
 * @deprecated 이 파일은 더 이상 사용되지 않습니다.
 * 대신 precompute_course_safety_data_2025_11_19_13_00.ts를 사용하세요.
 * 
 * 사전 계산된 안전데이터를 읽어오려면 DB에서 직접 조회하거나,
 * 새로운 precompute 스크립트를 사용하여 배치로 계산하세요.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type, X-Application-Name',
}

interface CourseAnalysis {
  course_id: string
  lighting_score: number
  safety_score: number
  crew_friendly: boolean
  max_group_size: number
  facilities: string[]
  analysis_details: {
    nearby_lights_count: number
    light_density_per_km: number
    parking_available: boolean
    restroom_nearby: boolean
    convenience_stores: number
    path_width_estimated: number
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 사전 계산된 데이터를 DB에서 읽어오기
    const { course_id } = await req.json()
    
    if (!course_id) {
      throw new Error('course_id is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: course, error } = await supabase
      .from('running_courses_2025_11_19_10_42')
      .select('id, name, lighting_score, park_water_score, crew_friendly, max_group_size, facilities, safety_data')
      .eq('id', course_id)
      .single()

    if (error || !course) {
      throw new Error(`Course not found: ${course_id}`)
    }

    // 사전 계산된 데이터 반환
    const analysis = {
      course_id: course.id,
      lighting_score: course.lighting_score || 0.5,
      safety_score: course.park_water_score || 0.5,
      crew_friendly: course.crew_friendly || false,
      max_group_size: course.max_group_size || 5,
      facilities: course.facilities || [],
      analysis_details: course.safety_data?.lighting || {
        nearby_lights_count: 0,
        light_density_per_km: 0,
        parking_available: course.parking_available || false,
        restroom_nearby: course.facilities?.includes('화장실') || false,
        convenience_stores: course.safety_data?.facilities?.convenience_count || 0,
        path_width_estimated: 2.5
      }
    }

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

    /* 기존 실시간 계산 코드 (deprecated)
    const { course_id, course_name, start_lat, start_lng, distance_km, coordinates } = await req.json()
    
    console.log(`[analyze_course_real_data] Analyzing course: ${course_name}`)

    // 기존 실시간 계산 코드는 제거됨
    // 사전 계산은 precompute_course_safety_data_2025_11_19_13_00.ts를 사용하세요
    */

  } catch (error) {
    console.error('[analyze_course_real_data] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Analysis failed', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function analyzeLightingWithRealData(lat: number, lng: number, distance_km: number, apiKey: string) {
  try {
    // 전국 스마트가로등 표준데이터 API 호출
    const smartLightsUrl = `https://api.odcloud.kr/api/15064665/v1/uddi:d19c8e21-4445-43fe-9b2e-d0b5b6c7e8f1?page=1&perPage=1000&serviceKey=${apiKey}`
    
    // 전국 보안등정보 표준데이터 API 호출  
    const securityLightsUrl = `https://api.odcloud.kr/api/15118519/v1/uddi:b8c5c4a2-3d4e-4f5a-8b9c-1e2f3a4b5c6d?page=1&perPage=1000&serviceKey=${apiKey}`

    const [smartResponse, securityResponse] = await Promise.all([
      fetch(smartLightsUrl).catch(() => null),
      fetch(securityLightsUrl).catch(() => null)
    ])

    let totalLights = 0
    let nearbyLights = 0

    // 스마트가로등 데이터 처리
    if (smartResponse && smartResponse.ok) {
      const smartData = await smartResponse.json()
      if (smartData.data) {
        nearbyLights += countNearbyLights(smartData.data, lat, lng, 0.5) // 500m 반경
        totalLights += smartData.data.length
      }
    }

    // 보안등 데이터 처리
    if (securityResponse && securityResponse.ok) {
      const securityData = await securityResponse.json()
      if (securityData.data) {
        nearbyLights += countNearbyLights(securityData.data, lat, lng, 0.5)
        totalLights += securityData.data.length
      }
    }

    // 조명 밀도 계산 (개/km)
    const densityPerKm = nearbyLights / Math.max(distance_km, 0.5)
    
    // 조명 점수 계산 (0.0 ~ 1.0)
    let lightingScore = 0.1 // 기본값
    if (densityPerKm >= 20) lightingScore = 1.0      // 완벽
    else if (densityPerKm >= 15) lightingScore = 0.9  // 매우 좋음
    else if (densityPerKm >= 10) lightingScore = 0.7  // 좋음
    else if (densityPerKm >= 5) lightingScore = 0.5   // 보통
    else if (densityPerKm >= 2) lightingScore = 0.3   // 부족

    return {
      score: lightingScore,
      lights_count: nearbyLights,
      density_per_km: densityPerKm,
      data_source: totalLights > 0 ? 'real_data' : 'estimated'
    }

  } catch (error) {
    console.error('Lighting analysis error:', error)
    // 실패시 기존 추정값 사용
    return {
      score: 0.6, // 기본 추정값
      lights_count: 0,
      density_per_km: 0,
      data_source: 'fallback_estimated'
    }
  }
}

async function analyzeFacilitiesWithKakao(lat: number, lng: number, apiKey: string) {
  const facilities = {
    has_parking: false,
    has_restroom: false,
    convenience_count: 0,
    available_facilities: [] as string[]
  }

  if (!apiKey) {
    return facilities
  }

  try {
    // 주변 1km 내 시설 검색
    const searches = [
      { keyword: '주차장', category: 'parking' },
      { keyword: '화장실', category: 'restroom' },
      { keyword: '편의점', category: 'convenience' },
      { keyword: '카페', category: 'cafe' },
      { keyword: '음수대', category: 'water' }
    ]

    for (const search of searches) {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(search.keyword)}&x=${lng}&y=${lat}&radius=1000`
      
      const response = await fetch(url, {
        headers: { 'Authorization': `KakaoAK ${apiKey}` }
      })

      if (response.ok) {
        const data = await response.json()
        const count = data.documents?.length || 0

        if (count > 0) {
          switch (search.category) {
            case 'parking':
              facilities.has_parking = true
              facilities.available_facilities.push('주차장')
              break
            case 'restroom':
              facilities.has_restroom = true
              facilities.available_facilities.push('화장실')
              break
            case 'convenience':
              facilities.convenience_count = count
              if (count > 0) facilities.available_facilities.push('편의점')
              break
            case 'cafe':
              if (count > 0) facilities.available_facilities.push('카페')
              break
            case 'water':
              if (count > 0) facilities.available_facilities.push('음수대')
              break
          }
        }
      }

      // API 호출 제한 방지
      await new Promise(resolve => setTimeout(resolve, 100))
    }

  } catch (error) {
    console.error('Facility analysis error:', error)
  }

  return facilities
}

function analyzeCrewFriendliness(lightingData: any, facilityData: any, distance_km: number) {
  let crewScore = 0
  let maxGroupSize = 5 // 기본값

  // 크루 친화성 점수 계산
  if (facilityData.has_parking) crewScore += 25        // 주차장 필수
  if (facilityData.has_restroom) crewScore += 20       // 화장실 중요
  if (facilityData.convenience_count > 0) crewScore += 15  // 편의점
  if (lightingData.score >= 0.7) crewScore += 20      // 조명 좋음
  if (distance_km >= 3) crewScore += 10                // 충분한 거리
  if (facilityData.available_facilities.length >= 3) crewScore += 10 // 다양한 시설

  // 그룹 크기 결정
  if (crewScore >= 80) maxGroupSize = 30      // 완벽한 조건
  else if (crewScore >= 60) maxGroupSize = 20  // 좋은 조건
  else if (crewScore >= 40) maxGroupSize = 15  // 보통 조건
  else if (crewScore >= 20) maxGroupSize = 10  // 기본 조건

  return {
    is_crew_friendly: crewScore >= 40, // 40점 이상이면 크루 친화적
    max_group_size: maxGroupSize,
    crew_score: crewScore
  }
}

function calculateSafetyScore(lightingData: any, facilityData: any): number {
  let safetyScore = 0.3 // 기본값

  // 조명 점수 반영 (50%)
  safetyScore += lightingData.score * 0.5

  // 시설 점수 반영 (30%)
  const facilityScore = Math.min(facilityData.available_facilities.length / 5, 1)
  safetyScore += facilityScore * 0.3

  // 편의점 밀도 반영 (20%)
  const convenienceScore = Math.min(facilityData.convenience_count / 3, 1)
  safetyScore += convenienceScore * 0.2

  return Math.min(safetyScore, 1.0)
}

function countNearbyLights(lights: any[], targetLat: number, targetLng: number, radiusKm: number): number {
  return lights.filter(light => {
    const lightLat = parseFloat(light.위도 || light.latitude || 0)
    const lightLng = parseFloat(light.경도 || light.longitude || 0)
    
    if (!lightLat || !lightLng) return false
    
    const distance = calculateDistance(targetLat, targetLng, lightLat, lightLng)
    return distance <= radiusKm
  }).length
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

function estimatePathWidth(courseName: string, distance: number): number {
  // 코스명과 거리로 도로폭 추정
  if (courseName.includes('한강') || courseName.includes('공원')) return 4
  if (courseName.includes('둘레길') || courseName.includes('산책로')) return 3
  if (courseName.includes('도심') || courseName.includes('청계천')) return 2.5
  if (distance >= 5) return 3.5 // 장거리 코스는 보통 넓음
  return 2.5 // 기본값
}