-- AI 러너 가이드 데이터베이스 스키마
-- 생성일: 2025-11-20 10:07

-- 1. 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS public.user_profiles_2025_11_20_10_07 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    running_level TEXT CHECK (running_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
    preferred_distance_km DECIMAL(4,2) DEFAULT 3.0,
    preferred_time_minutes INTEGER DEFAULT 30,
    preferred_time_of_day TEXT CHECK (preferred_time_of_day IN ('morning', 'afternoon', 'evening', 'night')) DEFAULT 'morning',
    safety_priority INTEGER DEFAULT 5 CHECK (safety_priority >= 1 AND safety_priority <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 러닝 코스 테이블 (다중 지역 태그 지원)
CREATE TABLE IF NOT EXISTS public.running_courses_2025_11_20_10_07 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    start_lat DECIMAL(10,8) NOT NULL,
    start_lng DECIMAL(11,8) NOT NULL,
    polyline TEXT DEFAULT 'temp',
    distance_km DECIMAL(5,2) NOT NULL,
    estimated_duration_minutes INTEGER NOT NULL,
    
    -- 지역 정보
    city TEXT,
    district TEXT,
    course_type TEXT, -- 하천, 공원, 트랙, 산책로, 업힐, 운동장 등
    note TEXT, -- 비고
    has_uphill BOOLEAN DEFAULT false,
    
    -- 다중 지역 태그 (JSONB 배열)
    region_tags JSONB DEFAULT '[]'::jsonb,  -- 시/도 태그
    district_tags JSONB DEFAULT '[]'::jsonb,  -- 시/군/구 태그
    neighborhood_tags JSONB DEFAULT '[]'::jsonb,  -- 동 단위 태그
    natural_tags JSONB DEFAULT '[]'::jsonb,  -- 자연 지형 태그
    tags JSONB DEFAULT '[]'::jsonb,  -- 카테고리 태그
    
    -- 카카오맵 보정 정보
    kakao_course_name TEXT,
    kakao_course_info JSONB,
    kakao_place_id TEXT,
    kakao_address TEXT,
    kakao_verified BOOLEAN DEFAULT false,
    kakao_verified_at TIMESTAMPTZ,
    
    -- 안전데이터 사전 계산 결과
    safe_light_score DECIMAL(5,2) DEFAULT 0.0,
    safe_area_score DECIMAL(5,2) DEFAULT 0.0,
    avg_light_density DECIMAL(5,2) DEFAULT 0.0,
    avg_crime_index DECIMAL(5,2) DEFAULT 0.0,
    recommendation_weight DECIMAL(5,2) DEFAULT 0.0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 안전데이터 포인트 테이블
CREATE TABLE IF NOT EXISTS public.safety_points_2025_11_20_10_07 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    safety_score DECIMAL(5,2) DEFAULT 0.0,
    data_source TEXT NOT NULL, -- 'street_light', 'security_light', 'crime_data' 등
    region TEXT, -- 시/도
    district TEXT, -- 시/군/구
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 사용자 러닝 기록 테이블
CREATE TABLE IF NOT EXISTS public.running_records_2025_11_20_10_07 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.running_courses_2025_11_20_10_07(id) ON DELETE SET NULL,
    actual_distance_km DECIMAL(5,2),
    actual_duration_minutes INTEGER,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 사용자 즐겨찾기 코스 테이블
CREATE TABLE IF NOT EXISTS public.favorite_courses_2025_11_20_10_07 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.running_courses_2025_11_20_10_07(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id_2025_11_20_10_07 ON public.user_profiles_2025_11_20_10_07(user_id);
CREATE INDEX IF NOT EXISTS idx_running_courses_location_2025_11_20_10_07 ON public.running_courses_2025_11_20_10_07(start_lat, start_lng);
CREATE INDEX IF NOT EXISTS idx_running_courses_city_district_2025_11_20_10_07 ON public.running_courses_2025_11_20_10_07(city, district);
CREATE INDEX IF NOT EXISTS idx_running_courses_type_2025_11_20_10_07 ON public.running_courses_2025_11_20_10_07(course_type);
CREATE INDEX IF NOT EXISTS idx_running_courses_distance_2025_11_20_10_07 ON public.running_courses_2025_11_20_10_07(distance_km);

-- JSONB 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_running_courses_region_tags_2025_11_20_10_07 ON public.running_courses_2025_11_20_10_07 USING GIN(region_tags);
CREATE INDEX IF NOT EXISTS idx_running_courses_district_tags_2025_11_20_10_07 ON public.running_courses_2025_11_20_10_07 USING GIN(district_tags);
CREATE INDEX IF NOT EXISTS idx_running_courses_natural_tags_2025_11_20_10_07 ON public.running_courses_2025_11_20_10_07 USING GIN(natural_tags);
CREATE INDEX IF NOT EXISTS idx_running_courses_tags_2025_11_20_10_07 ON public.running_courses_2025_11_20_10_07 USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_safety_points_location_2025_11_20_10_07 ON public.safety_points_2025_11_20_10_07(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_running_records_user_id_2025_11_20_10_07 ON public.running_records_2025_11_20_10_07(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_courses_user_id_2025_11_20_10_07 ON public.favorite_courses_2025_11_20_10_07(user_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE public.user_profiles_2025_11_20_10_07 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.running_records_2025_11_20_10_07 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_courses_2025_11_20_10_07 ENABLE ROW LEVEL SECURITY;

-- 사용자 프로필 RLS 정책
CREATE POLICY "Users can view own profile" ON public.user_profiles_2025_11_20_10_07
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles_2025_11_20_10_07
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.user_profiles_2025_11_20_10_07
    FOR UPDATE USING (auth.uid() = user_id);

-- 러닝 기록 RLS 정책
CREATE POLICY "Users can view own records" ON public.running_records_2025_11_20_10_07
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records" ON public.running_records_2025_11_20_10_07
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 즐겨찾기 RLS 정책
CREATE POLICY "Users can view own favorites" ON public.favorite_courses_2025_11_20_10_07
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites" ON public.favorite_courses_2025_11_20_10_07
    FOR ALL USING (auth.uid() = user_id);

-- 러닝 코스는 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view running courses" ON public.running_courses_2025_11_20_10_07
    FOR SELECT USING (true);

-- 안전데이터는 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view safety points" ON public.safety_points_2025_11_20_10_07
    FOR SELECT USING (true);

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_user_profiles_updated_at_2025_11_20_10_07
    BEFORE UPDATE ON public.user_profiles_2025_11_20_10_07
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_running_courses_updated_at_2025_11_20_10_07
    BEFORE UPDATE ON public.running_courses_2025_11_20_10_07
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();