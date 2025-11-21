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

    // 전체 러닝코스 원본 데이터
    const RAW_COURSES = {
      "서울": {
        "하천·천 기반": [
          "한강 – 서울 전역 하천 러닝 중심축",
          "안양천 – 서울·경기 남서부 대표 하천",
          "당현천 – 도봉·강북 인근",
          "중랑천 – 동대문·중랑·광진",
          "양재천 – 강남·서초·성남",
          "목감천 – 구로·광명",
          "불광천 – 은평구",
          "정릉천 – 성북·종암",
          "성북천 – 성북·동대문",
          "우이천 – 강북·도봉",
        ],
        "송파구": [
          "석촌호수공원 (2.5km loop)",
          "송파둘레길 탄천길 (7.5km)",
          "송파둘레길 한강길 (3.2km)",
          "송파둘레길 성내천길 (6km)",
          "송파둘레길 장지천길 (4.4km)",
          "잠실종합운동장 보조경기장 트랙 (400m)",
          "올림픽공원 순환로 (5km)",
          "위례 휴먼링 (4.4km)",
        ],
        "종로구": [
          "경복궁~청와대 러닝코스",
          "인왕산 둘레길",
          "인왕산로",
          "안국역~성북동 와룡공원길",
        ],
        "중구": [
          "남산둘레길 (10km 내외)",
          "소월길 (업힐)",
        ],
        "서대문/마포/은평": [
          "연세대 대운동장 (트랙)",
          "서강대 운동장",
          "하늘공원 러닝코스",
          "노을공원 러닝코스",
          "불광천 전구간",
          "은평둘레길",
          "신도고~하나고 북한산 조망 코스",
        ],
        "성북/강북": [
          "성북천 (3.5km)",
          "정릉천",
          "한성대 입구~북악스카이웨이 업힐",
          "아리랑고개~팔각정 업힐",
          "서울시립대 순환 코스 (1.5km)",
        ],
        "강남/서초": [
          "양재천 전 구간",
          "대치유수지체육공원 트랙 (400m)",
          "반포운동장 트랙",
          "서울숲 주변 코스",
        ],
        "영등포/구로/금천": [
          "안양천 신정교 트랙 (340m)",
          "여의도공원 순환로",
          "국회운동장 트랙",
          "선유도공원 러닝코스",
          "도림천",
        ],
        "기타 서울 코스": [
          "뚝섬유원지 러닝로",
          "성산대교 러닝로 (20km 구간)",
          "청담대교~성수대교 (2.5km)",
          "어린이대공원 둘레길 (1.6~2.5km)",
          "망우역사문화공원 (업힐)",
          "창골축구장 조깅트랙",
          "관악산 일주문~제2광장",
          "서울대 캠퍼스 순환(5km)",
          "보라매공원",
          "이촌한강공원",
          "효창운동장 트랙",
          "목동운동장 트랙",
        ],
      },
      "부산": {
        "": [
          "요트경기장~마린시티~해운대~달맞이 러닝코스",
          "온천천 하천코스 (금정구)",
          "부산대 트랙",
          "사직보조경기장 (동래구)",
          "구덕운동장 트랙 (서구)",
          "사하구 – 강변대로, 다대포~하구둑 (8.5km)",
          "기장 월드컵 빌리지 (2.5km)",
          "부산진구 – 시민공원",
          "어린이대공원 코스",
          "영도구 – 태종대 코스 (3~4km loop)",
        ],
      },
      "대구": {
        "": [
          "금호강 러닝로",
          "신천 러닝로",
          "달서구 – 두류공원 / 경북기계공고 트랙 / 진천천 / 계명대 트랙",
          "중구 – 수성교 / 교육대 트랙(300m)",
          "북구 – 경북대 트랙 / 칠성교",
          "수성구 – 수성못 / 월드컵 보조구장 / 대륜고 트랙",
          "동구 – 동촌유원지",
          "달성군 – 명곡체육공원 트랙",
        ],
      },
      "대전": {
        "": [
          "갑천 / 유등천 / 대전천 전구간",
          "유성구 – 갑천 자전거도로 / 충남대 트랙 / 카이스트 트랙",
          "대덕구 – 한남대 트랙",
          "동구 – 우송대 트랙",
          "서구 – 관저체육공원 트랙",
        ],
      },
      "광주": {
        "": [
          "영산강",
          "광주천 (왕복 10km)",
          "전남대학교 대운동장",
          "조선대학교 대운동장",
        ],
      },
      "인천": {
        "연수구": [
          "둘레길8코스(승기천)",
          "송도달빛공원",
          "송도센트럴파크",
          "문학경기장 트랙",
        ],
        "미추홀구": [
          "인하대 운동장 트랙",
        ],
        "남동구": [
          "인천대공원",
          "해오름호수",
          "남동근린공원 트랙",
        ],
        "동구": [
          "구민운동장 트랙",
        ],
        "서구": [
          "아시아드보조경기장 트랙",
          "청라호수공원",
          "정서진자전거도로",
          "아라뱃길",
        ],
      },
      "울산": {
        "": [
          "태화강 국가정원 러닝코스",
        ],
      },
      "경기도": {
        "광명시": [
          "안양천 전구간 (서울~광명~안양) / 하천 / 20km+",
          "목감천 (서울 금천~광명) / 하천 / 6~10km",
          "하안동 시민종합운동장 트랙 / 트랙 / 400m",
          "철산동 시민운동장 트랙 / 트랙 / 400m",
        ],
        "부천시": [
          "상동호수공원 / 호수 / 1.2~1.5km",
          "상동 중앙공원 / 공원 / 약 1km",
          "부천종합운동장 트랙 / 트랙 / 800m",
          "굴포천 (부천~서울 강서) / 하천 / 10km+",
          "부천체육관 트랙 / 트랙 / 600m",
        ],
        "성남시": [
          "탄천길 (성남~강남~송파) / 하천 / 20km+",
          "황새울공원~율동공원 / 평지 러닝 / 왕복 7km",
          "율동공원 1바퀴 / 호수 / 1.8km",
          "성남종합운동장 트랙 / 트랙 / 400m",
          "탄천종합운동장 트랙 / 트랙 / 400m",
        ],
        "용인시": [
          "기흥호수공원 (신갈저수지) / 호수 / 약 4.5km",
          "경안천 / 하천 / 10km+",
          "미르스타디움 트랙 / 트랙 / 400m",
        ],
        "화성시": [
          "동탄여울공원 / 공원 / 1~2km",
          "동탄호수공원 / 호수 / 약 2.5~5km",
          "치동천 / 하천 / 8~10km",
          "동탄센트럴파크 / 공원 / 약 3km",
          "제부도 해안 (제부도 러닝코스) / 해안 / 5km",
          "봉담2 생태체육공원 트랙 / 트랙 / 400m",
          "향남종합운동장 외곽 / 트랙+순환 / 1km",
        ],
        "오산시": [
          "오산천 / 하천 / 8~10km",
          "오산종합운동장 트랙 / 트랙 / 400m",
        ],
        "안양시": [
          "안양천 (서울~광명~안양) / 하천 / 20km+",
          "학의천~안양천 연결코스 / 하천 / 약 23km",
          "박달동 하천로 / 하천 / 4~6km",
          "석수동 산책로 / 산책로 / 3~5km",
        ],
        "시흥시": [
          "물왕호수 / 호수 / 약 4.5km",
          "배곧한울공원 / 해안+공원 / 편도 4.5km",
          "물왕호수~갯골생태공원~관곡지 / 연계 / 10km",
        ],
        "안산시": [
          "화정천 / 하천 / 5~8km",
          "안산천 / 하천 / 10km+",
          "화랑유원지 / 공원 / 약 1.5~2km",
          "안산호수공원 / 호수/공원 / 1~3km",
        ],
        "수원시": [
          "광교호수공원 / 호수 / 4.8km",
          "원천리천 (왕복 10km+) / 하천 / 10km+",
        ],
        "의정부시": [
          "의정부종합운동장 트랙 / 트랙 / 400m",
        ],
        "평택시": [
          "소사벌레포츠타운 트랙 / 트랙 / 400m",
          "배다리생태공원 / 저수지 / 도심+호수 / 1.5~2km",
          "통복천 / 하천 / 하프(21km) 가능",
          "평택호 자전거길 / 호수/해안 / 30km+",
        ],
        "김포시": [
          "라베니체 수변공원 / 수변 / 1.5~3km",
          "김포한강신도시 생태공원 / 공원 / 2km",
          "아라뱃길 (김포~인천) / 하천 / 17km",
        ],
        "고양시": [
          "일산호수공원 / 호수 / 4.7km",
          "어울림누리 별무리경기장 / 트랙 / 400m",
          "공릉천 (파주~고양) / 하천 / 10km+",
        ],
        "파주시": [
          "공릉천 / 하천 / 10km+",
          "파주스타디움 트랙 / 트랙 / 400m",
          "운정호수공원 / 호수 / 2.1km",
          "건강공원 트랙 / 트랙 / 러닝+워킹 3레인",
          "소리천 / 하천 / 5~8km",
        ],
        "남양주시": [
          "별내카페거리~용암천 (10km) / 하천 / 10km",
          "왕숙천 / 하천 / 10km+",
          "중랑천 남양주 구간 (서울~남양주) / 하천 / 20km+",
        ],
        "하남시": [
          "미사리 조정경기장 / 호수+대형 순환로 / 5km",
        ],
        "여주시": [
          "금모래은모래캠핑장~강천보 / 강변 / 편도 5km",
        ],
        "과천시": [
          "관문체육공원 트랙 / 트랙 / 400m",
        ],
        "군포시": [
          "군포시 시민체육광장 트랙 / 트랙 / 400m",
        ],
        "": [
          "안양천 (서울·광명·안양) / 하천 / 20km+",
          "학의천 (안양~의왕) / 하천 / 10km+",
          "목감천 (서울 금천·광명) / 하천 / 6~10km",
          "양재천 (서울 강남·성남) / 하천 / 15km+",
          "중랑천 (서울~구리~남양주) / 하천 / 20km+",
          "탄천 (성남~강남~송파) / 하천 / 20km+",
          "경안천 (용인/광주/성남 연결) / 하천 / 10km+",
        ],
      },
      "충청도": {
        "부여": [
          "구드레공원~규암정류소",
          "백제보전망대",
        ],
        "천안": [
          "노태공원",
          "성성호수공원",
          "축구센터",
          "단대천호지",
        ],
        "아산": [
          "신정호(4.8km)",
          "곡교천",
        ],
        "공주": [
          "공주대 트랙",
          "금강신관공원",
        ],
        "세종": [
          "금강보행교",
          "방숙천",
          "제천",
          "호수공원",
        ],
        "군산": [
          "은파호수공원",
        ],
      },
      "경상도": {
        "진주": [
          "남강변",
          "경상대 트랙",
          "혁신도시 영천강",
        ],
        "창원": [
          "종합운동장",
          "스포츠파크",
          "창원천",
        ],
        "양산": [
          "양산천",
          "종합운동장",
        ],
        "거제": [
          "연초뚝길",
          "상문고~계룡중 산책로",
        ],
        "김해": [
          "해반천",
          "연지공원",
          "진영공설운동장",
        ],
        "안동": [
          "호민저수지",
        ],
        "밀양": [
          "밀양강 둔치(5km)",
        ],
        "포항": [
          "형산강",
          "철길숲 연계코스",
        ],
        "경주": [
          "보문호수(7km)",
        ],
        "경산": [
          "남매지",
        ],
        "구미": [
          "동락공원",
          "금오공대 트랙",
        ],
      },
      "전라도": {
        "전주": [
          "삼천천",
          "전주천",
          "한옥마을",
        ],
        "고창": [
          "공설운동장 트랙",
        ],
        "군산": [
          "금강하구둑",
          "경포천",
        ],
        "목포": [
          "영산강 하구둑~삼호대교",
          "평화광장~갓바위",
        ],
        "여수": [
          "옛철길자전거길(16km)",
        ],
      },
      "강원도": {
        "춘천": [
          "의암호",
          "공지천",
          "소양강산책로",
          "중도",
        ],
        "강릉": [
          "경포대(4.3km loop)",
        ],
        "속초": [
          "영랑호 순환로",
        ],
      },
      "제주": {
        "": [
          "제주 애향운동장 트랙",
          "사라봉~오현고~화북포구~남생이못 (20km)",
        ],
      },
    };

    // 데이터 처리 함수들
    function extractDistance(text: string): number | null {
      const patterns = [
        /(\d+\.?\d*)\s*km/i,
        /\((\d+\.?\d*)\s*km/i,
        /(\d+\.?\d*)\s*킬로/i,
        /(\d+\.?\d*)\s*km\+/i,
        /약\s*(\d+\.?\d*)\s*km/i,
        /(\d+\.?\d*)~(\d+\.?\d*)\s*km/i,
        /왕복\s*(\d+\.?\d*)\s*km/i,
        /편도\s*(\d+\.?\d*)\s*km/i,
      ];

      // 범위 패턴 먼저 처리
      const rangeMatch = text.match(/(\d+\.?\d*)~(\d+\.?\d*)\s*km/i);
      if (rangeMatch) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        return (min + max) / 2;
      }

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          return parseFloat(match[1]);
        }
      }

      // m 단위 처리
      const mMatch = text.match(/(\d+)\s*m/i);
      if (mMatch) {
        return parseFloat(mMatch[1]) / 1000.0;
      }

      return null;
    }

    function extractCourseType(text: string): string {
      const typeMatch = text.match(/\/\s*([^/]+)\s*\//);
      if (typeMatch) {
        const typeStr = typeMatch[1].trim().toLowerCase();
        const typeMapping: { [key: string]: string } = {
          '하천': '하천',
          '공원': '공원',
          '호수': '호수',
          '트랙': '트랙',
          '운동장': '트랙',
          '산책로': '산책로',
          '업힐': '업힐',
          '해안': '해안',
          '수변': '수변',
          '저수지': '호수',
          '강변': '하천',
          '평지 러닝': '공원',
        };
        
        for (const [key, value] of Object.entries(typeMapping)) {
          if (typeStr.includes(key)) {
            return value;
          }
        }
      }

      const textLower = text.toLowerCase();
      if (textLower.includes('트랙') || textLower.includes('경기장') || textLower.includes('운동장')) {
        return '트랙';
      } else if (textLower.includes('하천') || textLower.includes('천') || textLower.includes('강')) {
        return '하천';
      } else if (textLower.includes('공원')) {
        return '공원';
      } else if (textLower.includes('호수') || textLower.includes('저수지')) {
        return '호수';
      } else if (textLower.includes('업힐') || textLower.includes('산') || textLower.includes('고개')) {
        return '업힐';
      } else if (textLower.includes('산책로') || textLower.includes('둘레길')) {
        return '산책로';
      } else if (textLower.includes('해안')) {
        return '해안';
      } else {
        return '기타';
      }
    }

    function extractRegionTags(text: string, city: string): string[] {
      const regions = [city];
      
      const bracketMatch = text.match(/\(([^)]+)\)/);
      if (bracketMatch) {
        const regionText = bracketMatch[1];
        const parts = regionText.split(/[~·,，]/);
        
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.includes('서울') && !regions.includes('서울')) {
            regions.push('서울');
          }
          if ((trimmed.includes('경기') || trimmed.includes('경기도')) && !regions.includes('경기')) {
            regions.push('경기');
          }
          if (trimmed.includes('인천') && !regions.includes('인천')) {
            regions.push('인천');
          }
          if (trimmed.includes('부산') && !regions.includes('부산')) {
            regions.push('부산');
          }
        }
      }
      
      return [...new Set(regions)];
    }

    function extractDistrictTags(text: string, district: string): string[] {
      const districts = district ? [district] : [];
      
      const bracketMatch = text.match(/\(([^)]+)\)/);
      if (bracketMatch) {
        const regionText = bracketMatch[1];
        const parts = regionText.split(/[~·,，]/);
        
        for (const part of parts) {
          const trimmed = part.trim();
          const districtMatch = trimmed.match(/([가-힣]+(?:구|시|군))/);
          if (districtMatch) {
            const dist = districtMatch[1];
            if (!districts.includes(dist)) {
              districts.push(dist);
            }
          }
        }
      }
      
      return [...new Set(districts)];
    }

    function extractNaturalTags(text: string, courseType: string): string[] {
      const tags = [courseType];
      const textLower = text.toLowerCase();
      
      if (text.includes('한강')) tags.push('한강');
      if (text.includes('공원')) tags.push('공원');
      if (text.includes('트랙')) tags.push('트랙');
      if (text.includes('야간')) tags.push('야간가능');
      if (text.includes('크루') || text.includes('그룹')) tags.push('크루러닝');
      if (text.includes('하천') || text.includes('천')) tags.push('하천');
      if (text.includes('호수')) tags.push('호수');
      if (text.includes('해안') || text.includes('해변')) tags.push('해안');
      
      return [...new Set(tags)];
    }

    function getRandomCoordinate(city: string, district: string): { lat: number, lng: number } {
      // 지역별 대략적인 좌표 범위 (실제로는 카카오맵 API 사용해야 함)
      const coordinates: { [key: string]: { lat: [number, number], lng: [number, number] } } = {
        '서울': { lat: [37.4, 37.7], lng: [126.7, 127.2] },
        '부산': { lat: [35.0, 35.3], lng: [129.0, 129.3] },
        '대구': { lat: [35.7, 36.0], lng: [128.4, 128.7] },
        '인천': { lat: [37.3, 37.6], lng: [126.4, 126.8] },
        '광주': { lat: [35.1, 35.2], lng: [126.7, 126.9] },
        '대전': { lat: [36.2, 36.4], lng: [127.3, 127.5] },
        '울산': { lat: [35.5, 35.6], lng: [129.2, 129.4] },
        '경기': { lat: [37.0, 38.0], lng: [126.5, 127.8] },
        '충청도': { lat: [36.0, 37.0], lng: [126.5, 128.0] },
        '경상도': { lat: [35.0, 36.5], lng: [128.0, 130.0] },
        '전라도': { lat: [34.5, 36.0], lng: [126.0, 128.0] },
        '강원도': { lat: [37.0, 38.5], lng: [127.5, 129.5] },
        '제주': { lat: [33.2, 33.6], lng: [126.1, 126.9] },
      };

      const coord = coordinates[city] || coordinates['서울'];
      const lat = coord.lat[0] + Math.random() * (coord.lat[1] - coord.lat[0]);
      const lng = coord.lng[0] + Math.random() * (coord.lng[1] - coord.lng[0]);
      
      return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 };
    }

    // 모든 코스 처리
    const processedCourses: any[] = [];
    const coursesDict: { [key: string]: any } = {};

    for (const [city, districts] of Object.entries(RAW_COURSES)) {
      for (const [district, courses] of Object.entries(districts)) {
        for (const courseName of courses) {
          const parsedDistrict = district || "";
          
          // 여러 구가 합쳐진 경우 처리
          if (parsedDistrict.includes('/')) {
            const districtsList = parsedDistrict.split('/');
            for (const d of districtsList) {
              const normalized = normalizeCourse(city, d.trim(), courseName);
              const key = normalized.course_name;
              
              if (coursesDict[key]) {
                // 기존 코스에 태그 병합
                const existing = coursesDict[key];
                existing.region_tags = [...new Set([...existing.region_tags, ...normalized.region_tags])];
                existing.district_tags = [...new Set([...existing.district_tags, ...normalized.district_tags])];
                existing.natural_tags = [...new Set([...existing.natural_tags, ...normalized.natural_tags])];
              } else {
                coursesDict[key] = normalized;
              }
            }
          } else {
            const normalized = normalizeCourse(city, parsedDistrict, courseName);
            const key = normalized.course_name;
            
            if (coursesDict[key]) {
              // 기존 코스에 태그 병합
              const existing = coursesDict[key];
              existing.region_tags = [...new Set([...existing.region_tags, ...normalized.region_tags])];
              existing.district_tags = [...new Set([...existing.district_tags, ...normalized.district_tags])];
              existing.natural_tags = [...new Set([...existing.natural_tags, ...normalized.natural_tags])];
            } else {
              coursesDict[key] = normalized;
            }
          }
        }
      }
    }

    function normalizeCourse(city: string, district: string, rawName: string) {
      let courseName = rawName;
      if (rawName.includes(' / ')) {
        const courseNamePart = rawName.split(' / ')[0].trim();
        courseName = courseNamePart.replace(/\([^)]*\)/g, '').trim();
      } else {
        courseName = rawName.split('(')[0].split('–')[0].split('/')[0].trim();
      }

      const lengthKm = extractDistance(rawName) || 3.0;
      const courseType = extractCourseType(rawName);
      const regionTags = extractRegionTags(rawName, city);
      const districtTags = extractDistrictTags(rawName, district);
      const naturalTags = extractNaturalTags(rawName, courseType);
      
      const coords = getRandomCoordinate(city, district);
      
      let description = `${regionTags.join(', ')}`;
      if (districtTags.length > 0) {
        description += ` ${districtTags.slice(0, 2).join(', ')}`;
      }
      description += `의 ${courseType} 러닝 코스입니다.`;
      
      if (lengthKm < 1) {
        description += ` 총 거리는 약 ${Math.round(lengthKm * 1000)}m입니다.`;
      } else {
        description += ` 총 거리는 약 ${lengthKm.toFixed(1)}km입니다.`;
      }

      return {
        course_name: courseName,
        description,
        length_km: lengthKm,
        course_type: courseType,
        region_tags: regionTags,
        district_tags: districtTags,
        natural_tags: naturalTags,
        start_lat: coords.lat,
        start_lng: coords.lng,
        has_uphill: rawName.includes('업힐') || rawName.includes('산'),
        estimated_duration_minutes: Math.round(lengthKm * 9), // 9분/km 가정
      };
    }

    const allCourses = Object.values(coursesDict);

    // 기존 데이터 삭제
    await supabase.from('running_courses_2025_11_20_10_07').delete().neq('id', 0);

    // 배치로 데이터 삽입
    const batchSize = 50;
    let insertedCount = 0;

    for (let i = 0; i < allCourses.length; i += batchSize) {
      const batch = allCourses.slice(i, i + batchSize);
      
      const insertData = batch.map(course => ({
        name: course.course_name,
        description: course.description,
        start_lat: course.start_lat,
        start_lng: course.start_lng,
        distance_km: course.length_km,
        city: course.region_tags[0] || '',
        district: course.district_tags[0] || '',
        course_type: course.course_type,
        has_uphill: course.has_uphill,
        estimated_duration_minutes: course.estimated_duration_minutes,
        tags: course.natural_tags,
        region_tags: course.region_tags,
        district_tags: course.district_tags,
        neighborhood_tags: [],
        natural_tags: course.natural_tags,
        note: null
      }));

      const { error } = await supabase
        .from('running_courses_2025_11_20_10_07')
        .insert(insertData);

      if (error) {
        console.error('배치 삽입 오류:', error);
      } else {
        insertedCount += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `총 ${allCourses.length}개의 코스 중 ${insertedCount}개가 성공적으로 저장되었습니다.`,
        totalCourses: allCourses.length,
        insertedCourses: insertedCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('처리 오류:', error);
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