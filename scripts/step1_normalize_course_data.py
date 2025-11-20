#!/usr/bin/env python3
"""
STEP 1: 전국 러닝코스 원본 데이터 정제
- 이름 표준화
- 시/도, 시/군/구 추출
- 한 문장 설명 생성
- 난이도/평지/업힐 정보 추출
- 카테고리 태그 생성
"""

import json
import re
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

@dataclass
class NormalizedCourse:
    """정규화된 코스 데이터 구조 (다중 지역 태그 지원)"""
    course_name: str  # 대표 이름
    description: str  # 간단 설명
    length_km: Optional[float]  # 코스 거리
    course_type: str  # 하천, 공원, 트랙, 산책로, 업힐, 운동장 등
    note: Optional[str]  # 비고
    difficulty: Optional[str] = None  # easy, medium, hard
    elevation: Optional[str] = None  # 평지, 업힐
    
    # 다중 지역 태그 (배열)
    region_tags: List[str] = None  # 시/도 태그 (예: ["서울", "경기"])
    district_tags: List[str] = None  # 시/군/구 태그 (예: ["구로구", "광명시", "안양시"])
    neighborhood_tags: List[str] = None  # 동 단위 태그 (예: ["석수3동", "박달동"])
    natural_tags: List[str] = None  # 자연 지형 태그 (예: ["하천", "공원"])
    
    # 기존 호환성을 위한 단일 값 (첫 번째 태그 사용)
    city: str = ""  # 광역시/도 (region_tags[0])
    district: str = ""  # 시/군/구 (district_tags[0])
    tags: List[str] = None  # 카테고리 태그 (natural_tags와 통합)

    def __post_init__(self):
        if self.region_tags is None:
            self.region_tags = []
        if self.district_tags is None:
            self.district_tags = []
        if self.neighborhood_tags is None:
            self.neighborhood_tags = []
        if self.natural_tags is None:
            self.natural_tags = []
        if self.tags is None:
            self.tags = []
        
        # 기존 호환성을 위해 첫 번째 태그를 city, district로 설정
        if self.region_tags and not self.city:
            self.city = self.region_tags[0]
        if self.district_tags and not self.district:
            self.district = self.district_tags[0]
        
        # natural_tags를 tags에도 포함
        if self.natural_tags:
            self.tags = list(set(self.tags + self.natural_tags))

# 원본 데이터 (사용자가 제공한 코스 정보)
RAW_COURSES = {
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
        # 서울·경기 겹치는 주요 하천 (중복 포함)
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
}

def extract_distance(text: str) -> Optional[float]:
    """텍스트에서 거리(km) 추출"""
    patterns = [
        r'(\d+\.?\d*)\s*km',
        r'\((\d+\.?\d*)\s*km',
        r'(\d+\.?\d*)\s*킬로',
        r'(\d+\.?\d*)\s*km\+',  # 20km+ 같은 패턴
        r'약\s*(\d+\.?\d*)\s*km',  # 약 4.5km
        r'(\d+\.?\d*)~(\d+\.?\d*)\s*km',  # 1.2~1.5km (평균값 사용)
        r'(\d+\.?\d*)\s*~(\d+\.?\d*)\s*km',  # 1.2 ~ 1.5km
        r'왕복\s*(\d+\.?\d*)\s*km',  # 왕복 10km+
        r'편도\s*(\d+\.?\d*)\s*km',  # 편도 4.5km
    ]
    
    # 범위 패턴 먼저 처리 (예: 1.2~1.5km)
    range_match = re.search(r'(\d+\.?\d*)~(\d+\.?\d*)\s*km', text, re.IGNORECASE)
    if range_match:
        min_val = float(range_match.group(1))
        max_val = float(range_match.group(2))
        return (min_val + max_val) / 2  # 평균값 반환
    
    # 단일 값 패턴
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return float(match.group(1))
    
    # m 단위 처리 (트랙 등)
    m_match = re.search(r'(\d+)\s*m', text, re.IGNORECASE)
    if m_match:
        meters = float(m_match.group(1))
        return meters / 1000.0  # km로 변환
    
    return None

def extract_course_type(text: str) -> str:
    """코스 유형 추출 (정규화된 형태)"""
    # 정규화된 형태에서 유형 추출 (예: " / 하천 / 20km+")
    type_match = re.search(r'/\s*([^/]+)\s*/', text)
    if type_match:
        type_str = type_match.group(1).strip().lower()
        # 정규화된 유형 매핑
        type_mapping = {
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
        }
        for key, value in type_mapping.items():
            if key in type_str:
                return value
    
    # 정규화되지 않은 경우 기존 로직 사용
    text_lower = text.lower()
    if '트랙' in text_lower or '경기장' in text_lower or '운동장' in text_lower:
        return '트랙'
    elif '하천' in text_lower or '천' in text_lower or '강' in text_lower:
        return '하천'
    elif '공원' in text_lower:
        return '공원'
    elif '호수' in text_lower or '저수지' in text_lower:
        return '호수'
    elif '업힐' in text_lower or '산' in text_lower or '고개' in text_lower:
        return '업힐'
    elif '산책로' in text_lower or '둘레길' in text_lower:
        return '산책로'
    elif '해안' in text_lower:
        return '해안'
    else:
        return '기타'

