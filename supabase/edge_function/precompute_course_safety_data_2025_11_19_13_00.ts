/**
 * 사전 계산 배치 스크립트 (Edge Function 버전)
 * 
 * [참고] 새로운 데이터 정제 파이프라인:
 * - scripts/step1_normalize_course_data.py: 원본 데이터 정제
 * - scripts/step2_kakao_geocode_courses.py: 카카오맵 좌표 보정
 * - scripts/step3_load_safety_data.py: 안전데이터 적재
 * - scripts/step4_compute_course_safety_mapping.py: 코스 × 안전데이터 매핑
 * 
 * 이 Edge Function은:
 * - 이미 DB에 저장된 코스에 대해 카카오맵 정보를 업데이트할 때 사용
 * - 주기적으로 안전데이터를 재계산할 때 사용
 * - 단일 코스 또는 배치 모드로 실행 가능
 * 
 * 실행 방법:
 * 1. 모든 코스에 대해 배치로 실행: { "batch_mode": true }
 * 2. 단일 코스 업데이트: { "course_id": "uuid" }
 * 3. 주기적으로 업데이트 (예: 매일 새벽)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type, X-Application-Name',
}

interface Course {
  id: string
  name: string
  description: string | null
  start_lat: number
  start_lng: number
  distance_km: number
  polyline: string
}

interface KakaoPlaceInfo {
  place_id: string
  place_name: string
  address_name: string
  road_address_name: string | null
  category_name: string
  phone: string | null
  x: string
  y: string
}

interface SafetyData {
  lighting: {
    score: number
    lights_count: number
    density_per_km: number
    data_source: string
  }
  facilities: {
    has_parking: boolean
    has_restroom: boolean
    convenience_count: number
    available_facilities: string[]
  }
  crew_analysis: {
    is_crew_friendly: boolean
    max_group_size: number
    crew_score: number
  }
  calculated_at: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { course_id, batch_mode = false } = await req.json().catch(() => ({ course_id: null, batch_mode: false }))
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const PUBLIC_DATA_API_KEY = "OLgszcwJfXCjuy1X+Kih8aTmprkibbu70aug3deMVGtzWhoc/Ss++kbhLuBxE7Okc0Ai2zQ8xYKhtvZ3P4ARsA=="
    const kakaoApiKey = Deno.env.get('KAKAO_REST_API_KEY')

    if (!kakaoApiKey) {
      throw new Error('KAKAO_REST_API_KEY is not set')
    }

    // 배치 모드: 모든 코스 처리
    if (batch_mode) {
      const { data: courses, error } = await supabase
        .from('running_courses_2025_11_19_10_42')
        .select('id, name, description, start_lat, start_lng, distance_km, polyline')
        .order('created_at', { ascending: true })

      if (error) {
        throw error
      }

      const results = []
      for (const course of courses || []) {
        try {
          const result = await processCourse(
            course,
            PUBLIC_DATA_API_KEY,
            kakaoApiKey,
            supabase
          )
          results.push({ course_id: course.id, success: true, ...result })
          
          // API 호출 제한 방지
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          results.push({ 
            course_id: course.id, 
            success: false, 
            error: error.message 
          })
        }
      }

      return new Response(
        JSON.stringify({ 
          message: 'Batch processing completed',
          total: courses?.length || 0,
          results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 단일 코스 모드
    if (!course_id) {
      throw new Error('course_id is required when batch_mode is false')
    }

    const { data: course, error } = await supabase
      .from('running_courses_2025_11_19_10_42')
      .select('id, name, description, start_lat, start_lng, distance_km, polyline')
      .eq('id', course_id)
      .single()

    if (error || !course) {
      throw new Error(`Course not found: ${course_id}`)
    }

    const result = await processCourse(
      course,
      PUBLIC_DATA_API_KEY,
      kakaoApiKey,
      supabase
    )

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[precompute_course_safety_data] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Processing failed', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function processCourse(
  course: Course,
  publicDataApiKey: string,
  kakaoApiKey: string,
  supabase: any
) {
  console.log(`[precompute] Processing course: ${course.name} (${course.id})`)

  // 1. 카카오맵으로 코스명/정보 추출
  const kakaoInfo = await extractKakaoCourseInfo(
    course.name,
    course.start_lat,
    course.start_lng,
    kakaoApiKey
  )

  // 2. 안전데이터 매핑
  const lightingAnalysis = await analyzeLightingWithRealData(
    course.start_lat,
    course.start_lng,
    course.distance_km,
    publicDataApiKey
  )

  const facilityAnalysis = await analyzeFacilitiesWithKakao(
    course.start_lat,
    course.start_lng,
    kakaoApiKey
  )

  const crewAnalysis = analyzeCrewFriendliness(
    lightingAnalysis,
    facilityAnalysis,
    course.distance_km
  )

  // 3. SafetyData 구조 생성
  const safetyData: SafetyData = {
    lighting: {
      score: lightingAnalysis.score,
      lights_count: lightingAnalysis.lights_count,
      density_per_km: lightingAnalysis.density_per_km,
      data_source: lightingAnalysis.data_source
    },
    facilities: {
      has_parking: facilityAnalysis.has_parking,
      has_restroom: facilityAnalysis.has_restroom,
      convenience_count: facilityAnalysis.convenience_count,
      available_facilities: facilityAnalysis.available_facilities
    },
    crew_analysis: {
      is_crew_friendly: crewAnalysis.is_crew_friendly,
      max_group_size: crewAnalysis.max_group_size,
      crew_score: crewAnalysis.crew_score
    },
    calculated_at: new Date().toISOString()
  }

  // 4. 종합 점수 계산
  const safetyScore = calculateSafetyScore(lightingAnalysis, facilityAnalysis)

  // 5. DB 업데이트
  const updateData: any = {
    kakao_course_name: kakaoInfo.place_name,
    kakao_course_info: kakaoInfo,
    kakao_place_id: kakaoInfo.place_id,
    kakao_address: kakaoInfo.road_address_name || kakaoInfo.address_name,
    lighting_score: lightingAnalysis.score,
    park_water_score: safetyScore,
    crew_friendly: crewAnalysis.is_crew_friendly,
    max_group_size: crewAnalysis.max_group_size,
    parking_available: facilityAnalysis.has_parking,
    facilities: facilityAnalysis.available_facilities,
    safety_data: safetyData,
    updated_at: new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from('running_courses_2025_11_19_10_42')
    .update(updateData)
    .eq('id', course.id)

  if (updateError) {
    throw updateError
  }

  return {
    course_id: course.id,
    kakao_info: kakaoInfo,
    safety_data: safetyData
  }
}

async function extractKakaoCourseInfo(
  courseName: string,
  lat: number,
  lng: number,
  apiKey: string
): Promise<KakaoPlaceInfo> {
  try {
    // 카카오맵 키워드 검색으로 코스 정보 추출
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(courseName)}&x=${lng}&y=${lat}&radius=2000&size=1`
    
    const response = await fetch(url, {
      headers: { 'Authorization': `KakaoAK ${apiKey}` }
    })

    if (!response.ok) {
      throw new Error(`Kakao API error: ${response.status}`)
    }

    const data = await response.json()
    const documents = data.documents || []

    if (documents.length === 0) {
      // 검색 결과가 없으면 기본값 반환
      return {
        place_id: '',
        place_name: courseName,
        address_name: '',
        road_address_name: null,
        category_name: '',
        phone: null,
        x: lng.toString(),
        y: lat.toString()
      }
    }

    const doc = documents[0]
    return {
      place_id: doc.id || '',
      place_name: doc.place_name || courseName,
      address_name: doc.address_name || '',
      road_address_name: doc.road_address_name || null,
      category_name: doc.category_name || '',
      phone: doc.phone || null,
      x: doc.x || lng.toString(),
      y: doc.y || lat.toString()
    }
  } catch (error) {
    console.error('Kakao course info extraction error:', error)
    // 에러 시 기본값 반환
    return {
      place_id: '',
      place_name: courseName,
      address_name: '',
      road_address_name: null,
      category_name: '',
      phone: null,
      x: lng.toString(),
      y: lat.toString()
    }
  }
}

async function analyzeLightingWithRealData(
  lat: number,
  lng: number,
  distance_km: number,
  apiKey: string
) {
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

