#!/usr/bin/env python3
"""
전체 참가자 영상 다운로드
"""

import os
from google.cloud import storage
from collections import defaultdict

# 서비스 계정 키 경로 설정
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '/Users/choiseongjoon/Desktop/ai_interview/gcp-credentials.json'

def download_all_videos(bucket_name='ai-interview-skku-is-2025', output_dir='interview_analysis/videos'):
    """전체 참가자 영상 다운로드"""

    # 출력 디렉토리 생성
    os.makedirs(output_dir, exist_ok=True)

    # Storage 클라이언트 생성
    client = storage.Client()
    bucket = client.bucket(bucket_name)

    print("📥 전체 인터뷰 영상 다운로드 시작...\n")

    # 참가자별 영상 파일 저장
    participant_files = defaultdict(list)

    # 모든 파일 목록 가져오기
    blobs = list(bucket.list_blobs())
    webm_files = [b for b in blobs if b.name.endswith('.webm')]

    print(f"총 {len(webm_files)}개 영상 파일 발견\n")

    downloaded = 0
    skipped = 0

    for i, blob in enumerate(webm_files, 1):
        # 파일명에서 참가자 이름 추출
        parts = blob.name.split('-')
        if len(parts) >= 2:
            participant = parts[1]
        else:
            participant = "Unknown"

        # 파일 다운로드
        local_path = os.path.join(output_dir, blob.name)

        # 이미 다운로드된 파일은 건너뛰기
        if os.path.exists(local_path):
            print(f"[{i}/{len(webm_files)}] ⏭️  {blob.name[:50]}... (이미 존재)")
            participant_files[participant].append(local_path)
            skipped += 1
            continue

        print(f"[{i}/{len(webm_files)}] ⬇️  {blob.name[:50]}... ({blob.size / (1024*1024):.1f} MB)")
        blob.download_to_filename(local_path)
        participant_files[participant].append(local_path)
        downloaded += 1

    print(f"\n✅ 다운로드 완료: {downloaded}개 새로 다운로드, {skipped}개 건너뜀")
    print(f"📊 총 {len(participant_files)}명의 참가자")

    return participant_files

if __name__ == '__main__':
    try:
        participant_files = download_all_videos()

        print("\n참가자별 영상 수:")
        for participant, files in sorted(participant_files.items()):
            print(f"  {participant}: {len(files)}개")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
