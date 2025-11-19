import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type, X-Application-Name',
}

interface SearchParams {
  location?: string
  distance_km?: number
  time_of_day?: string
  difficulty_level?: string
  keywords?: string[]
  user_lat?: number
  user_lng?: number
}

interface RunningCourse {
  id: string
  name: string
  description: string
  start_lat: number
  start_lng: number
  distance_km: number
  estimated_duration_minutes: number
  difficulty_level: string
  beginner_score: number
  lighting_score: number
  park_water_score: number
  tags: string[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, params } = await req.json()
    
    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let searchParams: SearchParams = {}

    // 자연어 쿼리가 있으면 파싱
    if (query) {
      console.log(`[find_running_courses] Parsing query: ${query}`)
      
      try {
        const parseResponse = await supabase.functions.invoke('parse_running_query_2025_11_19_11_13', {
          body: { query }
        })
        
        if (parseResponse.error) {
          throw new Error(`Parse function error: ${parseResponse.error.message}`)
        }
        
        searchParams = parseResponse.data
        console.log(`[find_running_courses] Parsed params:`, searchParams)
      } catch (error) {
        console.error('[find_running_courses] Parse error:', error)
        // 파싱 실패 시 기본값 사용
        searchParams = { distance_km: 3.0, difficulty_level: 'easy' }
      }
    } else if (params) {
      searchParams = params
    } else {
      return new Response(
        JSON.stringify({ error: 'Either query or params is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 위치 정보가 있으면 지오코딩 수행
    if (searchParams.location && !searchParams.user_lat) {
      try {
        const geocodeResult = await geocodeLocation(searchParams.location)
        if (geocodeResult) {
          searchParams.user_lat = geocodeResult.lat
          searchParams.user_lng = geocodeResult.lng
        }
      } catch (error) {
        console.error('[find_running_courses] Geocoding error:', error)
      }
    }

    // 데이터베이스에서 코스 검색
    const courses = await searchRunningCourses(supabase, searchParams)
    
    // 사용자 위치 기반 거리 계산 및 정렬
    if (searchParams.user_lat && searchParams.user_lng) {
      courses.forEach(course => {
        course.distance_from_user = calculateDistance(
          searchParams.user_lat!,
          searchParams.user_lng!,
          course.start_lat,
          course.start_lng
        )
      })
      
      // 거리순 정렬
      courses.sort((a, b) => (a.distance_from_user || 0) - (b.distance_from_user || 0))
    }

    // 시간대별 조명 점수 조정
    if (searchParams.time_of_day === 'night' || searchParams.time_of_day === 'evening') {
      courses.forEach(course => {
        // 야간에는 조명 점수가 높은 코스를 우선
        course.adjusted_score = course.beginner_score + (course.lighting_score * 20)
      })
      courses.sort((a, b) => (b.adjusted_score || 0) - (a.adjusted_score || 0))
    } else {
      courses.sort((a, b) => b.beginner_score - a.beginner_score)
    }

    // 상위 5개 코스만 반환
    const topCourses = courses.slice(0, 5)

    return new Response(
      JSON.stringify({
        courses: topCourses,
        search_params: searchParams,
        total_found: courses.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[find_running_courses] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function geocodeLocation(location: string): Promise<{lat: number, lng: number} | null> {
  const kakaoApiKey = Deno.env.get('KAKAO_REST_API_KEY')
  
  if (!kakaoApiKey) {
    throw new Error('KAKAO_REST_API_KEY not found')
  }

  const response = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(location)}`,
    {
      headers: {
        'Authorization': `KakaoAK ${kakaoApiKey}`
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Kakao API error: ${response.status}`)
  }

  const data = await response.json()
  
  if (data.documents && data.documents.length > 0) {
    const place = data.documents[0]
    return {
      lat: parseFloat(place.y),
      lng: parseFloat(place.x)
    }
  }

  return null
}

async function searchRunningCourses(supabase: any, params: SearchParams): Promise<RunningCourse[]> {
  let query = supabase
    .from('running_courses_2025_11_19_10_42')
    .select('*')

  // 거리 필터링
  if (params.distance_km) {
    const tolerance = 0.5 // ±0.5km 허용
    query = query
      .gte('distance_km', params.distance_km - tolerance)
      .lte('distance_km', params.distance_km + tolerance)
  }

  // 난이도 필터링
  if (params.difficulty_level) {
    query = query.eq('difficulty_level', params.difficulty_level)
  }

  // 키워드 필터링
  if (params.keywords && params.keywords.length > 0) {
    // tags 배열에서 키워드 검색
    const keywordConditions = params.keywords.map(keyword => 
      `tags.cs.{${keyword}}`
    ).join(',')
    query = query.or(keywordConditions)
  }

  const { data, error } = await query.limit(20)

  if (error) {
    console.error('Database query error:', error)
    throw new Error(`Database error: ${error.message}`)
  }

  return data || []
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