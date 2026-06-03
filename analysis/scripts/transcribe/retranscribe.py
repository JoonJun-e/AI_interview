#!/usr/bin/env python3
"""
불완전하게 변환된 transcript를 다시 변환
"""

import os
import whisper
import json

def retranscribe_participant(participant_name, video_dir='interview_analysis/videos',
                             output_dir='interview_analysis/transcripts'):
    """특정 참가자의 영상을 다시 변환"""

    print(f"🎙️  Whisper 모델 로딩 중 (medium 모델)...")
    # medium 모델 사용 - 더 정확함
    model = whisper.load_model("medium")

    # 해당 참가자의 영상 파일 찾기
    video_files = [f for f in os.listdir(video_dir)
                   if f.endswith('.webm') and participant_name in f]
    video_files.sort()

    print(f"\n📹 {participant_name}: {len(video_files)}개 영상 재변환 시작...\n")

    participant_transcripts = []

    for i, video_file in enumerate(video_files, 1):
        video_path = os.path.join(video_dir, video_file)

        # 파일명에서 정보 추출
        parts = video_file.replace('.webm', '').split('-')
        question_num = parts[2] if len(parts) >= 3 else str(i)

        print(f"[{i}/{len(video_files)}] 질문 {question_num} 변환 중...")

        # Whisper로 음성 인식 (한국어, 더 긴 시간 허용)
        result = model.transcribe(
            video_path,
            language='ko',
            fp16=False,
            verbose=False,
            temperature=0.0,  # 더 일관된 결과
            word_timestamps=False
        )

        transcript_text = result['text'].strip()

        print(f"    ✅ 길이: {len(transcript_text)} 글자")
        print(f"    📝 {transcript_text[:100]}...")

        # 저장
        participant_transcripts.append({
            'question': question_num,
            'video_file': video_file,
            'transcript': transcript_text,
            'timestamp': parts[0] if len(parts) >= 3 else ''
        })

        # 개별 텍스트 파일 저장
        txt_filename = video_file.replace('.webm', '.txt')
        txt_path = os.path.join(output_dir, txt_filename)
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(transcript_text)

        print()

    # JSON 저장
    json_filename = f"{participant_name}_transcripts.json"
    json_path = os.path.join(output_dir, json_filename)

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({
            'participant': participant_name,
            'total_responses': len(participant_transcripts),
            'responses': participant_transcripts
        }, f, ensure_ascii=False, indent=2)

    print(f"✅ JSON 저장: {json_filename}\n")

    # 답변모음 텍스트 파일 저장
    txt_filename = f"{participant_name}_답변모음.txt"
    txt_path = os.path.join(output_dir, txt_filename)

    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(f"{'='*70}\n")
        f.write(f"{participant_name}님의 인터뷰 답변 전체\n")
        f.write(f"{'='*70}\n\n")

        for item in participant_transcripts:
            f.write(f"질문 {item['question']}:\n")
            f.write(f"{item['transcript']}\n\n")
            f.write("-" * 70 + "\n\n")

    print(f"✅ 답변모음 저장: {txt_filename}\n")

    return participant_transcripts


if __name__ == '__main__':
    import sys

    # 참가자 이름을 인자로 받음
    if len(sys.argv) < 2:
        print("사용법: python retranscribe.py <참가자이름>")
        print("예: python retranscribe.py 남효윤")
        sys.exit(1)

    participant = sys.argv[1]

    try:
        print(f"\n{'='*70}")
        print(f"🔄 {participant}님 답변 재변환")
        print(f"{'='*70}\n")

        transcripts = retranscribe_participant(participant)

        print(f"\n🎉 완료! {len(transcripts)}개 답변 재변환 완료")

    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
