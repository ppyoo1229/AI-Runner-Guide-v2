import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { query } = await req.json();
    
    if (!query) {
      throw new Error('검색어가 필요합니다');
    }

    // 정교한 자연어 파싱
    const parsed = parseRunningQuery(query);
    
    // 날씨 정보 가져오기
    let weatherInfo = null;
    if (parsed.location) {
      weatherInfo = await getWeatherInfo(parsed.location);
    }

    return new Response(
      JSON.stringify({
        success: true,
        parsed,
        weather: weatherInfo
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('파싱 오류:', error);
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

function parseRunningQuery(query: string) {
  const result = {
    location: null as string | null,
    region: null as string | null,
    district: null as string | null,
    neighborhood: null as string | null,
    distance: null as number | null,
    duration: null as number | null,
    time: null as string | null,
    keywords: [] as string[],
    courseType: null as string | null,
    isGroupRunning: false,
    isNightRunning: false,
    difficulty: null as string | null
  };

  const queryLower = query.toLowerCase();

  // 1. 지역 정보 추출 (정교한 매핑)
  const locationPatterns = {
    // 서울 세부 지역
    '잠실': { region: '서울', district: '송파구', neighborhood: '잠실동' },
    '송파': { region: '서울', district: '송파구' },
    '송파구': { region: '서울', district: '송파구' },
    '강남': { region: '서울', district: '강남구' },
    '강남구': { region: '서울', district: '강남구' },
    '서초': { region: '서울', district: '서초구' },
    '서초구': { region: '서울', district: '서초구' },
    '영등포': { region: '서울', district: '영등포구' },
    '마포': { region: '서울', district: '마포구' },
    '종로': { region: '서울', district: '종로구' },
    '중구': { region: '서울', district: '중구' },
    '성북': { region: '서울', district: '성북구' },
    '강북': { region: '서울', district: '강북구' },
    '은평': { region: '서울', district: '은평구' },
    '서대문': { region: '서울', district: '서대문구' },
    '구로': { region: '서울', district: '구로구' },
    '금천': { region: '서울', district: '금천구' },
    
    // 인천
    '인하대': { region: '인천', district: '미추홀구', neighborhood: '인하대' },
    '송도': { region: '인천', district: '연수구', neighborhood: '송도' },
    '청라': { region: '인천', district: '서구', neighborhood: '청라' },
    '연수구': { region: '인천', district: '연수구' },
    '미추홀구': { region: '인천', district: '미추홀구' },
    '서구': { region: '인천', district: '서구' },
    '남동구': { region: '인천', district: '남동구' },
    
    // 경기도
    '광명': { region: '경기', district: '광명시' },
    '부천': { region: '경기', district: '부천시' },
    '성남': { region: '경기', district: '성남시' },
    '용인': { region: '경기', district: '용인시' },
    '화성': { region: '경기', district: '화성시' },
    '안양': { region: '경기', district: '안양시' },
    '수원': { region: '경기', district: '수원시' },
    '고양': { region: '경기', district: '고양시' },
    '파주': { region: '경기', district: '파주시' },
    
    // 부산
    '해운대': { region: '부산', district: '해운대구' },
    '부산진': { region: '부산', district: '부산진구' },
    '동래': { region: '부산', district: '동래구' },
    '서구': { region: '부산', district: '서구' },
    '사하구': { region: '부산', district: '사하구' },
    
    // 대구
    '달서구': { region: '대구', district: '달서구' },
    '수성구': { region: '대구', district: '수성구' },
    '북구': { region: '대구', district: '북구' },
    
    // 광역시/도
    '서울': { region: '서울' },
    '부산': { region: '부산' },
    '대구': { region: '대구' },
    '인천': { region: '인천' },
    '광주': { region: '광주' },
    '대전': { region: '대전' },
    '울산': { region: '울산' },
    '경기': { region: '경기' },
    '경기도': { region: '경기' },
    '제주': { region: '제주' }
  };

  // 지역 매칭 (가장 구체적인 것부터)
  for (const [keyword, locationInfo] of Object.entries(locationPatterns)) {
    if (query.includes(keyword)) {
      result.location = keyword;
      result.region = locationInfo.region;
      result.district = locationInfo.district || null;
      result.neighborhood = locationInfo.neighborhood || null;
      break;
    }
  }

  // 2. 거리 추출
  const distancePatterns = [
    /(\d+(?:\.\d+)?)\s*(?:키로|킬로|km|키로미터)/i,
    /(\d+(?:\.\d+)?)\s*k/i,
    /(\d+)\s*키로/i
  ];
  
  for (const pattern of distancePatterns) {
    const match = query.match(pattern);
    if (match) {
      result.distance = parseFloat(match[1]);
      break;
    }
  }

  // 3. 시간 추출
  const timePatterns = [
    /(\d+)\s*시간/i,
    /(\d+)\s*분/i,
    /(\d+)\s*시\s*(\d+)\s*분/i
  ];
  
  for (const pattern of timePatterns) {
    const match = query.match(pattern);
    if (match) {
      if (pattern.source.includes('시간')) {
        result.duration = parseInt(match[1]) * 60; // 분으로 변환
      } else if (pattern.source.includes('분')) {
        result.duration = parseInt(match[1]);
      } else if (match[2]) { // 시분 조합
        result.duration = parseInt(match[1]) * 60 + parseInt(match[2]);
      }
      break;
    }
  }

  // 4. 시간대 추출
  const timeOfDayPatterns = [
    { pattern: /오늘|지금|현재/, time: 'now' },
    { pattern: /아침|새벽/, time: 'morning' },
    { pattern: /점심|낮/, time: 'afternoon' },
    { pattern: /저녁|밤|야간/, time: 'evening' },
    { pattern: /새벽/, time: 'dawn' }
  ];
  
  for (const { pattern, time } of timeOfDayPatterns) {
    if (pattern.test(query)) {
      result.time = time;
      break;
    }
  }

  // 5. 코스 유형 추출
  const courseTypePatterns = {
    '하천': ['하천', '천', '강', '한강', '안양천', '탄천', '중랑천'],
    '공원': ['공원', '파크'],
    '호수': ['호수', '저수지', '석촌호수', '일산호수'],
    '트랙': ['트랙', '운동장', '경기장'],
    '산책로': ['산책로', '둘레길', '올레길'],
    '해안': ['해안', '해변', '바다'],
    '업힐': ['업힐', '오르막', '산']
  };

  for (const [type, keywords] of Object.entries(courseTypePatterns)) {
    if (keywords.some(keyword => query.includes(keyword))) {
      result.courseType = type;
      break;
    }
  }

  // 6. 특수 키워드 추출
  if (/크루|그룹|같이|함께|단체/.test(query)) {
    result.isGroupRunning = true;
    result.keywords.push('크루러닝');
  }

  if (/야간|밤|저녁|어두운/.test(query)) {
    result.isNightRunning = true;
    result.keywords.push('야간러닝');
  }

  // 7. 난이도 추출
  if (/쉬운|가벼운|편한/.test(query)) {
    result.difficulty = 'easy';
  } else if (/어려운|힘든|업힐|오르막/.test(query)) {
    result.difficulty = 'hard';
  }

  // 8. 기타 키워드
  const otherKeywords = [
    { pattern: /주차/, keyword: '주차장' },
    { pattern: /화장실/, keyword: '화장실' },
    { pattern: /안전/, keyword: '안전' },
    { pattern: /조명/, keyword: '조명' }
  ];

  for (const { pattern, keyword } of otherKeywords) {
    if (pattern.test(query)) {
      result.keywords.push(keyword);
    }
  }

  return result;
}

async function getWeatherInfo(location: string) {
  try {
    const apiKey = Deno.env.get('OPENWEATHER_API_KEY');
    if (!apiKey) {
      console.log('OpenWeather API 키가 설정되지 않았습니다');
      return null;
    }

    // 지역명을 영어로 매핑
    const locationMap: { [key: string]: string } = {
      '잠실': 'Jamsil,KR',
      '송파': 'Songpa,KR', 
      '강남': 'Gangnam,KR',
      '서초': 'Seocho,KR',
      '인하대': 'Incheon,KR',
      '송도': 'Songdo,KR',
      '청라': 'Cheongna,KR',
      '광명': 'Gwangmyeong,KR',
      '부천': 'Bucheon,KR',
      '성남': 'Seongnam,KR',
      '용인': 'Yongin,KR',
      '화성': 'Hwaseong,KR',
      '안양': 'Anyang,KR',
      '수원': 'Suwon,KR',
      '해운대': 'Haeundae,KR',
      '서울': 'Seoul,KR',
      '부산': 'Busan,KR',
      '대구': 'Daegu,KR',
      '인천': 'Incheon,KR',
      '광주': 'Gwangju,KR',
      '대전': 'Daejeon,KR'
    };

    const cityName = locationMap[location] || `${location},KR`;
    
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${apiKey}&units=metric&lang=kr`
    );

    if (!response.ok) {
      console.log(`날씨 API 오류: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    return {
      location: data.name,
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 10) / 10,
      description: data.weather[0].description,
      icon: data.weather[0].icon
    };

  } catch (error) {
    console.error('날씨 정보 조회 실패:', error);
    return null;
  }
}