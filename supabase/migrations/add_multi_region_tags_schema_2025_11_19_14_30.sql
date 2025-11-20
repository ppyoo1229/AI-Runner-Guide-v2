-- 다중 지역 태그 구조 추가
-- 생성일: 2025-11-19 14:30
-- 같은 코스가 여러 지역에 속할 수 있도록 배열 태그 구조 사용

-- 기존 단일 지역 컬럼을 배열 태그로 확장
ALTER TABLE public.running_courses_2025_11_19_10_42 
ADD COLUMN IF NOT EXISTS region_tags TEXT[] DEFAULT '{}',  -- 시/도 태그 (예: ["서울", "경기"])
ADD COLUMN IF NOT EXISTS district_tags TEXT[] DEFAULT '{}',  -- 시/군/구 태그 (예: ["구로구", "광명시", "안양시"])
ADD COLUMN IF NOT EXISTS neighborhood_tags TEXT[] DEFAULT '{}',  -- 동 단위 태그 (예: ["석수3동", "박달동"])
ADD COLUMN IF NOT EXISTS natural_tags TEXT[] DEFAULT '{}';  -- 자연 지형 태그 (예: ["하천", "공원"])

-- 기존 단일 컬럼은 유지하되, 배열 태그가 우선
-- city, district는 첫 번째 태그로 자동 설정되거나, 배열 태그가 없을 때만 사용

-- 인덱스 생성 (배열 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_running_courses_region_tags_2025_11_19_14_30 
ON public.running_courses_2025_11_19_10_42 USING GIN(region_tags);

CREATE INDEX IF NOT EXISTS idx_running_courses_district_tags_2025_11_19_14_30 
ON public.running_courses_2025_11_19_10_42 USING GIN(district_tags);

CREATE INDEX IF NOT EXISTS idx_running_courses_neighborhood_tags_2025_11_19_14_30 
ON public.running_courses_2025_11_19_10_42 USING GIN(neighborhood_tags);

CREATE INDEX IF NOT EXISTS idx_running_courses_natural_tags_2025_11_19_14_30 
ON public.running_courses_2025_11_19_10_42 USING GIN(natural_tags);

-- 복합 인덱스 (자주 사용되는 검색 패턴)
CREATE INDEX IF NOT EXISTS idx_running_courses_region_district_2025_11_19_14_30 
ON public.running_courses_2025_11_19_10_42 USING GIN(region_tags, district_tags);

-- 코멘트 추가
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.region_tags IS '시/도 태그 배열 (예: ["서울", "경기"])';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.district_tags IS '시/군/구 태그 배열 (예: ["구로구", "광명시", "안양시"])';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.neighborhood_tags IS '동 단위 태그 배열 (예: ["석수3동", "박달동"])';
COMMENT ON COLUMN public.running_courses_2025_11_19_10_42.natural_tags IS '자연 지형 태그 배열 (예: ["하천", "공원"])';

-- 기존 city, district 컬럼을 배열 태그의 첫 번째 값으로 자동 설정하는 함수 (선택사항)
CREATE OR REPLACE FUNCTION sync_city_district_from_tags()
RETURNS TRIGGER AS $$
BEGIN
    -- region_tags가 있으면 첫 번째 값을 city로 설정
    IF array_length(NEW.region_tags, 1) > 0 AND NEW.city IS NULL THEN
        NEW.city := NEW.region_tags[1];
    END IF;
    
    -- district_tags가 있으면 첫 번째 값을 district로 설정
    IF array_length(NEW.district_tags, 1) > 0 AND NEW.district IS NULL THEN
        NEW.district := NEW.district_tags[1];
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER sync_city_district_tags_2025_11_19_14_30
    BEFORE INSERT OR UPDATE ON public.running_courses_2025_11_19_10_42
    FOR EACH ROW
    EXECUTE FUNCTION sync_city_district_from_tags();

