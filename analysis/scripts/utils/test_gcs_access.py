#!/usr/bin/env python3
"""
Google Cloud Storage 버킷 접근 테스트 스크립트
"""

import os
from google.cloud import storage

# 서비스 계정 키 경로 설정
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '/Users/choiseongjoon/Desktop/ai_interview/gcp-credentials.json'

def test_bucket_access():
    """버킷 접근 및 파일 목록 조회"""

    # Storage 클라이언트 생성
    client = storage.Client()

    # 버킷 이름
    bucket_name = 'ai-interview-skku-is-2025'

    print(f"🔍 버킷 '{bucket_name}' 접근 중...\n")

    # 버킷 가져오기
    bucket = client.bucket(bucket_name)

    # 파일 목록 조회 (최대 20개)
    blobs = list(bucket.list_blobs(max_results=20))

    print(f"✅ 총 {len(blobs)}개 파일 발견:\n")

    for i, blob in enumerate(blobs, 1):
        # 파일 크기를 MB 단위로 변환
        size_mb = blob.size / (1024 * 1024)
        print(f"{i:2d}. {blob.name} ({size_mb:.2f} MB)")

    print(f"\n✅ 버킷 접근 성공!")

    return True

if __name__ == '__main__':
    try:
        test_bucket_access()
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
