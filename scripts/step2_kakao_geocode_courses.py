#!/usr/bin/env python3
"""
STEP 2: 카카오맵 API로 정확한 좌표/지명 보정
- 카카오 키워드 검색으로 place_name, lat/lon, road_address 가져오기
- 정제된 데이터를 Supabase에 저장
"""

import json
import os
import time
import httpx
from typing import Dict, Optional, List
from supabase import create_client, Client

# 환경 변수
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not all([KAKAO_REST_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    raise ValueError("환경 변수가 설정되지 않았습니다: KAKAO_REST_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")

def search_kakao_place(course_name: str, city: str, district: str) -> Optional[Dict]:
    """
    카카오맵 키워드 검색으로 정확한 좌표와 지명 가져오기
    
    예: "신도림 안양천 트랙" → "안양천중류산책로"로 정제
    """
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    
    # 검색 쿼리 구성 (지역명 포함)
    query = f"{city} {district} {course_name}".strip()
    
    params = {
        "query": query,
        "size": 1,  # 첫 번째 결과만
        "page": 1
    }
    
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            documents = data.get("documents", [])
            if not documents:
                # 지역명 없이 재시도
                params["query"] = course_name
                response = client.get(url, headers=headers, params=params)
                response.raise_for_status()
                data = response.json()
                documents = data.get("documents", [])
            
            if documents:
                doc = documents[0]
                return {
                    "place_id": doc.get("id", ""),
                    "place_name": doc.get("place_name", course_name),
                    "address_name": doc.get("address_name", ""),
                    "road_address_name": doc.get("road_address_name", ""),
                    "category_name": doc.get("category_name", ""),
                    "x": float(doc.get("x", 0)),  # 경도
                    "y": float(doc.get("y", 0)),  # 위도
                    "phone": doc.get("phone", ""),
                }
            
            return None
            
    except Exception as e:
        print(f"❌ 카카오맵 검색 실패 ({course_name}): {e}")
        return None

def geocode_courses_from_file(input_file: str = "data/normalized_courses.json"):
    """정제된 코스 데이터를 카카오맵으로 보정"""
    
    # 정제된 코스 데이터 로드
    with open(input_file, 'r', encoding='utf-8') as f:
        courses = json.load(f)
    
    # Supabase 클라이언트
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    results = []
    success_count = 0
    fail_count = 0
    
    for idx, course in enumerate(courses, 1):
        print(f"[{idx}/{len(courses)}] 처리 중: {course['course_name']}")
        
        # 카카오맵 검색
        kakao_info = search_kakao_place(
            course['course_name'],
            course['city'],
            course['district']
        )
        
        if kakao_info:
            # Supabase에 저장
            try:
                # 기존 코스 확인 (이름으로)
                existing = supabase.table('running_courses_2025_11_19_10_42')\
                    .select('id')\
                    .eq('name', course['course_name'])\
                    .limit(1)\
                    .execute()
                
                course_data = {
                    "name": kakao_info['place_name'],  # 카카오맵에서 정제된 이름
                    "description": course['description'],
                    "start_lat": kakao_info['y'],
                    "start_lng": kakao_info['x'],
                    "distance_km": course.get('length_km', 3.0),
                    "city": course['city'],
                    "district": course['district'],
                    "course_type": course['course_type'],
                    "note": course.get('note'),
                    "difficulty_level": course.get('difficulty', 'medium'),
                    "tags": course.get('tags', []),
                    "kakao_course_name": kakao_info['place_name'],
                    "kakao_course_info": kakao_info,
                    "kakao_place_id": kakao_info['place_id'],
                    "kakao_address": kakao_info['road_address_name'] or kakao_info['address_name'],
                    "kakao_verified": True,
                    "kakao_verified_at": "now()",
                    # 임시 polyline (나중에 실제 경로로 업데이트)
                    "polyline": "temp",
                    "estimated_duration_minutes": int((course.get('length_km', 3.0) or 3.0) * 9),  # 9분/km 가정
                }
                
                if existing.data:
                    # 업데이트
                    supabase.table('running_courses_2025_11_19_10_42')\
                        .update(course_data)\
                        .eq('id', existing.data[0]['id'])\
                        .execute()
                    print(f"  ✅ 업데이트: {kakao_info['place_name']}")
                else:
                    # 새로 생성
                    supabase.table('running_courses_2025_11_19_10_42')\
                        .insert(course_data)\
                        .execute()
                    print(f"  ✅ 생성: {kakao_info['place_name']}")
                
                success_count += 1
                results.append({
                    "original": course['course_name'],
                    "verified": kakao_info['place_name'],
                    "status": "success"
                })
                
            except Exception as e:
                print(f"  ❌ DB 저장 실패: {e}")
                fail_count += 1
                results.append({
                    "original": course['course_name'],
                    "status": "db_error",
                    "error": str(e)
                })
        else:
            print(f"  ⚠️ 카카오맵 검색 결과 없음")
            fail_count += 1
            results.append({
                "original": course['course_name'],
                "status": "not_found"
            })
        
        # API 호출 제한 방지 (초당 2회)
        time.sleep(0.5)
    
    # 결과 저장
    with open('data/kakao_geocode_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 완료!")
    print(f"  성공: {success_count}개")
    print(f"  실패: {fail_count}개")
    print(f"📁 결과 저장: data/kakao_geocode_results.json")

if __name__ == "__main__":
    geocode_courses_from_file()