def extract_difficulty(text: str) -> Optional[str]:
    """난이도 추출"""
    text_lower = text.lower()
    if '업힐' in text_lower or '산' in text_lower:
        return 'hard'
    elif '트랙' in text_lower or '평지' in text_lower:
        return 'easy'
    else:
        return 'medium'

def extract_region_tags(text: str, city: str) -> List[str]:
    """시/도 태그 추출 (다중 지역 지원)"""
    regions = [city]  # 기본값
    
    # 괄호 안의 지역 정보 파싱 (예: "(서울~광명~안양)", "(서울·경기)")
    bracket_match = re.search(r'\(([^)]+)\)', text)
    if bracket_match:
        region_text = bracket_match.group(1)
        
        # "~" 또는 "·" 또는 ","로 구분된 지역 추출
        parts = re.split(r'[~·,，]', region_text)
        
        for part in parts:
            part = part.strip()
            # 시/도 추출
            if '서울' in part:
                if '서울' not in regions:
                    regions.append('서울')
            if '경기' in part or '경기도' in part:
                if '경기' not in regions:
                    regions.append('경기')
            if '인천' in part:
                if '인천' not in regions:
                    regions.append('인천')
            if '부산' in part:
                if '부산' not in regions:
                    regions.append('부산')
            # 기타 시/도도 동일하게 처리
    
    return list(set(regions))  # 중복 제거

def extract_district_tags(text: str, district: str) -> List[str]:
    """시/군/구 태그 추출 (다중 지역 지원)"""
    districts = [district] if district else []  # 기본값
    
    # 괄호 안의 지역 정보 파싱
    bracket_match = re.search(r'\(([^)]+)\)', text)
    if bracket_match:
        region_text = bracket_match.group(1)
        
        # "~" 또는 "·" 또는 ","로 구분된 지역 추출
        parts = re.split(r'[~·,，]', region_text)
        
        for part in parts:
            part = part.strip()
            # 시/군/구 추출 (구, 시, 군으로 끝나는 것)
            district_match = re.search(r'([가-힣]+(?:구|시|군))', part)
            if district_match:
                dist = district_match.group(1)
                if dist not in districts:
                    districts.append(dist)
    
    return list(set(districts))  # 중복 제거

def extract_neighborhood_tags(text: str) -> List[str]:
    """동 단위 태그 추출"""
    neighborhoods = []
    
    # 동 단위 추출 (예: "석수3동", "박달동")
    # 코스명에서 동 정보 추출
    neighborhood_patterns = [
        r'([가-힣]+동)',  # 일반 동
        r'([가-힣]+[0-9]+동)',  # 숫자 포함 동 (예: 석수3동)
    ]
    
    for pattern in neighborhood_patterns:
        matches = re.findall(pattern, text)
        neighborhoods.extend(matches)
    
    return list(set(neighborhoods))  # 중복 제거

def extract_natural_tags(text: str, course_type: str) -> List[str]:
    """자연 지형 태그 추출"""
    tags = [course_type]  # 기본 유형
    text_lower = text.lower()
    
    # 추가 자연 지형 태그
    if '한강' in text:
        tags.append('한강')
    if '공원' in text:
        tags.append('공원')
    if '트랙' in text:
        tags.append('트랙')
    if '야간' in text:
        tags.append('야간가능')
    if '크루' in text or '그룹' in text:
        tags.append('크루러닝')
    if '하천' in text or '천' in text:
        tags.append('하천')
    if '호수' in text:
        tags.append('호수')
    if '해안' in text or '해변' in text:
        tags.append('해안')
    
    return list(set(tags))  # 중복 제거

