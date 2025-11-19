import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type, X-Application-Name',
}

interface ParsedParams {
  location?: string
  distance_km?: number
  time_of_day?: string
  difficulty_level?: string
  keywords?: string[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query } = await req.json()
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required and must be a string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[parse_running_query] Processing query: ${query}`)

    // LLM 서버 URL 가져오기
    const hfTgiUrl = Deno.env.get('HF_TGI_URL')
    
    let parsedParams: ParsedParams = {}

    if (hfTgiUrl) {
      // LLM을 사용한 파싱 시도
      try {
        parsedParams = await parseWithLLM(query, hfTgiUrl)
        console.log('[parse_running_query] LLM parsing successful')
      } catch (error) {
        console.log(`[parse_running_query] LLM parsing failed, using fallback: ${error.message}`)
        parsedParams = parseWithFallback(query)
      }
    } else {
      // Fallback 파싱 사용
      console.log('[parse_running_query] Using fallback parsing (no LLM server)')
      parsedParams = parseWithFallback(query)
    }

    return new Response(
      JSON.stringify(parsedParams),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[parse_running_query] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function parseWithLLM(query: string, hfTgiUrl: string): Promise<ParsedParams> {
  const prompt = `다음 러닝 관련 질문을 분석하여 JSON 형태로 파라미터를 추출해주세요.

질문: "${query}"

다음 형식으로 응답해주세요:
{
  "location": "위치명 (예: 강남역, 한강공원 등, 없으면 null)",
  "distance_km": 거리_킬로미터_숫자 (예: 3.0, 없으면 null),
  "time_of_day": "시간대 (morning/afternoon/evening/night 중 하나, 없으면 null)",
  "difficulty_level": "난이도 (easy/medium/hard 중 하나, 초보자면 easy, 없으면 null)",
  "crew_size": 크루_인원수_숫자 (예: 10, 크루/그룹 언급시, 없으면 null),
  "crew_friendly": 크루러닝_여부_불린 (크루/그룹 언급시 true, 없으면 false),
  "keywords": ["관련", "키워드", "배열"]
}

JSON만 응답하세요:`

  const response = await fetch(`${hfTgiUrl}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 200,
        temperature: 0.1,
        do_sample: false,
      }
    })
  })

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status}`)
  }

  const result = await response.json()
  const generatedText = result.generated_text || result.outputs?.[0]?.text || ''
  
  // JSON 추출 시도
  const jsonMatch = generatedText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  
  throw new Error('Failed to extract JSON from LLM response')
}

function parseWithFallback(query: string): ParsedParams {
  const params: ParsedParams = {
    keywords: ['공원', '하천', '산책로', '운동장', '트랙'],
    crew_friendly: false
  }

  // 크루 러닝 정보 추출
  const crewMatch = query.match(/(\d+)\s*명|크루|그룹|팀|러닝\s*모임/i)
  if (crewMatch) {
    params.crew_friendly = true
    if (crewMatch[1]) {
      params.crew_size = parseInt(crewMatch[1])
    }
    // 크루 러닝 키워드 추가
    params.keywords = [...(params.keywords || []), '크루러닝', '그룹활동', '대규모그룹']
  }

  // 거리 추출
  const distanceMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:km|킬로미터|키로)/i)
  if (distanceMatch) {
    params.distance_km = parseFloat(distanceMatch[1])
  } else {
    // 시간 기반 거리 추정 (30분 = 약 3.3km)
    const timeMatch = query.match(/(\d+)\s*분/)
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1])
      params.distance_km = Math.round((minutes / 9) * 10) / 10 // 9분/km 기준
    }
  }

  // 시간대 추출
  if (query.match(/밤|야간|저녁|night/i)) {
    params.time_of_day = 'night'
  } else if (query.match(/아침|morning/i)) {
    params.time_of_day = 'morning'
  } else if (query.match(/오후|afternoon/i)) {
    params.time_of_day = 'afternoon'
  } else if (query.match(/저녁|evening/i)) {
    params.time_of_day = 'evening'
  }

  // 난이도 추출
  if (query.match(/초보|입문|쉬운|beginner|easy/i)) {
    params.difficulty_level = 'easy'
  } else if (query.match(/중급|medium|intermediate/i)) {
    params.difficulty_level = 'medium'
  } else if (query.match(/고급|어려운|hard|advanced/i)) {
    params.difficulty_level = 'hard'
  }

  // 위치 추출 (간단한 패턴 매칭)
  const locationPatterns = [
    /(?:에서|근처|주변)\s*(.+?)(?:\s|$)/,
    /(.+?)(?:에서|근처|주변)/,
  ]
  
  for (const pattern of locationPatterns) {
    const match = query.match(pattern)
    if (match && match[1]) {
      const location = match[1].trim()
      if (location.length > 1 && location.length < 20) {
        params.location = location
        break
      }
    }
  }

  return params
}