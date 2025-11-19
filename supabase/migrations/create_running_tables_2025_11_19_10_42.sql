-- AI 러너 가이드 데이터베이스 스키마
-- 생성일: 2025-11-19 10:42

-- 1. 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS public.user_profiles_2025_11_19_10_42 (
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

-- 2. 러닝 코스 테이블
CREATE TABLE IF NOT EXISTS public.running_courses_2025_11_19_10_42 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    start_lat DECIMAL(10,8) NOT NULL,
    start_lng DECIMAL(11,8) NOT NULL,
    polyline TEXT NOT NULL, -- 인코딩된 경로 데이터
    distance_km DECIMAL(5,2) NOT NULL,
    estimated_duration_minutes INTEGER NOT NULL,
    difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')) DEFAULT 'easy',
    
    -- 스코어링 지표들
    elevation_gain_m INTEGER DEFAULT 0,
    intersections_count INTEGER DEFAULT 0,
    traffic_lights_count INTEGER DEFAULT 0,
    lighting_score DECIMAL(3,2) DEFAULT 0.0 CHECK (lighting_score >= 0 AND lighting_score <= 1),
    park_water_score DECIMAL(3,2) DEFAULT 0.0 CHECK (park_water_score >= 0 AND park_water_score <= 1),
    
    -- 종합 점수
    beginner_score DECIMAL(5,2) DEFAULT 0.0 CHECK (beginner_score >= 0 AND beginner_score <= 100),
    
    -- 태그 및 키워드
    tags TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 가로등 위치 정보 테이블 (서울시 데이터 기반)
CREATE TABLE IF NOT EXISTS public.street_lights_2025_11_19_10_42 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    management_number TEXT UNIQUE NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    district TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 사용자 러닝 기록 테이블
CREATE TABLE IF NOT EXISTS public.running_records_2025_11_19_10_42 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.running_courses_2025_11_19_10_42(id) ON DELETE SET NULL,
    actual_distance_km DECIMAL(5,2),
    actual_duration_minutes INTEGER,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 사용자 즐겨찾기 코스 테이블
CREATE TABLE IF NOT EXISTS public.favorite_courses_2025_11_19_10_42 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.running_courses_2025_11_19_10_42(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id_2025_11_19_10_42 ON public.user_profiles_2025_11_19_10_42(user_id);
CREATE INDEX IF NOT EXISTS idx_running_courses_location_2025_11_19_10_42 ON public.running_courses_2025_11_19_10_42(start_lat, start_lng);
CREATE INDEX IF NOT EXISTS idx_running_courses_difficulty_2025_11_19_10_42 ON public.running_courses_2025_11_19_10_42(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_running_courses_distance_2025_11_19_10_42 ON public.running_courses_2025_11_19_10_42(distance_km);
CREATE INDEX IF NOT EXISTS idx_street_lights_location_2025_11_19_10_42 ON public.street_lights_2025_11_19_10_42(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_running_records_user_id_2025_11_19_10_42 ON public.running_records_2025_11_19_10_42(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_courses_user_id_2025_11_19_10_42 ON public.favorite_courses_2025_11_19_10_42(user_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE public.user_profiles_2025_11_19_10_42 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.running_records_2025_11_19_10_42 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_courses_2025_11_19_10_42 ENABLE ROW LEVEL SECURITY;

-- 사용자 프로필 RLS 정책
CREATE POLICY "Users can view own profile" ON public.user_profiles_2025_11_19_10_42
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles_2025_11_19_10_42
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.user_profiles_2025_11_19_10_42
    FOR UPDATE USING (auth.uid() = user_id);

-- 러닝 기록 RLS 정책
CREATE POLICY "Users can view own records" ON public.running_records_2025_11_19_10_42
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records" ON public.running_records_2025_11_19_10_42
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 즐겨찾기 RLS 정책
CREATE POLICY "Users can view own favorites" ON public.favorite_courses_2025_11_19_10_42
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites" ON public.favorite_courses_2025_11_19_10_42
    FOR ALL USING (auth.uid() = user_id);

-- 러닝 코스는 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view running courses" ON public.running_courses_2025_11_19_10_42
    FOR SELECT USING (true);

-- 가로등 정보는 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view street lights" ON public.street_lights_2025_11_19_10_42
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
CREATE TRIGGER update_user_profiles_updated_at_2025_11_19_10_42
    BEFORE UPDATE ON public.user_profiles_2025_11_19_10_42
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_running_courses_updated_at_2025_11_19_10_42
    BEFORE UPDATE ON public.running_courses_2025_11_19_10_42
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();