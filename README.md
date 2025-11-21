# Running RecSys (러닝 코스 추천 시스템)

AI 기반 러닝 코스 추천 시스템입니다. 자연어 쿼리를 통해 사용자에게 최적의 러닝 코스를 추천합니다.

## Tech Stack

### Frontend
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

### Backend
- FastAPI (Python)
- Supabase (Database + Edge Functions)
- LLM (자연어 쿼리 파싱)

## 프로젝트 구조

```
running-recsys/
├── app/                          # FastAPI 백엔드
│   ├── main.py                   # API 엔드포인트
│   ├── llm.py                    # LLM 자연어 파싱
│   ├── geo.py                    # 지오코딩 및 앵커 탐색
│   ├── routegen.py               # 루프 경로 생성
│   ├── scoring.py                # 코스 점수 계산
│   ├── utils.py                  # 유틸리티 함수
│   └── models.py                 # 데이터 모델
│
├── src/                          # React 프론트엔드
│   ├── pages/                    # 페이지 컴포넌트
│   │   └── Index.tsx             # 메인 검색 페이지
│   ├── components/               # UI 컴포넌트
│   ├── integrations/             # 외부 서비스 통합
│   │   └── supabase/             # Supabase 클라이언트
│   └── hooks/                    # React 훅
│
├── supabase/
│   ├── edge_function/            # Supabase Edge Functions
│   │   ├── find_running_courses_enhanced_*.ts    # 코스 검색 (향상된 버전)
│   │   ├── parse_running_query_enhanced_*.ts     # 자연어 파싱 (향상된 버전)
│   │   ├── precompute_course_safety_data_*.ts    # 사전 계산 배치 스크립트
│   │   └── analyze_course_real_data_*.ts         # 코스 분석 (deprecated)
│   │
│   └── migrations/               # 데이터베이스 마이그레이션
│       ├── create_running_tables_*.sql           # 테이블 생성
│       ├── add_more_courses_*.sql                 # 코스 데이터 추가
│       ├── add_nationwide_courses_final_*.sql    # 전국 코스 데이터
│       └── add_kakao_course_mapping_*.sql         # 카카오맵 매핑 컬럼 추가
│
├── data/                         # CSV 데이터 파일
│   ├── 서울시 가로등 위치 정보.csv
│   └── ...
│
└── public/                       # 정적 파일
    └── 강원교육튼튼.ttf          # 폰트 파일

## Prerequisites

Make sure your system has Node.js and npm installed.

We recommend using nvm to install Node.js: [nvm Installation Guide](https://github.com/nvm-sh/nvm#installing-and-updating)

## Install Dependencies

```sh
npm install
```

## Development Server

Start the development server with hot reload and instant preview:

```sh
npm run dev
```

## Build Project

Build for production:

```sh
npm run build
```

## Preview Build

Preview the built project:

```sh
npm run preview
```

## 주요 기능

### 1. 자연어 쿼리 파싱
- 사용자의 자연어 입력을 구조화된 검색 파라미터로 변환
- 위치, 거리, 시간대, 키워드 등을 자동 추출

### 2. 코스 검색 및 추천
- 데이터베이스에 저장된 전국 러닝 코스 검색
- 사용자 위치 기반 거리 계산
- 시간대별 조명 점수 조정
- 크루 러닝 친화성 필터링

### 3. 사전 계산된 안전 데이터
- 코스 × 카카오맵 매핑으로 코스명/정보 추출
- 가로등, 시설 등 안전데이터 사전 계산
- 실시간 API 호출 최소화

## 데이터베이스 구조

### 주요 테이블
- `running_courses_2025_11_19_10_42`: 러닝 코스 정보
- `street_lights_2025_11_19_10_42`: 가로등 위치 정보
- `user_profiles_2025_11_19_10_42`: 사용자 프로필
- `running_records_2025_11_19_10_42`: 러닝 기록

### 사전 계산 데이터
- `kakao_course_name`: 카카오맵에서 추출한 코스명
- `kakao_course_info`: 카카오맵 코스 상세 정보 (JSONB)
- `safety_data`: 사전 계산된 안전데이터 (JSONB)
  - 조명 점수 및 밀도
  - 주변 시설 정보
  - 크루 러닝 친화성 분석

## 배치 작업

### 사전 계산 스크립트 실행
모든 코스에 대해 안전데이터를 사전 계산:

```typescript
POST /precompute_course_safety_data_2025_11_19_13_00
{
  "batch_mode": true
}
```

단일 코스 계산:

```typescript
POST /precompute_course_safety_data_2025_11_19_13_00
{
  "course_id": "uuid-here"
}
```

## 환경 변수

### Frontend
- `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
- `VITE_SUPABASE_ANON_KEY`: Supabase 익명 키

### Backend (FastAPI)
- `KAKAO_REST_API_KEY`: 카카오 REST API 키
- `LAMPS_CSV`: 가로등 CSV 파일 경로

### Supabase Edge Functions
- `KAKAO_REST_API_KEY`: 카카오 REST API 키
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase 서비스 역할 키

## 데이터 정제 파이프라인

전국 러닝코스 데이터를 정제하고 안전데이터와 매핑하는 파이프라인

### 실행 방법

```bash
# 1. 의존성 설치
pip install -r scripts/requirements.txt

# 2. 환경 변수 설정
export KAKAO_REST_API_KEY="your_key"
export SUPABASE_URL="your_url"
export SUPABASE_SERVICE_ROLE_KEY="your_key"

# 3. 전체 파이프라인 실행
bash scripts/run_all_steps.sh

# 또는 단계별 실행
python scripts/step1_normalize_course_data.py  # STEP 1: 데이터 정제
python scripts/step2_kakao_geocode_courses.py  # STEP 2: 카카오맵 좌표 보정
python scripts/step3_load_safety_data.py        # STEP 3: 안전데이터 적재
python scripts/step4_compute_course_safety_mapping.py  # STEP 4: 매핑 계산
```

### 파이프라인 단계

1. **STEP 1: 원본 데이터 정제**
   - 코스 이름 표준화
   - 시/도, 시/군/구 추출
   - 거리, 유형, 난이도 정보 추출
   - 카테고리 태그 생성

2. **STEP 2: 카카오맵 좌표 보정**
   - 카카오맵 키워드 검색으로 정확한 좌표 추출
   - 공식 지명으로 정제 (예: "신도림 안양천 트랙" → "안양천중류산책로")
   - Supabase에 저장

3. **STEP 3: 안전데이터 적재**
   - CSV 파일에서 가로등/보안등 데이터 로드
   - 안전 점수 계산
   - `safety_points_2025_11_19_14_00` 테이블에 저장

4. **STEP 4: 코스 × 안전데이터 매핑**
   - 각 코스 중심 좌표 기준 반경 3km 내 안전데이터 수집
   - `safe_light_score`, `safe_area_score`, `avg_light_density` 등 계산
   - 코스 테이블에 사전 계산된 점수 저장

### 결과

- **실시간 계산 없음**: 모든 안전 점수는 사전 계산되어 DB에 저장
- **빠른 검색**: 지역/거리 필터링만으로 즉시 결과 반환
- **정확한 좌표**: 카카오맵 API로 보정된 정확한 위치 정보