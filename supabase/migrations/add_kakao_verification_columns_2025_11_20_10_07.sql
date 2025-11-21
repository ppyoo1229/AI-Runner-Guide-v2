-- 카카오맵 API 검증 관련 컬럼 추가
ALTER TABLE public.running_courses_2025_11_20_10_07 
ADD COLUMN IF NOT EXISTS kakao_place_name TEXT,
ADD COLUMN IF NOT EXISTS kakao_address TEXT,
ADD COLUMN IF NOT EXISTS kakao_place_id TEXT,
ADD COLUMN IF NOT EXISTS kakao_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS kakao_verified_at TIMESTAMPTZ;