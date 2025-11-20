#!/usr/bin/env python3
"""
STEP 2.5: 카카오맵 좌표 보정 후 지역 태그 업데이트
- 카카오맵 주소 정보로부터 정확한 지역 태그 추출
- 동 단위 정보 보완
- 중복 코스 통합 (같은 코스명이면 태그만 추가)
"""

import json
import os
import re
from typing import Dict, List, Optional
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not all([SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    raise ValueError("환경 변수가 설정되지 않았습니다: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")

def parse_address_to_tags(address: str) -> Dict[str, List[str]]:
    """
    카카오맵 주소를 파싱하여 지역 태그 추출
    예: "서울특별시 구로구 구로동" → {"region_tags": ["서울"], "district_tags": ["구로구"], "neighborhood_tags": ["구로동"]}
    """
    region_tags = []
    district_tags = []
    neighborhood_tags = []
    
    if not address:
        return {
            "region_tags": region_tags,
            "district_tags": district_tags,
            "neighborhood_tags": neighborhood_tags
        }
    
    # 시/도 추출
    region_patterns = [
        r'서울특별시|서울',
        r'경기도|경기',
        r'인천광역시|인천',
        r'부산광역시|부산',
        r'대구광역시|대구',
        r'대전광역시|대전',
        r'광주광역시|광주',
        r'울산광역시|울산',
        r'세종특별자치시|세종',
        r'강원특별자치도|강원도',
        r'충청북도|충북',
        r'충청남도|충남',
        r'전라북도|전북',
        r'전라남도|전남',
        r'경상북도|경북',
        r'경상남도|경남',
        r'제주특별자치도|제주',
    ]
    
    for pattern in region_patterns:
        if re.search(pattern, address):
            if '서울' in pattern:
                region_tags.append('서울')
            elif '경기' in pattern:
                region_tags.append('경기')
            elif '인천' in pattern:
                region_tags.append('인천')
            elif '부산' in pattern:
                region_tags.append('부산')
            elif '대구' in pattern:
                region_tags.append('대구')
            elif '대전' in pattern:
                region_tags.append('대전')
            elif '광주' in pattern:
                region_tags.append('광주')
            elif '울산' in pattern:
                region_tags.append('울산')
            elif '세종' in pattern:
                region_tags.append('세종')
            elif '강원' in pattern:
                region_tags.append('강원도')
            elif '충북' in pattern:
                region_tags.append('충청북도')
            elif '충남' in pattern:
                region_tags.append('충청남도')
            elif '전북' in pattern:
                region_tags.append('전라북도')
            elif '전남' in pattern:
                region_tags.append('전라남도')
            elif '경북' in pattern:
                region_tags.append('경상북도')
            elif '경남' in pattern:
                region_tags.append('경상남도')
            elif '제주' in pattern:
                region_tags.append('제주')
            break
    
    # 시/군/구 추출
    district_match = re.search(r'([가-힣]+(?:구|시|군))', address)
    if district_match:
        district_tags.append(district_match.group(1))
    
    # 동 단위 추출
    neighborhood_match = re.search(r'([가-힣]+(?:동|리))', address)
    if neighborhood_match:
        neighborhood_tags.append(neighborhood_match.group(1))
    
    return {
        "region_tags": list(set(region_tags)),
        "district_tags": list(set(district_tags)),
        "neighborhood_tags": list(set(neighborhood_tags))
    }

def merge_tags(existing: List[str], new: List[str]) -> List[str]:
    """기존 태그와 새 태그를 병합 (중복 제거)"""
    merged = list(set(existing + new))
    return merged

def update_course_tags_from_kakao():
    """카카오맵 주소 정보로부터 지역 태그 업데이트"""
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # 카카오맵 정보가 있는 모든 코스 조회
    response = supabase.table('running_courses_2025_11_19_10_42')\
        .select('id, name, kakao_address, kakao_course_info, region_tags, district_tags, neighborhood_tags')\
        .not_.is_('kakao_address', 'null')\
        .execute()
    
    courses = response.data
    total = len(courses)
    
    print(f"📊 총 {total}개의 코스를 처리합니다...\n")
    
    updated_count = 0
    
    for idx, course in enumerate(courses, 1):
        course_id = course['id']
        course_name = course['name']
        kakao_address = course.get('kakao_address', '')
        kakao_info = course.get('kakao_course_info', {})
        
        print(f"[{idx}/{total}] {course_name}")
        
        # 주소에서 태그 추출
        address_tags = parse_address_to_tags(kakao_address)
        
        # 기존 태그와 병합
        existing_region_tags = course.get('region_tags', []) or []
        existing_district_tags = course.get('district_tags', []) or []
        existing_neighborhood_tags = course.get('neighborhood_tags', []) or []
        
        merged_region_tags = merge_tags(existing_region_tags, address_tags['region_tags'])
        merged_district_tags = merge_tags(existing_district_tags, address_tags['district_tags'])
        merged_neighborhood_tags = merge_tags(existing_neighborhood_tags, address_tags['neighborhood_tags'])
        
        # 업데이트
        update_data = {
            "region_tags": merged_region_tags,
            "district_tags": merged_district_tags,
            "neighborhood_tags": merged_neighborhood_tags,
        }
        
        # city, district도 첫 번째 태그로 업데이트
        if merged_region_tags:
            update_data["city"] = merged_region_tags[0]
        if merged_district_tags:
            update_data["district"] = merged_district_tags[0]
        
        try:
            supabase.table('running_courses_2025_11_19_10_42')\
                .update(update_data)\
                .eq('id', course_id)\
                .execute()
            
            print(f"  ✅ 태그 업데이트: regions={len(merged_region_tags)}, districts={len(merged_district_tags)}, neighborhoods={len(merged_neighborhood_tags)}")
            updated_count += 1
            
        except Exception as e:
            print(f"  ❌ 업데이트 실패: {e}")
    
    print(f"\n✅ 완료! 총 {updated_count}개 코스가 업데이트되었습니다.")

if __name__ == "__main__":
    update_course_tags_from_kakao()