def normalize_course(
    city: str,
    district: str,
    raw_name: str
) -> NormalizedCourse:
    """원본 코스 데이터를 정규화된 형태로 변환 (다중 지역 태그 지원)"""
    
    # 정규화된 형태 파싱 (예: "안양천 전구간 (서울~광명~안양) / 하천 / 20km+")
    # 코스명 추출 (첫 번째 "/" 이전)
    if ' / ' in raw_name:
        course_name_part = raw_name.split(' / ')[0].strip()
        # 괄호 안의 설명 제거 (태그는 별도로 추출)
        course_name = re.sub(r'\([^)]*\)', '', course_name_part).strip()
    else:
        # 정규화되지 않은 경우 기존 로직
        course_name = raw_name.split('(')[0].split('–')[0].split('/')[0].strip()
    
    # 거리 추출
    length_km = extract_distance(raw_name)
    
    # 코스 유형 추출
    course_type = extract_course_type(raw_name)
    
    # 난이도 추출
    difficulty = extract_difficulty(raw_name)
    
    # 다중 지역 태그 추출
    region_tags = extract_region_tags(raw_name, city)
    district_tags = extract_district_tags(raw_name, district)
    neighborhood_tags = extract_neighborhood_tags(raw_name)
    natural_tags = extract_natural_tags(raw_name, course_type)
    
    # 기존 tags (natural_tags와 통합)
    tags = natural_tags.copy()
    
    # 설명 생성
    if district_tags:
        district_str = ", ".join(district_tags[:2])  # 최대 2개만 표시
        description = f"{', '.join(region_tags)} {district_str}의 {course_type} 러닝 코스입니다."
    elif district:
        description = f"{city} {district}의 {course_type} 러닝 코스입니다."
    else:
        description = f"{city}의 {course_type} 러닝 코스입니다."
    
    if length_km:
        if length_km < 1:
            description += f" 총 거리는 약 {int(length_km * 1000)}m입니다."
        else:
            description += f" 총 거리는 약 {length_km:.1f}km입니다."
    
    # 비고 추출
    note_parts = []
    if '업힐' in raw_name:
        note_parts.append("업힐 구간 포함")
    if '트랙' in raw_name:
        note_parts.append("정규 트랙 시설")
    if '전구간' in raw_name or '연계' in raw_name:
        note_parts.append("연계 코스 가능")
    if '해안' in raw_name or '해변' in raw_name:
        note_parts.append("해안 코스")
    
    note = ", ".join(note_parts) if note_parts else None
    
    return NormalizedCourse(
        course_name=course_name,
        description=description,
        length_km=length_km,
        course_type=course_type,
        note=note,
        difficulty=difficulty,
        elevation='업힐' if '업힐' in raw_name else '평지',
        region_tags=region_tags,
        district_tags=district_tags,
        neighborhood_tags=neighborhood_tags,
        natural_tags=natural_tags,
        tags=tags
    )

def process_all_courses() -> List[Dict]:
    """
    모든 코스 데이터 정제 (같은 코스명은 태그만 병합)
    같은 코스(예: 안양천)가 여러 지역에 나타나면 하나로 통합하고 태그만 추가
    """
    # 코스명을 키로 하는 딕셔너리 (같은 코스 통합용)
    courses_dict: Dict[str, Dict] = {}
    
    for city, districts in RAW_COURSES.items():
        for district, courses in districts.items():
            for course_name in courses:
                # 구 정보 파싱
                parsed_district = district if district else ""
                
                # 여러 구가 합쳐진 경우 처리
                if '/' in parsed_district:
                    districts_list = parsed_district.split('/')
                    for d in districts_list:
                        normalized = normalize_course(city, d.strip(), course_name)
                        course_dict = asdict(normalized)
                        
                        # 코스명으로 통합 (같은 코스면 태그만 병합)
                        key = normalized.course_name
                        if key in courses_dict:
                            # 기존 코스에 태그 병합
                            existing = courses_dict[key]
                            existing['region_tags'] = list(set(existing['region_tags'] + course_dict['region_tags']))
                            existing['district_tags'] = list(set(existing['district_tags'] + course_dict['district_tags']))
                            existing['neighborhood_tags'] = list(set(existing['neighborhood_tags'] + course_dict['neighborhood_tags']))
                            existing['natural_tags'] = list(set(existing['natural_tags'] + course_dict['natural_tags']))
                            existing['tags'] = list(set(existing['tags'] + course_dict['tags']))
                            
                            # city, district는 첫 번째 태그로 업데이트
                            if existing['region_tags']:
                                existing['city'] = existing['region_tags'][0]
                            if existing['district_tags']:
                                existing['district'] = existing['district_tags'][0]
                        else:
                            # 새 코스 추가
                            courses_dict[key] = course_dict
                else:
                    normalized = normalize_course(city, parsed_district, course_name)
                    course_dict = asdict(normalized)
                    
                    # 코스명으로 통합
                    key = normalized.course_name
                    if key in courses_dict:
                        # 기존 코스에 태그 병합
                        existing = courses_dict[key]
                        existing['region_tags'] = list(set(existing['region_tags'] + course_dict['region_tags']))
                        existing['district_tags'] = list(set(existing['district_tags'] + course_dict['district_tags']))
                        existing['neighborhood_tags'] = list(set(existing['neighborhood_tags'] + course_dict['neighborhood_tags']))
                        existing['natural_tags'] = list(set(existing['natural_tags'] + course_dict['natural_tags']))
                        existing['tags'] = list(set(existing['tags'] + course_dict['tags']))
                    else:
                        # 새 코스 추가
                        courses_dict[key] = course_dict
    
    # 딕셔너리를 리스트로 변환
    normalized_courses = list(courses_dict.values())
    
    return normalized_courses

if __name__ == "__main__":
    # 모든 코스 정제
    courses = process_all_courses()
    
    # JSON 파일로 저장
    with open('data/normalized_courses.json', 'w', encoding='utf-8') as f:
        json.dump(courses, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 총 {len(courses)}개의 코스가 정제되었습니다.")
    print(f"📁 저장 위치: data/normalized_courses.json")

