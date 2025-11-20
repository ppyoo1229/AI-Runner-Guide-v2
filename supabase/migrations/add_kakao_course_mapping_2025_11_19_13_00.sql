-- 카카오맵 코스명/정보 및 사전 계산된 안전데이터 매핑 컬럼 추가
-- 생성일: 2025-11-19 13:00

-- 카카오맵에서 추출한 코스 정보 컬럼 추가
ALTER TABLE public.running_courses_2025_11_19_10_42 
ADD COLUMN IF NOT EXISTS kakao_course_name TEXT,
ADD COLUMN IF NOT EXISTS kakao_course_info JSONB,
ADD COLUMN IF NOT EXISTS kakao_place_id TEXT,
ADD COLUMN IF NOT EXISTS kakao_address TEXT;

-- 사전 계산된 안전데이터 상세 정보 컬럼 추가
ALTER TABLE public.running_courses_2025_11_19_10_42 
ADD COLUMN IF NOT EXISTS safety_data JSONB DEFAULT '{}'::jsonb;

-- safety_data JSONB 구조:
-- {
--   "lighting": {
--     "score": 0.85,
--     "lights_count": 45,
--     "density_per_km": 18.5,
--     "data_source": "real_data"
--   },
--   "facilities": {
--     "has_parking": true,
--     "has_restroom": true,
--     "convenience_count": 3,
--     "available_facilities": ["주차장", "화장실", "편의점", "카페"]
--   },
--   "crew_analysis": {
--     "is_crew_friendly": true,
--     "max_group_size": 25,
--     "crew_score": 75
--   },
--   "calculated_at": "2025-11-19T13:00:00Z"
-- }

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_running_courses_kakao_place_id_2025_11_19_13_00 
ON public.running_courses_2025_11_19_10_42(kakao_place_id);

CREATE INDEX IF NOT EXISTS idx_running_courses_safety_data_2025_11_19_13_00 
ON public.running_courses_2025_11_19_10_42 USING GIN(safety_data);

-- 코멘트 추가
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.kakao_course_name IS '카카오맵에서 추출한 정규화된 코스명';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.kakao_course_info IS '카카오맵에서 추출한 코스 상세 정보 (JSON)';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.kakao_place_id IS '카카오맵 Place ID';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.kakao_address IS '카카오맵에서 추출한 주소';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.safety_data IS '사전 계산된 안전데이터 매핑 정보 (JSON)';

