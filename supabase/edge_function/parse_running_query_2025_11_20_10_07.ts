import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type, X-Application-Name',
};

interface ParsedQuery {
  location?: string;
  distance?: number;
  duration?: number;
  keywords?: string[];
  timeOfDay?: string;
  isGroupRun?: boolean;
  weather?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, userLocation } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: '검색 쿼리가 필요합니다.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 자연어 쿼리 파싱
    const parsedQuery = parseNaturalQuery(query);
    
    // 날씨 정보 가져오기
    let weatherInfo = null;
    if (parsedQuery.location || userLocation) {
      weatherInfo = await getWeatherInfo(parsedQuery.location || userLocation);
    }

    return new Response(
      JSON.stringify({
        success: true,
        parsed: parsedQuery,
        weather: weatherInfo,
        originalQuery: query
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('쿼리 파싱 오류:', error);
    return new Response(
      JSON.stringify({ 
        error: '쿼리 파싱 중 오류가 발생했습니다.',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function parseNaturalQuery(query: string): ParsedQuery {
  const lowerQuery = query.toLowerCase();
  const result: ParsedQuery = {
    keywords: []
  };

  // 위치 추출
  const locationPatterns = [
    /(?:에서|근처|주변|쪽)/g,
    /(?:인하대|한강|제주도|서귀포|강남|홍대|신촌|명동|여의도|송파|강북|마포|용산|성북|동대문|중랑|광진|성동|종로|중구|서초|관악|동작|영등포|구로|금천|양천|강서|노원|도봉|은평|서대문)/g
  ];

  // 지역명 추출
  const locationMatch = query.match(/(?:인하대|한강|제주도|서귀포|강남|홍대|신촌|명동|여의도|송파|강북|마포|용산|성북|동대문|중랑|광진|성동|종로|중구|서초|관악|동작|영등포|구로|금천|양천|강서|노원|도봉|은평|서대문|일산|수원|성남|안양|부천|광명|평택|안산|고양|의정부|남양주|오산|시흥|군포|의왕|하남|용인|파주|김포|광주|양주|포천|여주|이천|안성|화성|부산|대구|인천|대전|광주|울산|세종|춘천|원주|강릉|청주|천안|전주|포항|창원|마산|진주|순천|목포|여수|제주)/g);
  
  if (locationMatch) {
    result.location = locationMatch[0];
  }

  // 거리 추출 (킬로미터)
  const distanceMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:키로|킬로|km|k)/i);
  if (distanceMatch) {
    result.distance = parseFloat(distanceMatch[1]);
  }

  // 시간 추출 (분)
  const timeMatch = query.match(/(\d+)\s*(?:시간|분)/i);
  if (timeMatch) {
    const value = parseInt(timeMatch[1]);
    if (query.includes('시간')) {
      result.duration = value * 60; // 시간을 분으로 변환
    } else {
      result.duration = value;
    }
  }

  // 시간대 추출
  if (lowerQuery.includes('아침') || lowerQuery.includes('새벽')) {
    result.timeOfDay = 'morning';
  } else if (lowerQuery.includes('점심') || lowerQuery.includes('낮')) {
    result.timeOfDay = 'afternoon';
  } else if (lowerQuery.includes('저녁') || lowerQuery.includes('밤')) {
    result.timeOfDay = 'evening';
  } else if (lowerQuery.includes('오늘')) {
    result.timeOfDay = 'today';
  }

  // 그룹 러닝 여부
  if (lowerQuery.includes('같이') || lowerQuery.includes('함께') || lowerQuery.includes('크루') || lowerQuery.includes('사람')) {
    result.isGroupRun = true;
  }

  // 키워드 추출
  const keywords = [];
  if (lowerQuery.includes('가볍게') || lowerQuery.includes('쉽게')) keywords.push('초보자');
  if (lowerQuery.includes('힘들게') || lowerQuery.includes('강하게')) keywords.push('고급자');
  if (lowerQuery.includes('공원')) keywords.push('공원');
  if (lowerQuery.includes('하천') || lowerQuery.includes('강')) keywords.push('하천');
  if (lowerQuery.includes('트랙')) keywords.push('트랙');
  if (lowerQuery.includes('업힐') || lowerQuery.includes('오르막')) keywords.push('업힐');
  if (lowerQuery.includes('야간') || lowerQuery.includes('밤')) keywords.push('야간가능');
  
  result.keywords = keywords;

  return result;
}

async function getWeatherInfo(location: string) {
  try {
    const apiKey = Deno.env.get('OPENWEATHER_API_KEY');
    if (!apiKey) {
      console.warn('OpenWeather API 키가 설정되지 않았습니다.');
      return null;
    }

    // 지역명을 영어로 변환 (간단한 매핑)
    const locationMap: { [key: string]: string } = {
      '서울': 'Seoul',
      '부산': 'Busan',
      '대구': 'Daegu',
      '인천': 'Incheon',
      '광주': 'Gwangju',
      '대전': 'Daejeon',
      '울산': 'Ulsan',
      '세종': 'Sejong',
      '수원': 'Suwon',
      '성남': 'Seongnam',
      '고양': 'Goyang',
      '용인': 'Yongin',
      '부천': 'Bucheon',
      '안산': 'Ansan',
      '안양': 'Anyang',
      '남양주': 'Namyangju',
      '화성': 'Hwaseong',
      '평택': 'Pyeongtaek',
      '의정부': 'Uijeongbu',
      '시흥': 'Siheung',
      '파주': 'Paju',
      '광명': 'Gwangmyeong',
      '김포': 'Gimpo',
      '군포': 'Gunpo',
      '오산': 'Osan',
      '이천': 'Icheon',
      '양주': 'Yangju',
      '하남': 'Hanam',
      '춘천': 'Chuncheon',
      '원주': 'Wonju',
      '강릉': 'Gangneung',
      '청주': 'Cheongju',
      '천안': 'Cheonan',
      '전주': 'Jeonju',
      '포항': 'Pohang',
      '창원': 'Changwon',
      '마산': 'Masan',
      '진주': 'Jinju',
      '순천': 'Suncheon',
      '목포': 'Mokpo',
      '여수': 'Yeosu',
      '제주': 'Jeju',
      '서귀포': 'Seogwipo',
      '인하대': 'Incheon', // 인하대는 인천으로 매핑
      '한강': 'Seoul', // 한강은 서울로 매핑
    };

    const englishLocation = locationMap[location] || location;
    
    // 현재 날씨 정보 가져오기
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${englishLocation},KR&appid=${apiKey}&units=metric&lang=kr`;
    
    const response = await fetch(weatherUrl);
    
    if (!response.ok) {
      console.error('날씨 API 응답 오류:', response.status, response.statusText);
      return null;
    }
    
    const weatherData = await response.json();
    
    return {
      location: weatherData.name,
      temperature: Math.round(weatherData.main.temp),
      feelsLike: Math.round(weatherData.main.feels_like),
      humidity: weatherData.main.humidity,
      description: weatherData.weather[0].description,
      icon: weatherData.weather[0].icon,
      windSpeed: weatherData.wind?.speed || 0,
      visibility: weatherData.visibility ? weatherData.visibility / 1000 : null, // km로 변환
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('날씨 정보 가져오기 실패:', error);
    return null;
  }
}