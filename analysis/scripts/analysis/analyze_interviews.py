#!/usr/bin/env python3
"""
AI 인터뷰 결과 분석 스크립트
3명의 참가자 인터뷰 영상을 다운로드하고 분석합니다.
"""

import os
from google.cloud import storage
from collections import defaultdict

# 서비스 계정 키 경로 설정
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '/Users/choiseongjoon/Desktop/ai_interview/gcp-credentials.json'

# 분석할 참가자
TARGET_PARTICIPANTS = ['장혜지', '이나경', '남효윤']

def download_participant_videos(bucket_name='ai-interview-skku-is-2025', output_dir='interview_analysis/videos'):
    """참가자별 영상 다운로드"""

    # 출력 디렉토리 생성
    os.makedirs(output_dir, exist_ok=True)

    # Storage 클라이언트 생성
    client = storage.Client()
    bucket = client.bucket(bucket_name)

    print("📥 인터뷰 영상 다운로드 시작...\n")

    # 참가자별 영상 파일 저장
    participant_files = defaultdict(list)

    # 모든 파일 목록 가져오기
    blobs = list(bucket.list_blobs())

    for blob in blobs:
        # .webm 파일만 처리
        if not blob.name.endswith('.webm'):
            continue

        # 파일명에서 참가자 이름 추출
        for participant in TARGET_PARTICIPANTS:
            if participant in blob.name:
                # 파일 다운로드
                local_path = os.path.join(output_dir, blob.name)

                # 이미 다운로드된 파일은 건너뛰기
                if os.path.exists(local_path):
                    print(f"⏭️  건너뛰기: {blob.name} (이미 존재)")
                    participant_files[participant].append(local_path)
                    continue

                print(f"⬇️  다운로드 중: {blob.name} ({blob.size / (1024*1024):.2f} MB)")
                blob.download_to_filename(local_path)
                participant_files[participant].append(local_path)
                break

    return participant_files

def analyze_interviews(participant_files):
    """인터뷰 결과 분석 (기본 정보)"""

    print("\n" + "="*70)
    print("📊 인터뷰 분석 결과")
    print("="*70 + "\n")

    for participant, files in sorted(participant_files.items()):
        print(f"👤 {participant}")
        print(f"   ├─ 총 영상 수: {len(files)}개")

        # 총 파일 크기 계산
        total_size = sum(os.path.getsize(f) for f in files)
        print(f"   ├─ 총 크기: {total_size / (1024*1024):.2f} MB")

        # 영상 목록
        print(f"   └─ 영상 목록:")
        for i, file_path in enumerate(sorted(files), 1):
            filename = os.path.basename(file_path)
            size_mb = os.path.getsize(file_path) / (1024*1024)
            print(f"      {i}. {filename} ({size_mb:.2f} MB)")
        print()

    return True

def create_analysis_report(participant_files, output_file='interview_analysis/analysis_report.md'):
    """분석 리포트 생성"""

    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# AI 인터뷰 분석 리포트\n\n")
        f.write(f"## 📋 개요\n\n")
        f.write(f"- 분석 대상: {len(participant_files)}명\n")
        f.write(f"- 참가자: {', '.join(sorted(participant_files.keys()))}\n\n")

        f.write("---\n\n")

        for participant, files in sorted(participant_files.items()):
            f.write(f"## 👤 {participant}\n\n")
            f.write(f"### 기본 정보\n\n")
            f.write(f"- 총 영상 수: {len(files)}개\n")

            total_size = sum(os.path.getsize(file) for file in files)
            f.write(f"- 총 크기: {total_size / (1024*1024):.2f} MB\n\n")

            f.write(f"### 영상 목록\n\n")
            for i, file_path in enumerate(sorted(files), 1):
                filename = os.path.basename(file_path)
                size_mb = os.path.getsize(file_path) / (1024*1024)

                # 타임스탬프에서 날짜 추출
                timestamp = filename.split('-')[0]

                f.write(f"{i}. **{filename}**\n")
                f.write(f"   - 크기: {size_mb:.2f} MB\n")
                f.write(f"   - 타임스탬프: {timestamp}\n")
                f.write(f"   - 경로: `{file_path}`\n\n")

            f.write("---\n\n")

        f.write("## 📌 다음 단계\n\n")
        f.write("1. 음성 인식 (STT)으로 답변 텍스트 추출\n")
        f.write("2. 답변 내용 분석\n")
        f.write("3. 감정 분석 (선택적)\n")
        f.write("4. 답변 품질 평가\n\n")

    print(f"✅ 분석 리포트 생성 완료: {output_file}")
    return output_file

if __name__ == '__main__':
    try:
        # 1. 영상 다운로드
        participant_files = download_participant_videos()

        if not participant_files:
            print("❌ 다운로드된 파일이 없습니다.")
            exit(1)

        # 2. 기본 분석
        analyze_interviews(participant_files)

        # 3. 리포트 생성
        report_file = create_analysis_report(participant_files)

        print(f"\n🎉 분석 완료!")
        print(f"\n📄 리포트 확인: {report_file}")
        print(f"📂 영상 위치: interview_analysis/videos/")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
