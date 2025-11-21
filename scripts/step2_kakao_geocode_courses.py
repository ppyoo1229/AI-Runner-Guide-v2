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
from typing import Dict, Optional, List, Any
from supabase import create_client, Client

# 환경 변수 (앞뒤 공백 제거)
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY", "").strip()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

if not all([KAKAO_REST_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    raise ValueError("환경 변수가 설정되지 않았습니다: KAKAO_REST_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")

# API 키 유효성 사전 확인
if len(KAKAO_REST_API_KEY) < 10:
    raise ValueError(f"KAKAO_REST_API_KEY가 너무 짧습니다 (길이: {len(KAKAO_REST_API_KEY)})")

def ensure_list(value: Any) -> List[str]:
    """
    JSONB 배열 컬럼에 넣기 전에 Python 리스트로 보정
    - None -> []
    - 문자열(JSON) -> 파싱
    - 단일 문자열 -> [value]
    """
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []
        try:
            # JSON 배열 문자열인 경우
            parsed = json.loads(stripped)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass
        return [stripped]
    return [value]


def search_kakao_place(course_name: str, city: str, district: str) -> Optional[Dict]:
    """
    카카오맵 키워드 검색으로 정확한 좌표와 지명 가져오기
    
    예: "신도림 안양천 트랙" → "안양천중류산책로"로 정제
    """
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    
    # API 키 정제 (앞뒤 공백 제거, 숨은 문자 제거)
    api_key_clean = KAKAO_REST_API_KEY.strip()
    
    # Authorization 헤더 정확한 형식으로 생성
    # 형식: "KakaoAK {REST_API_KEY}" (공백 1개)
    auth_header = f"KakaoAK {api_key_clean}"
    
    # HTTP 헤더 강화 (User-Agent 필수 - 봇 차단 방지)
    headers = {
        "Authorization": auth_header,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    # 검색 쿼리 구성 개선 (city/district 파싱 오류로 인한 오염 방지)
    # 옵션 B: city/district가 유효할 때만 포함
    query_items = [course_name]
    if city and city.strip() and city.strip() not in ["", "None", "null"]:
        query_items.append(city.strip())
    if district and district.strip() and district.strip() not in ["", "None", "null"]:
        query_items.append(district.strip())
    
    query = " ".join(query_items).strip()
    
    params = {
        "query": query,
        "size": 1,  # 첫 번째 결과만
        "page": 1
    }
    
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, headers=headers, params=params)
            
            # 에러 응답 상세 확인
            if response.status_code != 200:
                error_detail = response.text
                print(f"  ⚠️ 카카오 API 오류 ({response.status_code}): {error_detail[:200]}")
                # 401 Unauthorized인 경우 헤더 형식 문제 가능성
                if response.status_code == 401:
                    print(f"  🔍 Authorization 헤더 확인 필요")
                    print(f"     헤더 값: {auth_header[:20]}... (길이: {len(auth_header)})")
                    print(f"     API 키 길이: {len(api_key_clean)}")
                elif response.status_code == 403:
                    print(f"  🔍 403 Forbidden - API 호출 제한 또는 봇 차단 가능성")
                    print(f"     User-Agent: {headers.get('User-Agent', 'N/A')[:50]}...")
                    print(f"     쿼리: {query[:50]}...")
                
                response.raise_for_status()
            
            data = response.json()
            
            documents = data.get("documents", [])
            if not documents:
                # 지역명 없이 재시도 (코스명만으로 검색)
                params["query"] = course_name.strip()
                response = client.get(url, headers=headers, params=params)
                
                # 재시도 시에도 에러 확인
                if response.status_code != 200:
                    error_detail = response.text
                    print(f"  ⚠️ 재시도 중 카카오 API 오류 ({response.status_code}): {error_detail[:200]}")
                    if response.status_code == 401:
                        print(f"  🔍 Authorization 헤더 확인 필요 (재시도)")
                    elif response.status_code == 403:
                        print(f"  🔍 403 Forbidden - API 호출 제한 또는 봇 차단 가능성")
                        print(f"     User-Agent: {headers.get('User-Agent', 'N/A')[:50]}...")
                
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
            
    except httpx.HTTPStatusError as e:
        # HTTP 상태 코드 오류
        error_detail = ""
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.text[:200]
            except:
                error_detail = str(e)
        print(f"❌ 카카오맵 HTTP 오류 ({course_name}): {e.response.status_code if hasattr(e, 'response') else 'Unknown'}")
        if error_detail:
            print(f"   상세: {error_detail}")
        return None
    except Exception as e:
        print(f"❌ 카카오맵 검색 실패 ({course_name}): {type(e).__name__}: {e}")
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
                # 기존 코스 확인 (코스명으로, 다중 지역 태그 병합 고려)
                # 같은 코스명이면 태그만 병합하거나 업데이트
                existing = supabase.table('running_courses_2025_11_19_10_42')\
                    .select('id, region_tags, district_tags, neighborhood_tags, natural_tags')\
                    .eq('name', course['course_name'])\
                    .limit(1)\
                    .execute()
                
                course_data = {
                    "name": kakao_info['place_name'],  # 카카오맵에서 정제된 이름
                    "description": course['description'],
                    "start_lat": kakao_info['y'],
                    "start_lng": kakao_info['x'],
                    "distance_km": course.get('length_km', 3.0),
                    "city": course.get('city', ''),  # 첫 번째 region_tag
                    "district": course.get('district', ''),  # 첫 번째 district_tag
                    "course_type": course['course_type'],
                    "note": course.get('note'),
                    "has_uphill": course.get('elevation') == '업힐' or '업힐' in course.get('course_type', ''),
                    # JSONB 배열 컬럼 (Python 리스트를 직접 전달하면 Supabase가 자동으로 JSONB로 변환)
                    "tags": ensure_list(course.get('tags')),
                    "region_tags": ensure_list(course.get('region_tags')),
                    "district_tags": ensure_list(course.get('district_tags')),
                    "neighborhood_tags": ensure_list(course.get('neighborhood_tags')),
                    "natural_tags": ensure_list(course.get('natural_tags')),
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
                    # 기존 코스 업데이트 (태그 병합)
                    existing_course = existing.data[0]
                    
                    # 기존 태그를 리스트로 변환 (JSONB에서 가져올 때 이미 리스트일 수 있음)
                    existing_region_tags = ensure_list(existing_course.get('region_tags'))
                    existing_district_tags = ensure_list(existing_course.get('district_tags'))
                    existing_neighborhood_tags = ensure_list(existing_course.get('neighborhood_tags'))
                    existing_natural_tags = ensure_list(existing_course.get('natural_tags'))
                    
                    # 태그 병합 (중복 제거)
                    merged_region_tags = list(set(
                        list(existing_region_tags) + list(course_data.get('region_tags', []))
                    ))
                    merged_district_tags = list(set(
                        list(existing_district_tags) + list(course_data.get('district_tags', []))
                    ))
                    merged_neighborhood_tags = list(set(
                        list(existing_neighborhood_tags) + list(course_data.get('neighborhood_tags', []))
                    ))
                    merged_natural_tags = list(set(
                        list(existing_natural_tags) + list(course_data.get('natural_tags', []))
                    ))
                    
                    # 병합된 태그로 업데이트 (JSONB 배열로 저장)
                    course_data.update({
                        'region_tags': merged_region_tags,
                        'district_tags': merged_district_tags,
                        'neighborhood_tags': merged_neighborhood_tags,
                        'natural_tags': merged_natural_tags,
                    })
                    
                    # city, district는 첫 번째 태그로 업데이트
                    if merged_region_tags:
                        course_data['city'] = merged_region_tags[0] if isinstance(merged_region_tags[0], str) else str(merged_region_tags[0])
                    if merged_district_tags:
                        course_data['district'] = merged_district_tags[0] if isinstance(merged_district_tags[0], str) else str(merged_district_tags[0])
                    
                    supabase.table('running_courses_2025_11_19_10_42')\
                        .update(course_data)\
                        .eq('id', existing_course['id'])\
                        .execute()
                    print(f"  ✅ 업데이트 (태그 병합): {kakao_info['place_name']}")
                    print(f"     regions={len(merged_region_tags)}, districts={len(merged_district_tags)}")
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
        
        # API 호출 제한 방지 (카카오맵 API는 1초 3회도 가끔 차단하므로 1.2초 대기)
        time.sleep(1.2)
    
    # 결과 저장
    with open('data/kakao_geocode_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 완료!")
    print(f"  성공: {success_count}개")
    print(f"  실패: {fail_count}개")
    print(f"📁 결과 저장: data/kakao_geocode_results.json")

if __name__ == "__main__":
    geocode_courses_from_file()

