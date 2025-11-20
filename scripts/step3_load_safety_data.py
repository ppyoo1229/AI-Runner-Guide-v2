#!/usr/bin/env python3
"""
STEP 3: 전국 안전데이터(가로등/보안등) 좌표 정제 및 DB 적재
- lat, lon 추출
- 안전 점수 부여
- 데이터 출처 기록
- Supabase에 저장
"""

import json
import os
import csv
from typing import Dict, List, Optional
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not all([SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    raise ValueError("환경 변수가 설정되지 않았습니다: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")

def calculate_safety_score(
    data_source: str,
    light_type: Optional[str] = None
) -> float:
    """
    안전 점수 계산 (0.0 ~ 100.0)
    - 가로등: 기본 20점
    - 보안등: 기본 15점
    - 치안 데이터: 범위에 따라 10~30점
    """
    base_scores = {
        "street_light": 20.0,
        "security_light": 15.0,
        "crime_data": 10.0,
    }
    
    return base_scores.get(data_source, 10.0)

def parse_region_from_coords(lat: float, lng: float) -> tuple[str, str]:
    """
    좌표로부터 시/도, 시/군/구 추정
    (간단한 버전, 실제로는 역지오코딩 API 사용 권장)
    """
    # 서울
    if 37.4 <= lat <= 37.7 and 126.7 <= lng <= 127.2:
        return ("서울", "")
    # 부산
    elif 35.0 <= lat <= 35.3 and 129.0 <= lng <= 129.3:
        return ("부산", "")
    # 대구
    elif 35.7 <= lat <= 36.0 and 128.4 <= lng <= 128.7:
        return ("대구", "")
    # 대전
    elif 36.2 <= lat <= 36.4 and 127.3 <= lng <= 127.5:
        return ("대전", "")
    # 광주
    elif 35.1 <= lat <= 35.2 and 126.7 <= lng <= 126.9:
        return ("광주", "")
    # 인천
    elif 37.3 <= lat <= 37.6 and 126.4 <= lng <= 126.8:
        return ("인천", "")
    # 경기도
    elif 37.0 <= lat <= 38.5 and 126.5 <= lng <= 127.8:
        return ("경기도", "")
    else:
        return ("기타", "")

def load_safety_data_from_api(
    api_key: str,
    data_source: str,
    page_no: int = 1,
    num_of_rows: int = 1000
) -> List[Dict]:
    """
    공공데이터 API에서 안전데이터 로드
    - 전국 스마트가로등 표준데이터
    - 전국 보안등정보 표준데이터
    """
    safety_points = []
    
    # 실제 API 엔드포인트
    api_endpoints = {
        "street_light": "https://api.data.go.kr/openapi/tn_pubr_public_smart_streetlight_api",
        "security_light": "https://api.data.go.kr/openapi/tn_pubr_public_scrty_lmp_api",
    }
    
    endpoint = api_endpoints.get(data_source)
    if not endpoint:
        print(f"⚠️ 알 수 없는 데이터 소스: {data_source}")
        return safety_points
    
    try:
        import httpx
        from urllib.parse import quote
        
        # API 키 URL 인코딩
        encoded_key = quote(api_key, safe='')
        
        # 공공데이터포털 API 파라미터
        params = {
            "serviceKey": encoded_key,
            "pageNo": page_no,
            "numOfRows": num_of_rows,
            "type": "json"  # JSON 형식 요청
        }
        
        with httpx.Client(timeout=60.0) as client:
            response = client.get(endpoint, params=params)
            response.raise_for_status()
            
            # 응답이 XML인 경우 처리
            content_type = response.headers.get("content-type", "")
            if "xml" in content_type.lower():
                import xml.etree.ElementTree as ET
                root = ET.fromstring(response.text)
                # XML 파싱 로직 (필요시 구현)
                print(f"  ⚠️ XML 응답 (JSON 변환 필요)")
                return safety_points
            
            data = response.json()
            
            # 공공데이터포털 응답 형식 확인
            # 일반적으로 response.body.items.item 형태
            items = []
            if "response" in data:
                body = data["response"].get("body", {})
                items_data = body.get("items", {})
                if isinstance(items_data, list):
                    items = items_data
                elif isinstance(items_data, dict) and "item" in items_data:
                    item = items_data["item"]
                    items = item if isinstance(item, list) else [item]
            elif "data" in data:
                items = data["data"] if isinstance(data["data"], list) else [data["data"]]
            elif isinstance(data, list):
                items = data
            
            for item in items:
                try:
                    # 위도/경도 추출 (컬럼명이 다를 수 있음)
                    lat = None
                    lng = None
                    
                    # 다양한 컬럼명 시도
                    for lat_key in ["위도", "latitude", "lat", "y", "wgs84Lat", "latit", "위치정보_위도"]:
                        if lat_key in item and item[lat_key]:
                            try:
                                lat = float(item[lat_key])
                                break
                            except (ValueError, TypeError):
                                continue
                    
                    for lng_key in ["경도", "longitude", "lng", "x", "wgs84Lon", "longit", "위치정보_경도"]:
                        if lng_key in item and item[lng_key]:
                            try:
                                lng = float(item[lng_key])
                                break
                            except (ValueError, TypeError):
                                continue
                    
                    if not lat or not lng:
                        continue
                    
                    # 유효한 좌표인지 확인 (한국 영역)
                    if not (33.0 <= lat <= 38.6 and 124.0 <= lng <= 132.0):
                        continue
                    
                    # 지역 정보 추출
                    region, district = parse_region_from_coords(lat, lng)
                    
                    safety_score = calculate_safety_score(data_source)
                    
                    safety_points.append({
                        "latitude": lat,
                        "longitude": lng,
                        "safety_score": safety_score,
                        "data_source": data_source,
                        "region": region,
                        "district": district or "",
                    })
                    
                except (ValueError, KeyError, TypeError) as e:
                    continue
        
        print(f"  ✅ {len(safety_points)}개 포인트 로드됨 (페이지 {page_no})")
        
        # 페이징 처리: 더 많은 데이터가 있으면 다음 페이지 로드
        if len(safety_points) == num_of_rows:
            # 다음 페이지가 있는지 확인하고 재귀 호출
            next_page_points = load_safety_data_from_api(
                api_key, data_source, page_no + 1, num_of_rows
            )
            safety_points.extend(next_page_points)
        
    except Exception as e:
        print(f"  ❌ API 호출 실패 (페이지 {page_no}): {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"     응답 내용: {e.response.text[:200]}")
    
    return safety_points

def load_csv_safety_data(
    csv_path: str,
    data_source: str,
    lat_col: str = "위도",
    lng_col: str = "경도",
    region_col: Optional[str] = None,
    district_col: Optional[str] = None
) -> List[Dict]:
    """CSV 파일에서 안전데이터 로드"""
    safety_points = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                try:
                    lat = float(row[lat_col])
                    lng = float(row[lng_col])
                    
                    # 유효한 좌표인지 확인
                    if not (33.0 <= lat <= 38.6 and 124.0 <= lng <= 132.0):
                        continue
                    
                    # 지역 정보 추출
                    if region_col and region_col in row:
                        region = row[region_col]
                    else:
                        region, _ = parse_region_from_coords(lat, lng)
                    
                    if district_col and district_col in row:
                        district = row[district_col]
                    else:
                        _, district = parse_region_from_coords(lat, lng)
                    
                    safety_score = calculate_safety_score(data_source)
                    
                    safety_points.append({
                        "latitude": lat,
                        "longitude": lng,
                        "safety_score": safety_score,
                        "data_source": data_source,
                        "region": region,
                        "district": district or "",
                    })
                    
                except (ValueError, KeyError) as e:
                    print(f"⚠️ 행 처리 실패: {e}")
                    continue
    
    except FileNotFoundError:
        print(f"❌ 파일을 찾을 수 없습니다: {csv_path}")
    
    return safety_points

def load_safety_data_to_db(
    safety_points: List[Dict],
    batch_size: int = 1000
):
    """안전데이터를 Supabase에 배치로 저장"""
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    total = len(safety_points)
    processed = 0
    
    print(f"📊 총 {total}개의 안전데이터 포인트를 저장합니다...")
    
    for i in range(0, total, batch_size):
        batch = safety_points[i:i + batch_size]
        
        try:
            supabase.table('safety_points_2025_11_19_14_00')\
                .insert(batch)\
                .execute()
            
            processed += len(batch)
            print(f"  ✅ {processed}/{total} 저장 완료 ({i//batch_size + 1} 배치)")
            
        except Exception as e:
            print(f"  ❌ 배치 저장 실패 ({i//batch_size + 1}): {e}")
            # 개별 저장 시도
            for point in batch:
                try:
                    supabase.table('safety_points_2025_11_19_14_00')\
                        .insert(point)\
                        .execute()
                    processed += 1
                except:
                    pass
    
    print(f"\n✅ 완료! 총 {processed}개 저장되었습니다.")

if __name__ == "__main__":
    all_safety_points = []
    
    # 공공데이터 API 키
    api_key = os.getenv("PUBLIC_DATA_API_KEY", "OLgszcwJfXCjuy1X+Kih8aTmprkibbu70aug3deMVGtzWhoc/Ss++kbhLuBxE7Okc0Ai2zQ8xYKhtvZ3P4ARsA==")
    
    # 1. 공공데이터 API에서 안전데이터 로드
    print("📡 공공데이터 API에서 안전데이터 로드 중...")
    print(f"   API 키: {api_key[:20]}...")
    
    # 전국 스마트가로등 데이터
    print("\n  [1/2] 전국 스마트가로등 표준데이터")
    print("        엔드포인트: https://api.data.go.kr/openapi/tn_pubr_public_smart_streetlight_api")
    street_lights = load_safety_data_from_api(api_key, "street_light", page_no=1, num_of_rows=1000)
    all_safety_points.extend(street_lights)
    print(f"        총 {len(street_lights)}개 포인트 수집 완료")
    
    # 전국 보안등 데이터
    print("\n  [2/2] 전국 보안등정보 표준데이터")
    print("        엔드포인트: https://api.data.go.kr/openapi/tn_pubr_public_scrty_lmp_api")
    security_lights = load_safety_data_from_api(api_key, "security_light", page_no=1, num_of_rows=1000)
    all_safety_points.extend(security_lights)
    print(f"        총 {len(security_lights)}개 포인트 수집 완료")
    
    # 2. CSV 파일도 로드 (있는 경우)
    csv_files = [
        {
            "path": "data/서울시 가로등 위치 정보.csv",
            "data_source": "street_light",
            "lat_col": "위도",
            "lng_col": "경도",
        },
    ]
    
    for csv_config in csv_files:
        if os.path.exists(csv_config["path"]):
            print(f"📂 CSV 로딩 중: {csv_config['path']}")
            points = load_csv_safety_data(
                csv_config["path"],
                csv_config["data_source"],
                csv_config.get("lat_col", "위도"),
                csv_config.get("lng_col", "경도"),
            )
            all_safety_points.extend(points)
            print(f"  ✅ {len(points)}개 포인트 로드됨")
    
    # DB에 저장
    if all_safety_points:
        print(f"\n📊 총 {len(all_safety_points)}개의 안전 포인트를 DB에 저장합니다...")
        load_safety_data_to_db(all_safety_points)
    else:
        print("❌ 저장할 데이터가 없습니다.")

