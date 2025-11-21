# app/utils.py
"""
인코딩/피처 집계/조명지수 계산 유틸
- Polyline 인코딩
- 기본 피처 추정 (거리/예상시간 등)
- 배지 생성
- 가로등 CSV 로딩 & 루트 조명지수 산출
"""

from __future__ import annotations
from typing import Dict, Tuple, Optional
import os
import re
import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString, Point
from shapely.ops import transform
import pyproj
import polyline as pl

# =========================
# Polyline / 기본 피처
# =========================

def encode_linestring_to_polyline(ls: LineString) -> str:
    """
    Shapely LineString(경로)을 구글 polyline 문자열로 인코딩
    LineString 좌표는 (x=lon, y=lat) 순서이므로 lat/lng로 뒤집어 인코딩
    precision=5 (모바일 맵에서 일반적으로 사용하는 정밀도)
    """
    coords = list(ls.coords)
    latlngs = [(y, x) for (x, y) in coords]
    return pl.encode(latlngs, precision=5)


def estimate_features(length_m: float, is_night: bool = False) -> Dict:
    """
    루프 길이(미터)만으로 계산 가능한 기본 피처를 추정
    * 이후 고도/교차로/신호등/수변/공원 등은 별도 함수로 덮어쓰기 권장
    """
    dist_km = length_m / 1000.0
    # 초보자 러닝 가정 페이스 (분/킬로)
    pace_min_per_km = 9.0
    duration_min_est = dist_km * pace_min_per_km

    # 스텁 값(후속 단계에서 실제 값으로 교체)
    elev_gain_norm = 0.1            # TODO: DEM 반영
    intersections_per_km = 0.6      # TODO: OSM 교차로 집계
    signals_per_km = 0.2            # TODO: OSM 신호등 집계
    lighting_index = 0.7 if is_night else 0.5  # 이후 실제 가로등 데이터로 덮어쓰기
    water_park_ratio = 0.5          # TODO: 수변/공원 버퍼 overlap

    return dict(
        dist_km=dist_km,
        duration_min_est=duration_min_est,
        elev_gain_m=0.0,                    # TODO
        elev_gain_norm=elev_gain_norm,      # TODO
        intersections_per_km=intersections_per_km,
        signals_per_km=signals_per_km,
        lighting_index=lighting_index,
        water_park_ratio=water_park_ratio,
    )


def badges_from_features(f: Dict) -> list[str]:
    badges = []
    if f.get("lighting_index", 0.0) >= 0.6:
        badges.append("조명좋음")
    if f.get("intersections_per_km", 1.0) <= 0.7:
        badges.append("교차로적음")
    if f.get("elev_gain_norm", 1.0) <= 0.2:
        badges.append("평탄")
    return badges or ["기본"]

# =========================
# 가로등 CSV 로딩 & 조명지수 (Fallback용)
# =========================
# 
# [주의] 이 모듈의 조명지수 계산은 동적 루프 생성 시 fallback으로만 사용됩니다.
# DB에 저장된 코스의 경우, 사전 계산된 lighting_score를 사용하세요.
# 사전 계산은 precompute_course_safety_data_2025_11_19_13_00.ts 스크립트를 사용합니다.
#
# 프로세스:
# 1. 코스 x 카맵으로 코스명/정보 추출
# 2. 안전데이터 매핑 (가로등, 시설 등)
# 3. DB에 사전 계산된 데이터 저장
# 4. 조회 시 DB에서 사전 계산된 데이터 사용

# 내부 전역(앱 시작 시 한 번 로딩)
_LAMPS_GDF: Optional[gpd.GeoDataFrame] = None

# 좌표계 변환기 (WGS84 <-> Web Mercator)
_WGS84 = pyproj.CRS("EPSG:4326")
_WEBM = pyproj.CRS("EPSG:3857")
_TO_M = pyproj.Transformer.from_crs(_WGS84, _WEBM, always_xy=True).transform
_TO_DEG = pyproj.Transformer.from_crs(_WEBM, _WGS84, always_xy=True).transform

