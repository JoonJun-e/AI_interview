#!/usr/bin/env python3
"""
참가자별 질문 답변 단어 수 카운팅 및 엑셀 출력
"""

import os
import pandas as pd
import re
from pathlib import Path

def count_words(text):
    """텍스트의 단어 수 카운트 (공백 기준)"""
    # 공백으로 split
    words = text.strip().split()
    return len(words)

def parse_transcript_file(file_path):
    """답변모음 파일 파싱하여 질문별 답변 추출"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 질문별로 분리
    sections = content.split('----------------------------------------------------------------------')

    question_answers = {}

    for section in sections:
        section = section.strip()
        if not section or '======' in section:
            continue

        # "질문 N:" 패턴 찾기
        match = re.match(r'^질문\s+(\d+):\s*(.+)', section, re.DOTALL)
        if match:
            question_num = int(match.group(1))
            answer_text = match.group(2).strip()

            # 단어 수 카운트
            word_count = count_words(answer_text)
            question_answers[question_num] = {
                'text': answer_text,
                'word_count': word_count
            }

    return question_answers

def main():
    # 1. 컨디션 정보 로드
    print("📂 컨디션 정보 로딩...")
    condition_df = pd.read_excel('name_and_condition.xlsx', header=None)
    condition_df.columns = ['컨디션', '이름']

    # 이름을 key로 하는 딕셔너리 생성
    name_to_condition = dict(zip(condition_df['이름'], condition_df['컨디션']))

    print(f"   총 {len(name_to_condition)}명의 컨디션 정보 로드 완료\n")

    # 2. 답변 파일 디렉토리
    transcript_dir = Path('interview_analysis/transcripts_corrected')

    # 3. 모든 참가자 데이터 수집
    print("📝 답변 파일 분석 중...\n")

    all_data = []

    for file_path in sorted(transcript_dir.glob('*_답변모음.txt')):
        participant_name = file_path.stem.replace('_답변모음', '')

        # 제외할 이름들 (A/B 버전, 이상한 이름 등)
        if participant_name in ['2', '324', '456768', 'ㄷ3']:
            print(f"   ⏭️  {participant_name} - 제외됨")
            continue

        # 컨디션 정보 가져오기
        condition = name_to_condition.get(participant_name, 'Unknown')

        # 답변 파싱
        try:
            questions = parse_transcript_file(file_path)

            if not questions:
                print(f"   ⚠️  {participant_name} - 답변 없음")
                continue

            # 질문별 단어 수
            word_counts = [questions[q]['word_count'] for q in sorted(questions.keys())]
            avg_words = sum(word_counts) / len(word_counts) if word_counts else 0

            # 데이터 저장
            row_data = {
                '컨디션': condition,
                '이름': participant_name,
                '질문수': len(questions),
                '총단어수': sum(word_counts),
                '평균': round(avg_words, 1)
            }

            # 질문별 단어 수 추가
            for q_num in sorted(questions.keys()):
                row_data[f'질문{q_num}'] = questions[q_num]['word_count']

            all_data.append(row_data)

            print(f"   ✅ {participant_name}: {len(questions)}개 질문, 평균 {avg_words:.1f}단어")

        except Exception as e:
            print(f"   ❌ {participant_name} 오류: {e}")
            continue

    # 4. DataFrame 생성
    print(f"\n📊 데이터 정리 중...\n")
    df = pd.DataFrame(all_data)

    # 질문 컬럼들을 숫자 순서로 정렬 (질문1, 질문2, ... 형식만)
    question_cols = sorted([col for col in df.columns if col.startswith('질문') and col[2:].isdigit()],
                          key=lambda x: int(x.replace('질문', '')))

    # 컬럼 순서 재정렬
    cols_order = ['컨디션', '이름', '질문수'] + question_cols + ['총단어수', '평균']
    df = df[cols_order]

    # 컨디션별 정렬
    df = df.sort_values(['컨디션', '이름']).reset_index(drop=True)

    # 5. 엑셀 저장
    output_file = 'Word_count_result.xlsx'

    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='단어수', index=False)

        # 컨디션별 통계
        stats_data = []
        for condition in ['A(TSOA)', 'B(TSOR)', 'C(THOA)', 'D(THOR)']:
            cond_df = df[df['컨디션'] == condition]
            if len(cond_df) > 0:
                stats_data.append({
                    '컨디션': condition,
                    '인원': len(cond_df),
                    '평균_단어수': round(cond_df['평균'].mean(), 1),
                    '평균_질문수': round(cond_df['질문수'].mean(), 1)
                })

        stats_df = pd.DataFrame(stats_data)
        stats_df.to_excel(writer, sheet_name='컨디션별통계', index=False)

    print(f"✅ 결과 저장 완료: {output_file}")
    print(f"\n📈 요약:")
    print(f"   - 총 참가자: {len(df)}명")
    print(f"   - 전체 평균 단어수: {df['평균'].mean():.1f}")
    print(f"\n   컨디션별:")
    for condition in ['A(TSOA)', 'B(TSOR)', 'C(THOA)', 'D(THOR)']:
        cond_df = df[df['컨디션'] == condition]
        if len(cond_df) > 0:
            print(f"     {condition}: {len(cond_df)}명, 평균 {cond_df['평균'].mean():.1f}단어")

if __name__ == '__main__':
    main()
