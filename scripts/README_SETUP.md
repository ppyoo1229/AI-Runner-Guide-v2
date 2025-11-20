# 환경 설정 및 실행 가이드

## 환경 변수 설정

모든 스크립트는 다음 환경 변수가 필요합니다:

- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase 서비스 역할 키
- `KAKAO_REST_API_KEY`: 카카오맵 REST API 키
- `PUBLIC_DATA_API_KEY`: 공공데이터 API 키

## 빠른 시작

### 방법 1: PowerShell 스크립트 사용 (권장)

```powershell
# 전체 파이프라인 실행
.\scripts\run_all.ps1

# 또는 단계별 실행
.\scripts\run_step2.ps1  # STEP 2: 카카오맵 좌표 보정
.\scripts\run_step3.ps1  # STEP 3: 안전데이터 적재
.\scripts\run_step4.ps1  # STEP 4: 코스 × 안전데이터 매핑
```

### 방법 2: 수동 환경 변수 설정 후 실행

```powershell
# 1. 환경 변수 설정
.\scripts\setup_env.ps1

# 2. 환경 변수 확인
python scripts/test_env.py

# 3. 스크립트 실행
python scripts/step1_normalize_course_data.py
python scripts/step2_kakao_geocode_courses.py
python scripts/step2_update_region_tags_from_kakao.py
python scripts/step3_load_safety_data.py
python scripts/step4_compute_course_safety_mapping.py
```

## 파이프라인 단계

### STEP 1: 코스 데이터 정규화
```powershell
python scripts/step1_normalize_course_data.py
```
- 원본 코스 데이터를 정규화된 형식으로 변환
- `data/normalized_courses.json` 파일 생성

### STEP 2: 카카오맵 API로 좌표 보정
```powershell
python scripts/step2_kakao_geocode_courses.py
```
- 카카오맵 키워드 검색으로 정확한 좌표/주소 추출
- Supabase DB에 저장

### STEP 2.5: 지역 태그 업데이트
```powershell
python scripts/step2_update_region_tags_from_kakao.py
```
- 카카오맵 주소 정보로부터 지역 태그 보완

### STEP 3: 안전데이터 적재
```powershell
python scripts/step3_load_safety_data.py
```
- 공공데이터 API에서 가로등/보안등 데이터 로드
- Supabase `safety_points` 테이블에 저장

### STEP 4: 코스 × 안전데이터 매핑 계산
```powershell
python scripts/step4_compute_course_safety_mapping.py
```
- 각 코스 중심 좌표 기준 반경 내 안전데이터 집계
- `safe_light_score`, `safe_area_score` 등 계산
- `running_courses` 테이블에 업데이트

## 현재 설정된 값

- **Supabase URL**: https://vgpmomzotvczxuldurei.supabase.co
- **Kakao API Key**: 5a0b6484a32d4ae3f9f9ebe3d2ce0ac1
- **Public Data API Key**: OLgszcwJfXCjuy1X+Kih8aTmprkibbu70aug3deMVGtzWhoc/Ss++kbhLuBxE7Okc0Ai2zQ8xYKhtvZ3P4ARsA==

## 문제 해결

### 환경 변수가 설정되지 않음
```powershell
.\scripts\setup_env.ps1
python scripts/test_env.py
```

### API 호출 실패
- 카카오맵 API 키 확인: https://developers.kakao.com/
- 공공데이터 API 키 확인: https://www.data.go.kr/
- 네트워크 연결 확인

### 데이터베이스 연결 실패
- Supabase 프로젝트 URL 확인
- Service Role Key 확인 (Supabase Dashboard > Settings > API)

