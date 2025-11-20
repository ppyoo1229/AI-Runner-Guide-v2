#!/bin/bash
# 전체 데이터 정제 파이프라인 실행 스크립트

set -e  # 에러 발생 시 중단

echo "🚀 전국 러닝코스 데이터 정제 파이프라인 시작"
echo ""

# 환경 변수 확인
if [ -z "$KAKAO_REST_API_KEY" ] || [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ 환경 변수가 설정되지 않았습니다."
    echo "다음 환경 변수를 설정해주세요:"
    echo "  - KAKAO_REST_API_KEY"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

# STEP 1: 코스 원본 데이터 정제
echo "📌 STEP 1: 코스 원본 데이터 정제"
python scripts/step1_normalize_course_data.py
echo ""

# STEP 2: 카카오맵 API로 좌표/지명 보정
echo "📌 STEP 2: 카카오맵 API로 좌표/지명 보정"
python scripts/step2_kakao_geocode_courses.py
echo ""

# STEP 2.5: 카카오맵 주소로부터 지역 태그 업데이트
echo "📌 STEP 2.5: 카카오맵 주소로부터 지역 태그 업데이트"
python scripts/step2_update_region_tags_from_kakao.py
echo ""

# STEP 3: 안전데이터 적재
echo "📌 STEP 3: 안전데이터 적재"
python scripts/step3_load_safety_data.py
echo ""

# STEP 4: 코스 × 안전데이터 매핑 계산
echo "📌 STEP 4: 코스 × 안전데이터 매핑 계산"
python scripts/step4_compute_course_safety_mapping.py
echo ""

echo "✅ 전체 파이프라인 완료!"

