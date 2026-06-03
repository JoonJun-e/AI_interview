#!/usr/bin/env python3
"""
참가자별 질문 답변 단어 수 카운팅 및 엑셀 출력 (개선 버전)
- Word Count.xlsx에 있는 사람들만 분석
- 중복 녹음 시 첫 번째 세트만 사용
- 하드스킬/소프트스킬 구분
"""

import os
import pandas as pd
import re
from pathlib import Path

def count_words(text):
    """텍스트의 단어 수 카운트 (공백 기준)"""
    words = text.strip().split()
    return len(words)

def parse_transcript_file_first_only(file_path):
    """답변모음 파일 파싱하여 질문별 답변 추출 (중복 시 첫 번째만)"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 질문 패턴으로 직접 찾기 (헤더 무시하고)
    question_pattern = re.compile(r'질문\s+(\d+):\s*(.+?)(?=(?:질문\s+\d+:|------|$))', re.DOTALL)
    matches = question_pattern.findall(content)

    question_answers = {}
    seen_questions = set()  # 이미 본 질문 번호 추적

    for match in matches:
        question_num = int(match[0])
        answer_text = match[1].strip()

        # 빈 답변 건너뛰기
        if not answer_text or len(answer_text) < 10:
            continue

        # 중복 질문이면 건너뛰기 (첫 번째만 사용)
        if question_num in seen_questions:
            continue

        seen_questions.add(question_num)

        # 단어 수 카운트
        word_count = count_words(answer_text)
        question_answers[question_num] = {
            'text': answer_text,
            'word_count': word_count
        }

    return question_answers

def classify_question_type(question_num, condition):
    """질문 번호와 컨디션으로 질문 유형 분류"""
    if question_num == 1:
        return '자기소개'

    # 컨디션으로 구분
    if condition in ['A(TSOA)', 'B(TSOR)']:
        # TS = 소프트 스킬 질문들
        return '소프트스킬'
    elif condition in ['C(THOA)', 'D(THOR)']:
        # TH = 하드 스킬 질문들
        return '하드스킬'
    else:
        return '기타'

def main():
    # 1. Word Count.xlsx에서 분석 대상 목록 로드
    print("📂 분석 대상 로딩...")
    target_df = pd.read_excel('Word count.xlsx')
    target_names = set(target_df['이름'].dropna().tolist())
    print(f"   분석 대상: {len(target_names)}명\n")

    # 2. 컨디션 정보 로드
    print("📂 컨디션 정보 로딩...")
    condition_df = pd.read_excel('name_and_condition.xlsx', header=None)
    condition_df.columns = ['컨디션', '이름']
    name_to_condition = dict(zip(condition_df['이름'], condition_df['컨디션']))
    print(f"   컨디션 정보: {len(name_to_condition)}명\n")

    # 3. 답변 파일 디렉토리
    transcript_dir = Path('interview_analysis/transcripts_corrected')

    # 4. 모든 참가자 데이터 수집
    print("📝 답변 파일 분석 중 (첫 번째 세트만)...\n")

    all_data = []
    not_found = []

    for name in sorted(target_names):
        # 파일 찾기
        file_path = transcript_dir / f"{name}_답변모음.txt"

        if not file_path.exists():
            print(f"   ❌ {name} - 파일 없음")
            not_found.append(name)
            continue

        # 컨디션 정보 가져오기
        condition = name_to_condition.get(name, 'Unknown')

        # 답변 파싱 (첫 번째 세트만)
        try:
            questions = parse_transcript_file_first_only(file_path)

            if not questions:
                print(f"   ⚠️  {name} - 답변 없음")
                continue

            # 질문 유형별로 분류
            intro_words = []
            soft_words = []
            hard_words = []

            for q_num, q_data in questions.items():
                q_type = classify_question_type(q_num, condition)
                if q_type == '자기소개':
                    intro_words.append(q_data['word_count'])
                elif q_type == '소프트스킬':
                    soft_words.append(q_data['word_count'])
                elif q_type == '하드스킬':
                    hard_words.append(q_data['word_count'])

            # 데이터 저장
            row_data = {
                '컨디션': condition,
                '이름': name,
                '질문1_자기소개': intro_words[0] if intro_words else None,
            }

            # 질문별 단어 수 추가
            for q_num in sorted(questions.keys()):
                q_type = classify_question_type(q_num, condition)
                row_data[f'질문{q_num}_{q_type}'] = questions[q_num]['word_count']

            # 평균 계산
            row_data['소프트스킬_평균'] = round(sum(soft_words) / len(soft_words), 1) if soft_words else None
            row_data['하드스킬_평균'] = round(sum(hard_words) / len(hard_words), 1) if hard_words else None
            row_data['전체_평균'] = round(sum(q['word_count'] for q in questions.values()) / len(questions), 1) if questions else None

            all_data.append(row_data)

            # 출력
            soft_avg = row_data['소프트스킬_평균'] or 0
            hard_avg = row_data['하드스킬_평균'] or 0
            print(f"   ✅ {name} ({condition}): 소프트 {soft_avg:.1f}, 하드 {hard_avg:.1f}")

        except Exception as e:
            print(f"   ❌ {name} 오류: {e}")
            continue

    # 5. DataFrame 생성
    print(f"\n📊 데이터 정리 중...\n")
    df = pd.DataFrame(all_data)

    # 컬럼 순서 재정렬
    fixed_cols = ['컨디션', '이름', '질문1_자기소개']
    question_cols = sorted([col for col in df.columns if col.startswith('질문') and col != '질문1_자기소개'],
                          key=lambda x: int(re.search(r'질문(\d+)', x).group(1)))
    avg_cols = ['소프트스킬_평균', '하드스킬_평균', '전체_평균']

    cols_order = fixed_cols + question_cols + avg_cols
    df = df[[col for col in cols_order if col in df.columns]]

    # 컨디션별 정렬
    df = df.sort_values(['컨디션', '이름']).reset_index(drop=True)

    # 6. 엑셀 저장
    output_file = 'Word_count_result_v2.xlsx'

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
                    '소프트스킬_평균': round(cond_df['소프트스킬_평균'].mean(), 1),
                    '하드스킬_평균': round(cond_df['하드스킬_평균'].mean(), 1),
                    '전체_평균': round(cond_df['전체_평균'].mean(), 1)
                })

        stats_df = pd.DataFrame(stats_data)
        stats_df.to_excel(writer, sheet_name='컨디션별통계', index=False)

    print(f"✅ 결과 저장 완료: {output_file}")
    print(f"\n📈 요약:")
    print(f"   - 총 참가자: {len(df)}명")
    print(f"   - 전체 평균: {df['전체_평균'].mean():.1f}단어")
    print(f"\n   컨디션별:")
    for condition in ['A(TSOA)', 'B(TSOR)', 'C(THOA)', 'D(THOR)']:
        cond_df = df[df['컨디션'] == condition]
        if len(cond_df) > 0:
            soft_avg = cond_df['소프트스킬_평균'].mean()
            hard_avg = cond_df['하드스킬_평균'].mean()
            print(f"     {condition}: {len(cond_df)}명, 소프트 {soft_avg:.1f}, 하드 {hard_avg:.1f}")

    if not_found:
        print(f"\n⚠️  파일을 찾지 못한 참가자 ({len(not_found)}명):")
        for name in not_found:
            print(f"     - {name}")

if __name__ == '__main__':
    main()
