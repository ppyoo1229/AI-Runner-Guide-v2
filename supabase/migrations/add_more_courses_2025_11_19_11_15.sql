-- 추가 러닝 코스 데이터 삽입
-- 생성일: 2025-11-19 11:15

-- 크루 러닝 정보를 위한 컬럼 추가
ALTER TABLE public.running_courses_2025_11_19_10_42 
ADD COLUMN IF NOT EXISTS crew_friendly BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_group_size INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parking_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS facilities TEXT[] DEFAULT '{}';

-- 더 많은 러닝 코스 데이터 삽입
INSERT INTO public.running_courses_2025_11_19_10_42 (
    name, description, start_lat, start_lng, polyline, distance_km, estimated_duration_minutes,
    difficulty_level, elevation_gain_m, intersections_count, traffic_lights_count,
    lighting_score, park_water_score, beginner_score, tags, crew_friendly, max_group_size, 
    parking_available, facilities
) VALUES
-- 잠실 10km 코스들
(
    '잠실 한강공원 10km 크루 코스',
    '잠실 한강공원을 중심으로 한 10km 장거리 코스입니다. 넓은 공간으로 크루 러닝에 최적화되어 있습니다.',
    37.5145, 127.0827,
    'encoded_polyline_10km_jamsil',
    10.2, 85,
    'medium', 15, 5, 3,
    0.9, 0.9, 82.5,
    ARRAY['잠실', '한강', '10km', '크루러닝', '장거리', '안전'],
    true, 20, true,
    ARRAY['주차장', '화장실', '편의점', '음수대']
),
(
    '잠실 올림픽공원 연계 10km',
    '잠실역에서 시작해 올림픽공원을 거쳐 한강까지 이어지는 10km 코스입니다.',
    37.5145, 127.1027,
    'encoded_polyline_10km_jamsil_olympic',
    10.5, 88,
    'medium', 25, 8, 4,
    0.8, 0.9, 79.3,
    ARRAY['잠실', '올림픽공원', '10km', '연계코스', '중급'],
    true, 15, true,
    ARRAY['지하철역', '주차장', '화장실', '카페']
),

-- 서울 주요 10km+ 코스들
(
    '한강 마라톤 코스 (여의도-반포)',
    '여의도에서 반포까지 이어지는 한강 마라톤 코스입니다. 크루 러닝과 대회 준비에 적합합니다.',
    37.5265, 126.9240,
    'encoded_polyline_hangang_marathon',
    12.8, 105,
    'medium', 8, 6, 4,
    0.9, 0.8, 85.7,
    ARRAY['한강', '마라톤', '12km', '크루러닝', '대회준비'],
    true, 30, true,
    ARRAY['주차장', '화장실', '샤워시설', '음수대', '의무실']
),
(
    '남산 둘레길 완주 코스',
    '남산을 한 바퀴 도는 완전한 둘레길 코스입니다. 경치가 좋아 크루 러닝에 인기가 높습니다.',
    37.5512, 126.9882,
    'encoded_polyline_namsan_full',
    7.8, 68,
    'medium', 120, 12, 8,
    0.7, 0.8, 75.2,
    ARRAY['남산', '둘레길', '8km', '경치', '언덕', '크루러닝'],
    true, 12, false,
    ARRAY['화장실', '음수대', '벤치']
),

-- 부산 코스들
(
    '해운대 해변 10km 코스',
    '해운대 해변을 따라 달리는 10km 코스입니다. 바다 경치와 함께 즐기는 러닝.',
    35.1588, 129.1603,
    'encoded_polyline_haeundae_10km',
    10.1, 82,
    'easy', 5, 8, 6,
    0.8, 0.9, 88.5,
    ARRAY['해운대', '해변', '10km', '바다', '부산', '크루러닝'],
    true, 25, true,
    ARRAY['주차장', '화장실', '샤워시설', '카페', '편의점']
),
(
    '광안리 해변 5km 야간 코스',
    '광안리 해변의 아름다운 야경을 감상하며 달리는 5km 코스입니다.',
    35.1532, 129.1186,
    'encoded_polyline_gwangalli_5km',
    5.2, 42,
    'easy', 3, 4, 3,
    0.95, 0.9, 91.2,
    ARRAY['광안리', '해변', '5km', '야경', '부산', '야간러닝'],
    true, 15, true,
    ARRAY['주차장', '화장실', '카페', '음수대']
),

-- 대구 코스들
(
    '대구 수성못 둘레 코스',
    '대구 수성못을 중심으로 한 아름다운 둘레 코스입니다.',
    35.8242, 128.6308,
    'encoded_polyline_suseong_lake',
    3.8, 32,
    'easy', 8, 3, 2,
    0.8, 0.9, 89.1,
    ARRAY['대구', '수성못', '4km', '호수', '둘레길'],
    true, 20, true,
    ARRAY['주차장', '화장실', '음수대', '벤치']
),

