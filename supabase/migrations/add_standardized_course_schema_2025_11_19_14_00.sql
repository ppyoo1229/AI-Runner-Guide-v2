-- 표준화된 러닝코스 스키마 추가
-- 생성일: 2025-11-19 14:00

-- 표준화된 코스 정보 컬럼 추가
ALTER TABLE public.running_courses_2025_11_19_10_42 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS district TEXT,
ADD COLUMN IF NOT EXISTS course_type TEXT, -- 하천, 공원, 트랙, 산책로, 업힐, 운동장 등
ADD COLUMN IF NOT EXISTS note TEXT; -- 비고 (출입제한, 주차여부 등)

-- 안전데이터 사전 계산 결과 컬럼 추가
ALTER TABLE public.running_courses_2025_11_19_10_42 
ADD COLUMN IF NOT EXISTS safe_light_score DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS safe_area_score DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS avg_light_density DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS avg_crime_index DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS recommendation_weight DECIMAL(5,2) DEFAULT 0.0;

-- 카카오맵 보정 정보 컬럼 (이미 있으면 스킵)
ALTER TABLE public.running_courses_2025_11_19_10_42 
ADD COLUMN IF NOT EXISTS kakao_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS kakao_verified_at TIMESTAMP WITH TIME ZONE;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_running_courses_city_district_2025_11_19_14_00 
ON public.running_courses_2025_11_19_10_42(city, district);

CREATE INDEX IF NOT EXISTS idx_running_courses_type_2025_11_19_14_00 
ON public.running_courses_2025_11_19_10_42(course_type);

CREATE INDEX IF NOT EXISTS idx_running_courses_safe_scores_2025_11_19_14_00 
ON public.running_courses_2025_11_19_10_42(safe_light_score, safe_area_score, recommendation_weight);

-- 코멘트 추가
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.city IS '광역시/도';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.district IS '시/군/구';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.course_type IS '코스 유형: 하천, 공원, 트랙, 산책로, 업힐, 운동장 등';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.safe_light_score IS '사전 계산된 조명 안전 점수';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.safe_area_score IS '사전 계산된 지역 안전 점수';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.avg_light_density IS '평균 조명 밀도 (개/km)';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.recommendation_weight IS '추천 가중치 (종합 점수)';

-- 안전데이터 테이블 (가로등/보안등)
CREATE TABLE IF NOT EXISTS public.safety_points_2025_11_19_14_00 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    safety_score DECIMAL(5,2) DEFAULT 0.0,
    data_source TEXT NOT NULL, -- 'street_light', 'security_light', 'crime_data' 등
    region TEXT, -- 시/도
    district TEXT, -- 시/군/구
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (공간 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_safety_points_location_2025_11_19_14_00 
ON public.safety_points_2025_11_19_14_00(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_safety_points_region_2025_11_19_14_00 
ON public.safety_points_2025_11_19_14_00(region, district);

-- 공간 인덱스를 위한 PostGIS 확장 (선택사항, 필요시 활성화)
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- CREATE INDEX idx_safety_points_geom_2025_11_19_14_00 ON public.safety_points_2025_11_19_14_00 USING GIST(ST_MakePoint(longitude, latitude));

