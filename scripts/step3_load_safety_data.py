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
    # CSV 파일 경로 설정
    csv_files = [
        {
            "path": "data/서울시 가로등 위치 정보.csv",
            "data_source": "street_light",
            "lat_col": "위도",
            "lng_col": "경도",
        },
        # 추가 CSV 파일들...
    ]
    
    all_safety_points = []
    
    # 모든 CSV 파일 로드
    for csv_config in csv_files:
        if os.path.exists(csv_config["path"]):
            print(f"📂 로딩 중: {csv_config['path']}")
            points = load_csv_safety_data(
                csv_config["path"],
                csv_config["data_source"],
                csv_config.get("lat_col", "위도"),
                csv_config.get("lng_col", "경도"),
            )
            all_safety_points.extend(points)
            print(f"  ✅ {len(points)}개 포인트 로드됨")
        else:
            print(f"  ⚠️ 파일 없음: {csv_config['path']}")
    
    # DB에 저장
    if all_safety_points:
        load_safety_data_to_db(all_safety_points)
    else:
        print("❌ 저장할 데이터가 없습니다.")

