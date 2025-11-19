#!/usr/bin/env python3
"""
STEP 4: 코스 × 안전데이터 거리 기반 매핑 사전 계산
- 러닝코스 중심 좌표 기준 반경 500m~3km 안의 안전데이터 수집
- 평균/최댓값/조도 지수/빈도 계산
- safe_light_score, safe_area_score, avg_light_density 등 계산
"""

import os
import math
from typing import Dict, List, Tuple
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not all([SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    raise ValueError("환경 변수가 설정되지 않았습니다: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 좌표 간 거리 계산 (km) - Haversine 공식"""
    R = 6371  # 지구 반지름 (km)
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (
        math.sin(dlat / 2) ** 2 +
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
        math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def get_nearby_safety_points(
    supabase: Client,
    center_lat: float,
    center_lng: float,
    radius_km: float = 3.0
) -> List[Dict]:
    """
    중심 좌표 기준 반경 내의 안전데이터 포인트 조회
    (PostGIS가 없으면 클라이언트 측에서 필터링)
    """
    # 대략적인 위도/경도 범위 계산 (간단한 버전)
    # 1도 ≈ 111km
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * math.cos(math.radians(center_lat)))
    
    # Supabase에서 범위 내 데이터 조회
    response = supabase.table('safety_points_2025_11_19_14_00')\
        .select('*')\
        .gte('latitude', center_lat - lat_delta)\
        .lte('latitude', center_lat + lat_delta)\
        .gte('longitude', center_lng - lng_delta)\
        .lte('longitude', center_lng + lng_delta)\
        .execute()
    
    # 정확한 거리 계산으로 필터링
    nearby_points = []
    for point in response.data:
        distance = calculate_distance(
            center_lat, center_lng,
            float(point['latitude']), float(point['longitude'])
        )
        if distance <= radius_km:
            point['distance_km'] = distance
            nearby_points.append(point)
    
    return nearby_points

def compute_safety_scores(
    safety_points: List[Dict],
    course_length_km: float
) -> Dict:
    """
    안전데이터로부터 코스 안전 점수 계산
    """
    if not safety_points:
        return {
            "safe_light_score": 0.0,
            "safe_area_score": 0.0,
            "avg_light_density": 0.0,
            "avg_crime_index": 0.0,
            "recommendation_weight": 0.0,
        }
    
    # 조명 관련 포인트만 필터링
    light_points = [
        p for p in safety_points
        if p['data_source'] in ['street_light', 'security_light']
    ]
    
    # 안전 점수 계산
    safety_scores = [float(p['safety_score']) for p in safety_points]
    avg_safety_score = sum(safety_scores) / len(safety_scores) if safety_scores else 0.0
    max_safety_score = max(safety_scores) if safety_scores else 0.0
    
    # 조명 밀도 계산 (개/km)
    light_density = len(light_points) / max(course_length_km, 0.5)
    
    # 조명 점수 (0~100)
    safe_light_score = min(100.0, avg_safety_score * (len(light_points) / max(len(safety_points), 1)))
    
    # 지역 안전 점수 (0~100)
    safe_area_score = min(100.0, avg_safety_score)
    
    # 평균 조명 밀도
    avg_light_density = light_density
    
    # 범죄 지수 (안전 점수의 역수, 낮을수록 좋음)
    avg_crime_index = max(0.0, 100.0 - avg_safety_score)
    
    # 추천 가중치 (종합 점수)
    recommendation_weight = (
        safe_light_score * 0.4 +
        safe_area_score * 0.3 +
        (100.0 - avg_crime_index) * 0.2 +
        min(100.0, avg_light_density * 5) * 0.1  # 밀도가 높을수록 좋음
    )
    
    return {
        "safe_light_score": round(safe_light_score, 2),
        "safe_area_score": round(safe_area_score, 2),
        "avg_light_density": round(avg_light_density, 2),
        "avg_crime_index": round(avg_crime_index, 2),
        "recommendation_weight": round(recommendation_weight, 2),
    }

def process_all_courses():
    """모든 코스에 대해 안전데이터 매핑 계산"""
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # 모든 코스 조회
    response = supabase.table('running_courses_2025_11_19_10_42')\
        .select('id, name, start_lat, start_lng, distance_km')\
        .execute()
    
    courses = response.data
    total = len(courses)
    
    print(f"📊 총 {total}개의 코스를 처리합니다...\n")
    
    success_count = 0
    fail_count = 0
    
    for idx, course in enumerate(courses, 1):
        course_id = course['id']
        course_name = course['name']
        center_lat = float(course['start_lat'])
        center_lng = float(course['start_lng'])
        course_length = float(course.get('distance_km', 3.0))
        
        print(f"[{idx}/{total}] {course_name}")
        
        try:
            # 반경 내 안전데이터 조회
            safety_points = get_nearby_safety_points(
                supabase,
                center_lat,
                center_lng,
                radius_km=3.0  # 3km 반경
            )
            
            print(f"  📍 {len(safety_points)}개의 안전 포인트 발견")
            
            # 안전 점수 계산
            safety_scores = compute_safety_scores(safety_points, course_length)
            
            # DB 업데이트
            supabase.table('running_courses_2025_11_19_10_42')\
                .update(safety_scores)\
                .eq('id', course_id)\
                .execute()
            
            print(f"  ✅ 계산 완료: weight={safety_scores['recommendation_weight']:.2f}")
            success_count += 1
            
        except Exception as e:
            print(f"  ❌ 처리 실패: {e}")
            fail_count += 1
    
    print(f"\n✅ 완료!")
    print(f"  성공: {success_count}개")
    print(f"  실패: {fail_count}개")

if __name__ == "__main__":
    process_all_courses()

