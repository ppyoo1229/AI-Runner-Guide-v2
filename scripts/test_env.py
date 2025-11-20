#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""환경 변수 확인 스크립트"""

import os

print("=== Environment Variables Check ===")
print(f"SUPABASE_URL: {'SET' if os.getenv('SUPABASE_URL') else 'NOT SET'}")
print(f"KAKAO_REST_API_KEY: {'SET' if os.getenv('KAKAO_REST_API_KEY') else 'NOT SET'}")
print(f"SUPABASE_SERVICE_ROLE_KEY: {'SET' if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else 'NOT SET'}")
print(f"PUBLIC_DATA_API_KEY: {'SET' if os.getenv('PUBLIC_DATA_API_KEY') else 'NOT SET'}")

if all([
    os.getenv('SUPABASE_URL'),
    os.getenv('KAKAO_REST_API_KEY'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
]):
    print("\n[OK] All required environment variables are set!")
    print("You can now run:")
    print("  python scripts/step2_kakao_geocode_courses.py")
    print("  or")
    print("  .\\scripts\\run_step2.ps1")
else:
    print("\n[ERROR] Some environment variables are missing.")
    print("Please run: .\\scripts\\setup_env.ps1")