# 가로등 밀도 정규화 상한 (경험값: 50개/km → index=1.0)
_DEFAULT_LAMPS_PER_KM_MAX = 50.0


def _infer_lon_lat_columns(df: pd.DataFrame) -> Tuple[str, str]:
    """
    CSV에 들어온 경도/위도 컬럼명을 유연하게 추론.
    기본: ('lon', 'lat') → 대안: ('lng','lat'), ('x','y'), ('경도','위도') 등
    """
    candidates = [
        ("lon", "lat"),
        ("lng", "lat"),
        ("x", "y"),
        ("경도", "위도"),
        ("longitude", "latitude"),
    ]
    cols = {c.lower(): c for c in df.columns}
    for lon_key, lat_key in candidates:
        if lon_key in cols and lat_key in cols:
            return cols[lon_key], cols[lat_key]
    # 최후: 숫자형 2개 컬럼을 찾는다
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    if len(numeric_cols) >= 2:
        return numeric_cols[0], numeric_cols[1]
    raise ValueError("경도/위도 컬럼을 찾을 수 없습니다. (예: lon/lat, lng/lat)")


def load_lamps_csv(
    path: str = "/mnt/data/서울시 가로등 위치 정보.csv",
    lon_col: Optional[str] = None,
    lat_col: Optional[str] = None,
) -> None:
    """
    가로등 위치 CSV를 읽어 전역 GeoDataFrame(_LAMPS_GDF)에 로딩.
    - path: CSV 파일 경로
    - lon_col/lat_col: 경도/위도 컬럼명(없으면 자동 추론)
    """
    global _LAMPS_GDF
    if not os.path.exists(path):
        # 파일이 없으면 패스 (야간 지수는 기본값으로 동작)
        _LAMPS_GDF = None
        return

    df = pd.read_csv(path)
    if lon_col is None or lat_col is None:
        lon_col, lat_col = _infer_lon_lat_columns(df)

    gdf = gpd.GeoDataFrame(
        df,
        geometry=[Point(xy) for xy in zip(df[lon_col], df[lat_col])],
        crs=_WGS84,
    ).to_crs(_WEBM)

    _LAMPS_GDF = gdf


def lighting_index_for_route(
    ls: LineString,
    buf_m: float = 25.0,
    lamps_per_km_max: float = _DEFAULT_LAMPS_PER_KM_MAX,
) -> Tuple[float, float]:
    """
    루트(LineString)의 주변 버퍼(미터) 안에 포함되는 가로등 포인트 개수를 길이(km)로 정규화해
    조명 지수를 계산
    - 반환: (lighting_index[0~1], lamps_per_km)

    [주의] 이 함수는 동적으로 생성되는 루프 후보에 대한 fallback 계산용입니다.
    DB에 저장된 코스(running_courses_2025_11_19_10_42)의 경우, 
    사전 계산된 lighting_score를 사용하세요 (precompute_course_safety_data 스크립트 참조).

    * _LAMPS_GDF가 로딩되지 않았다면 (0.5, 0.0) 기본값을 반환
    * lamps_per_km_max는 데이터 분포에 맞게 조정하면 좋다(예: 30~80 사이)
    """
    if _LAMPS_GDF is None or _LAMPS_GDF.empty:
        return 0.5, 0.0

    # 경로를 미터 좌표계로 변환 후 버퍼 계산
    ls_m = transform(_TO_M, ls)              # EPSG:3857
    length_km = ls_m.length / 1000.0
    if length_km <= 0:
        return 0.5, 0.0

    buf = ls_m.buffer(buf_m)
    lamps_in = _LAMPS_GDF[_LAMPS_GDF.intersects(buf)]

    lamps_per_km = float(len(lamps_in)) / length_km
    # 간단 정규화 → 0~1
    idx = max(0.0, min(1.0, lamps_per_km / float(lamps_per_km_max)))
    return float(idx), float(lamps_per_km)
