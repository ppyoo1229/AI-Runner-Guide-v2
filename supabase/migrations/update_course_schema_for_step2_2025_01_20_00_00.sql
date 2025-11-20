-- STEP2 카카오맵 지오코딩에 맞는 테이블 스키마 업데이트
-- 생성일: 2025-01-20 00:00

-- 다중 지역 태그 컬럼 추가/변환 (JSONB 배열)
-- 기존 TEXT[] 타입이 있으면 JSONB로 변환, 없으면 생성
DO $$
BEGIN
    -- region_tags: TEXT[] -> JSONB 변환
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'running_courses_2025_11_19_10_42' 
        AND column_name = 'region_tags'
        AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE public.running_courses_2025_11_19_10_42 
        ALTER COLUMN region_tags TYPE JSONB USING to_jsonb(region_tags);
    ELSE
        ALTER TABLE public.running_courses_2025_11_19_10_42 
        ADD COLUMN IF NOT EXISTS region_tags JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- district_tags: TEXT[] -> JSONB 변환
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'running_courses_2025_11_19_10_42' 
        AND column_name = 'district_tags'
        AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE public.running_courses_2025_11_19_10_42 
        ALTER COLUMN district_tags TYPE JSONB USING to_jsonb(district_tags);
    ELSE
        ALTER TABLE public.running_courses_2025_11_19_10_42 
        ADD COLUMN IF NOT EXISTS district_tags JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- neighborhood_tags: TEXT[] -> JSONB 변환
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'running_courses_2025_11_19_10_42' 
        AND column_name = 'neighborhood_tags'
        AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE public.running_courses_2025_11_19_10_42 
        ALTER COLUMN neighborhood_tags TYPE JSONB USING to_jsonb(neighborhood_tags);
    ELSE
        ALTER TABLE public.running_courses_2025_11_19_10_42 
        ADD COLUMN IF NOT EXISTS neighborhood_tags JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- natural_tags: TEXT[] -> JSONB 변환
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'running_courses_2025_11_19_10_42' 
        AND column_name = 'natural_tags'
        AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE public.running_courses_2025_11_19_10_42 
        ALTER COLUMN natural_tags TYPE JSONB USING to_jsonb(natural_tags);
    ELSE
        ALTER TABLE public.running_courses_2025_11_19_10_42 
        ADD COLUMN IF NOT EXISTS natural_tags JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 기존 tags 컬럼이 TEXT[]인 경우 JSONB로 변환 (없으면 생성)
DO $$
BEGIN
    -- tags 컬럼이 TEXT[] 타입인 경우 JSONB로 변환
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'running_courses_2025_11_19_10_42' 
        AND column_name = 'tags'
        AND data_type = 'ARRAY'
    ) THEN
        -- TEXT[]를 JSONB로 변환
        ALTER TABLE public.running_courses_2025_11_19_10_42 
        ALTER COLUMN tags TYPE JSONB USING to_jsonb(tags);
    ELSE
        -- tags 컬럼이 없으면 JSONB로 생성
        ALTER TABLE public.running_courses_2025_11_19_10_42 
        ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 코스 타입 및 메타데이터 컬럼
ALTER TABLE public.running_courses_2025_11_19_10_42 
ADD COLUMN IF NOT EXISTS course_type TEXT,
ADD COLUMN IF NOT EXISTS difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS note TEXT;

-- polyline 컬럼 (이미 있을 수 있지만 확인)
ALTER TABLE public.running_courses_2025_11_19_10_42 
ADD COLUMN IF NOT EXISTS polyline TEXT;

-- 카카오맵 관련 컬럼 (기존 컬럼과 통합)
ALTER TABLE public.running_courses_2025_11_19_10_42 
ADD COLUMN IF NOT EXISTS kakao_course_info JSONB,
ADD COLUMN IF NOT EXISTS kakao_place_id TEXT,
ADD COLUMN IF NOT EXISTS kakao_address TEXT,
ADD COLUMN IF NOT EXISTS kakao_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS kakao_verified_at TIMESTAMP WITH TIME ZONE;

-- GIN 인덱스 생성 (JSONB 배열 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_running_courses_region_tags_2025_01_20 
ON public.running_courses_2025_11_19_10_42 USING GIN(region_tags);

CREATE INDEX IF NOT EXISTS idx_running_courses_district_tags_2025_01_20 
ON public.running_courses_2025_11_19_10_42 USING GIN(district_tags);

CREATE INDEX IF NOT EXISTS idx_running_courses_neighborhood_tags_2025_01_20 
ON public.running_courses_2025_11_19_10_42 USING GIN(neighborhood_tags);

CREATE INDEX IF NOT EXISTS idx_running_courses_natural_tags_2025_01_20 
ON public.running_courses_2025_11_19_10_42 USING GIN(natural_tags);

CREATE INDEX IF NOT EXISTS idx_running_courses_tags_2025_01_20 
ON public.running_courses_2025_11_19_10_42 USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_running_courses_kakao_course_info_2025_01_20 
ON public.running_courses_2025_11_19_10_42 USING GIN(kakao_course_info);

CREATE INDEX IF NOT EXISTS idx_running_courses_kakao_place_id_2025_01_20 
ON public.running_courses_2025_11_19_10_42(kakao_place_id);

CREATE INDEX IF NOT EXISTS idx_running_courses_course_type_2025_01_20 
ON public.running_courses_2025_11_19_10_42(course_type);

-- 코멘트 추가
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.region_tags IS '다중 지역 태그 (시/도) - JSONB 배열';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.district_tags IS '다중 지역 태그 (시/군/구) - JSONB 배열';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.neighborhood_tags IS '다중 지역 태그 (동 단위) - JSONB 배열';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.natural_tags IS '자연 지형 태그 (하천, 공원 등) - JSONB 배열';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.tags IS '카테고리 태그 - JSONB 배열';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.course_type IS '코스 유형: 하천, 공원, 트랙, 산책로, 업힐, 운동장 등';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.difficulty_level IS '난이도: easy, medium, hard';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.note IS '비고 (출입제한, 주차여부 등)';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.polyline IS '인코딩된 경로 데이터';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.kakao_course_info IS '카카오맵에서 추출한 코스 상세 정보 (JSON)';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.kakao_place_id IS '카카오맵 Place ID';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.kakao_address IS '카카오맵에서 추출한 주소';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.kakao_verified IS '카카오맵 검증 완료 여부';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.kakao_verified_at IS '카카오맵 검증 완료 시각';

