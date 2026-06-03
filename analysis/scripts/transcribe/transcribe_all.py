#!/usr/bin/env python3
"""
전체 참가자 인터뷰 영상을 텍스트로 변환 (medium 모델 사용)
"""

import os
import whisper
from collections import defaultdict
import json
from pathlib import Path

def transcribe_all_videos(video_dir='interview_analysis/videos', output_dir='interview_analysis/transcripts'):
    """모든 영상을 텍스트로 변환 (medium 모델)"""

    # 출력 디렉토리 생성
    os.makedirs(output_dir, exist_ok=True)

    print("🎙️  Whisper 모델 로딩 중 (medium - 더 정확함)...")
    # medium 모델 사용
    model = whisper.load_model("medium")

    # 영상 파일 목록
    video_files = [f for f in os.listdir(video_dir) if f.endswith('.webm')]
    video_files.sort()

    print(f"\n📹 총 {len(video_files)}개 영상 변환 시작...\n")

    # 참가자별 답변 저장
    participant_transcripts = defaultdict(list)

    # 이미 변환된 파일 확인
    existing_txt_files = set(f.replace('.txt', '.webm') for f in os.listdir(output_dir) if f.endswith('.txt') and not f.endswith('_답변모음.txt'))

    for i, video_file in enumerate(video_files, 1):
        # 이미 변환된 파일은 건너뛰기
        if video_file in existing_txt_files:
            print(f"[{i}/{len(video_files)}] ⏭️  {video_file[:60]}... (이미 변환됨)")

            # 기존 변환 결과 로드
            txt_path = os.path.join(output_dir, video_file.replace('.webm', '.txt'))
            with open(txt_path, 'r', encoding='utf-8') as f:
                transcript_text = f.read().strip()

            parts = video_file.replace('.webm', '').split('-')
            participant_name = parts[1] if len(parts) >= 2 else "Unknown"
            question_num = parts[2] if len(parts) >= 3 else str(i)

            participant_transcripts[participant_name].append({
                'question': question_num,
                'video_file': video_file,
                'transcript': transcript_text,
                'timestamp': parts[0] if len(parts) >= 3 else ''
            })
            continue

        video_path = os.path.join(video_dir, video_file)

        # 파일명에서 참가자 이름 추출
        parts = video_file.replace('.webm', '').split('-')
        if len(parts) >= 3:
            participant_name = parts[1]
            question_num = parts[2]
        else:
            participant_name = "Unknown"
            question_num = str(i)

        print(f"[{i}/{len(video_files)}] 🎤 {participant_name} - 질문 {question_num}")

        # Whisper로 음성 인식 (한국어)
        try:
            result = model.transcribe(
                video_path,
                language='ko',
                fp16=False,
                verbose=False,
                temperature=0.0
            )

            transcript_text = result['text'].strip()

            print(f"    ✅ {len(transcript_text)}자 - \"{transcript_text[:80]}...\"")

            # 참가자별로 저장
            participant_transcripts[participant_name].append({
                'question': question_num,
                'video_file': video_file,
                'transcript': transcript_text,
                'timestamp': parts[0] if len(parts) >= 3 else ''
            })

            # 개별 텍스트 파일로도 저장
            txt_filename = video_file.replace('.webm', '.txt')
            txt_path = os.path.join(output_dir, txt_filename)
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(transcript_text)

        except Exception as e:
            print(f"    ❌ 오류: {e}")
            continue

    print("\n" + "="*70)
    print("💾 참가자별 답변 저장 중...")
    print("="*70 + "\n")

    # 참가자별 JSON 파일 저장
    for participant, transcripts in sorted(participant_transcripts.items()):
        if not transcripts:
            continue

        json_filename = f"{participant}_transcripts.json"
        json_path = os.path.join(output_dir, json_filename)

        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump({
                'participant': participant,
                'total_responses': len(transcripts),
                'responses': transcripts
            }, f, ensure_ascii=False, indent=2)

        print(f"✅ {participant}: {len(transcripts)}개 답변 → {json_filename}")

        # 읽기 쉬운 텍스트 파일로도 저장
        txt_filename = f"{participant}_답변모음.txt"
        txt_path = os.path.join(output_dir, txt_filename)

        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(f"{'='*70}\n")
            f.write(f"{participant}님의 인터뷰 답변 전체\n")
            f.write(f"{'='*70}\n\n")

            for item in transcripts:
                f.write(f"질문 {item['question']}:\n")
                f.write(f"{item['transcript']}\n\n")
                f.write("-" * 70 + "\n\n")

    print(f"\n🎉 완료! 텍스트 파일 위치: {output_dir}/")
    return participant_transcripts

if __name__ == '__main__':
    try:
        transcripts = transcribe_all_videos()

        print("\n📊 변환 결과 요약:")
        for participant, items in sorted(transcripts.items()):
            print(f"  - {participant}: {len(items)}개 답변")

        print(f"\n총 {len(transcripts)}명 변환 완료")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