-- 대전 코스들
(
    '대전 갑천 자전거길 러닝 코스',
    '갑천을 따라 이어지는 평탄한 러닝 코스입니다. 장거리 러닝에 적합합니다.',
    36.3398, 127.3940,
    'encoded_polyline_gapcheon_river',
    8.5, 70,
    'easy', 12, 4, 3,
    0.7, 0.8, 86.3,
    ARRAY['대전', '갑천', '8km', '강변', '평탄'],
    true, 18, true,
    ARRAY['주차장', '화장실', '음수대']
),

-- 광주 코스들
(
    '광주 5·18 기념공원 코스',
    '5·18 기념공원을 중심으로 한 의미 있는 러닝 코스입니다.',
    35.1467, 126.9270,
    'encoded_polyline_518_park',
    4.2, 36,
    'easy', 15, 5, 3,
    0.8, 0.8, 84.7,
    ARRAY['광주', '기념공원', '4km', '역사', '공원'],
    true, 15, true,
    ARRAY['주차장', '화장실', '기념관']
),

-- 인천 코스들
(
    '인천 송도 센트럴파크 10km',
    '송도 센트럴파크를 중심으로 한 현대적인 10km 코스입니다.',
    37.3894, 126.6564,
    'encoded_polyline_songdo_10km',
    10.3, 84,
    'easy', 8, 6, 4,
    0.9, 0.9, 90.1,
    ARRAY['인천', '송도', '10km', '센트럴파크', '현대적'],
    true, 25, true,
    ARRAY['주차장', '화장실', '카페', '편의점', '샤워시설']
),

-- 울산 코스들
(
    '울산 태화강 국가정원 코스',
    '태화강 국가정원을 따라 달리는 자연 친화적 코스입니다.',
    35.5372, 129.3414,
    'encoded_polyline_taehwa_river',
    6.8, 56,
    'easy', 10, 4, 2,
    0.8, 0.95, 87.9,
    ARRAY['울산', '태화강', '7km', '국가정원', '자연'],
    true, 20, true,
    ARRAY['주차장', '화장실', '정원', '음수대']
),

-- 제주 코스들
(
    '제주 올레길 연계 해안 코스',
    '제주 올레길과 연계된 아름다운 해안 러닝 코스입니다.',
    33.2452, 126.5653,
    'encoded_polyline_jeju_coastal',
    9.2, 78,
    'medium', 45, 3, 1,
    0.6, 0.95, 82.4,
    ARRAY['제주', '올레길', '9km', '해안', '경치'],
    true, 12, true,
    ARRAY['주차장', '화장실', '카페']
),

-- 크루 러닝 특화 코스들
(
    '서울숲 크루 러닝 특화 코스',
    '서울숲 내부와 주변을 연결한 크루 러닝 전용 코스입니다. 그룹 활동에 최적화되어 있습니다.',
    37.5443, 127.0374,
    'encoded_polyline_seoul_forest_crew',
    5.5, 46,
    'easy', 12, 4, 3,
    0.8, 0.9, 88.3,
    ARRAY['서울숲', '5km', '크루러닝', '그룹활동', '공원'],
    true, 30, true,
    ARRAY['주차장', '화장실', '카페', '음수대', '그룹휴게소']
),
(
    '여의도 한강공원 크루 집결 코스',
    '여의도 한강공원에서 시작하는 크루 러닝 집결지 코스입니다. 대규모 그룹 수용 가능합니다.',
    37.5265, 126.9240,
    'encoded_polyline_yeouido_crew_hub',
    7.2, 58,
    'easy', 5, 3, 2,
    0.9, 0.8, 91.5,
    ARRAY['여의도', '한강', '7km', '크루허브', '대규모그룹'],
    true, 50, true,
    ARRAY['대형주차장', '화장실', '샤워시설', '편의점', '그룹휴게공간', '음향시설']
);

-- 전국 주요 도시 가로등 정보 추가 (샘플)
INSERT INTO public.street_lights_2025_11_19_10_42 (management_number, latitude, longitude, district) VALUES
-- 부산
('해운대해변-01', 35.1588, 129.1603, '해운대구'),
('해운대해변-02', 35.1590, 129.1605, '해운대구'),
('광안리해변-01', 35.1532, 129.1186, '수영구'),
('광안리해변-02', 35.1534, 129.1188, '수영구'),

-- 대구
('수성못둘레-01', 35.8242, 128.6308, '수성구'),
('수성못둘레-02', 35.8244, 128.6310, '수성구'),

-- 대전
('갑천변-01', 36.3398, 127.3940, '유성구'),
('갑천변-02', 36.3400, 127.3942, '유성구'),

-- 인천
('송도센트럴파크-01', 37.3894, 126.6564, '연수구'),
('송도센트럴파크-02', 37.3896, 126.6566, '연수구'),

-- 제주
('제주해안도로-01', 33.2452, 126.5653, '제주시'),
('제주해안도로-02', 33.2454, 126.5655, '제주시')
ON CONFLICT (management_number) DO NOTHING;