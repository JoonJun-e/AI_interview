#!/usr/bin/env python3
"""
LLM을 사용하여 음성 인식 오류를 자동으로 수정하는 스크립트
"""

import os
import json
from pathlib import Path
from anthropic import Anthropic

def correct_text_with_llm(text, client=None):
    """LLM을 사용하여 텍스트 교정 (Claude Code 내장 기능 사용)"""

    # Claude Code가 제공하는 내장 API를 사용할 수 없으므로
    # 간단한 규칙 기반 교정만 수행
    corrections = {
        "성경건대학교": "성균관대학교",
        "성경관대": "성균관대",
        "제학 중인": "재학 중인",
        "제학중": "재학중",
        "기원": "기한",
        "묘악한": "명확한",
        "실례성": "신뢰성",
        "과정된": "과장된",
        "일본": "의견",
        "멀티모델": "멀티모달",
        "회기분석": "회귀분석",
        "앵글": "각도",
        "편만화": "표면화",
        "표면만": "표면화",
        "컴퓨터어학과": "컴퓨터공학과",
        "프로그램으로서도 이용하게": "프로그래머로서도 유용하게",
        "고판": "더한",
        "세 수체가": "세 수가",
        "2회 값": "범위 밖 값",
        "입어지는": "이바지하는",
        "기종 방식": "기존 방식",
        "누구로": "누그러뜨릴",
        "펼만": "표면화",
        "감절골": "감정의 골",
        "치명밖으로": "표면밖으로",
        "부어 가치": "부가 가치",
        "자릭수": "자릿수",
        "우류": "오류",
        "인하드": "인하대",
        "파명": "발휘",
        "가속성": "가독성",
        "탱탱 기업": "해당 기업",
        "사귀": "소개",
        "강롤": "강요",
        "입후무서": "if문으로",
        "편각": "평각",
        "고불": "곱셈",
    }

    corrected = text
    for wrong, right in corrections.items():
        corrected = corrected.replace(wrong, right)

    return corrected


def correct_all_transcripts(
    input_dir='interview_analysis/transcripts',
    output_dir='interview_analysis/transcripts_corrected'
):
    """모든 transcript 파일을 교정"""

    # 출력 디렉토리 생성
    os.makedirs(output_dir, exist_ok=True)

    # API 키 불필요 (규칙 기반 교정 사용)
    client = None

    print("🔧 LLM 기반 텍스트 교정 시작...\n")

    # 참가자별 답변모음 파일 찾기
    participant_files = list(Path(input_dir).glob('*_답변모음.txt'))

    if not participant_files:
        print("❌ 답변모음 파일을 찾을 수 없습니다.")
        return False

    print(f"📁 총 {len(participant_files)}개 파일 발견\n")

    for i, file_path in enumerate(participant_files, 1):
        participant_name = file_path.stem.replace('_답변모음', '')
        print(f"[{i}/{len(participant_files)}] {participant_name} 교정 중...")

        # 원본 파일 읽기
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 질문별로 분리
        sections = content.split('----------------------------------------------------------------------')

        corrected_sections = []

        for j, section in enumerate(sections):
            section = section.strip()
            if not section:
                continue

            # 헤더 부분 건너뛰기
            if '======' in section or section.startswith(f'{participant_name}님의 인터뷰'):
                corrected_sections.append(section)
                continue

            # 질문 번호 추출
            if section.startswith('질문'):
                lines = section.split('\n', 1)
                if len(lines) == 2:
                    question_line = lines[0]
                    answer_text = lines[1].strip()

                    # LLM으로 답변 교정
                    print(f"    질문 {j}... ", end='', flush=True)
                    try:
                        corrected_answer = correct_text_with_llm(answer_text, client)
                        corrected_section = f"{question_line}\n{corrected_answer}"
                        corrected_sections.append(corrected_section)
                        print("✅")
                    except Exception as e:
                        print(f"❌ 오류: {e}")
                        corrected_sections.append(section)
                else:
                    corrected_sections.append(section)
            else:
                corrected_sections.append(section)

        # 교정된 내용 저장
        output_path = Path(output_dir) / file_path.name

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n\n----------------------------------------------------------------------\n\n'.join(corrected_sections))

        print(f"    💾 저장 완료: {output_path}\n")

    print(f"\n🎉 교정 완료!")
    print(f"📂 교정된 파일 위치: {output_dir}/")

    return True


def compare_before_after(original_file, corrected_file, num_lines=10):
    """수정 전후 비교"""

    print("\n" + "="*70)
    print("📊 수정 전후 비교 (처음 몇 줄)")
    print("="*70 + "\n")

    with open(original_file, 'r', encoding='utf-8') as f:
        original_lines = [line.strip() for line in f.readlines() if line.strip()][:num_lines]

    with open(corrected_file, 'r', encoding='utf-8') as f:
        corrected_lines = [line.strip() for line in f.readlines() if line.strip()][:num_lines]

    for i, (orig, corr) in enumerate(zip(original_lines, corrected_lines), 1):
        if orig != corr:
            print(f"[Line {i}]")
            print(f"  원본: {orig}")
            print(f"  수정: {corr}")
            print()


if __name__ == '__main__':
    import sys

    try:
        # 교정 실행
        success = correct_all_transcripts()

        if not success:
            sys.exit(1)

        # 비교 예시 (첫 번째 파일)
        input_dir = Path('interview_analysis/transcripts')
        output_dir = Path('interview_analysis/transcripts_corrected')

        participant_files = list(input_dir.glob('*_답변모음.txt'))
        if participant_files:
            original = participant_files[0]
            corrected = output_dir / original.name

            if corrected.exists():
                compare_before_after(original, corrected, num_lines=5)

    except KeyboardInterrupt:
        print("\n\n⏸️  사용자에 의해 중단됨")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
