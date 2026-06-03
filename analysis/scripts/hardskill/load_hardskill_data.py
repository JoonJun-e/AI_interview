#!/usr/bin/env python3
"""
하드스킬 답안 데이터 로드 스크립트
ai_interview_hard_answer.xlsx에서 참가자별 코드를 추출합니다.
"""

import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from typing import Dict, List, Tuple

def load_hardskill_data(xlsx_file: str = 'ai_interview_hard_answer.xlsx') -> Dict[str, Dict[int, str]]:
    """
    xlsx 파일에서 하드스킬 답안 로드

    Returns:
        {이름: {문제번호: 코드}} 형식의 딕셔너리
    """

    with zipfile.ZipFile(xlsx_file, 'r') as z:
        # sharedStrings.xml에서 모든 문자열 읽기
        shared_strings_xml = z.read('xl/sharedStrings.xml')
        root = ET.fromstring(shared_strings_xml)

        ns_ss = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        strings = []
        for si in root.findall('.//main:si', ns_ss):
            text_parts = []
            for t_elem in si.findall('.//main:t', ns_ss):
                if t_elem.text:
                    text_parts.append(t_elem.text)
            strings.append(''.join(text_parts))

        # sheet1.xml 읽기
        sheet_xml = z.read('xl/worksheets/sheet1.xml')
        sheet_root = ET.fromstring(sheet_xml)

        ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

        # 모든 행 데이터 수집
        student_data = {}

        for row_elem in sheet_root.findall('.//main:row', ns):
            row_num = int(row_elem.get('r'))

            # 헤더 행 건너뛰기
            if row_num == 1:
                continue

            row_data = {}

            for cell in row_elem.findall('.//main:c', ns):
                cell_ref = cell.get('r')
                # 컬럼 추출 (예: A2 -> A)
                col = ''.join(c for c in cell_ref if c.isalpha())

                cell_value = cell.find('.//main:v', ns)
                cell_type = cell.get('t')

                if cell_value is not None:
                    val = cell_value.text
                    if cell_type == 's':
                        idx = int(val)
                        row_data[col] = strings[idx]
                    else:
                        row_data[col] = val
                else:
                    row_data[col] = ''

            # 이름과 코드 추출
            name = row_data.get('B', '').strip()
            if not name:
                continue

            # 컬럼 매핑:
            # F: 1번 문제 (곱셈) → 채점 1번
            # G: 2번 문제 (최댓값, 거의 없음)
            # H: 3번 문제 (각도) → 채점 2번
            # I: 4번 문제 (자릿수 합) → 채점 3번
            # JadenCase (4번)는 엑셀에 없음

            codes = {
                1: row_data.get('F', '').strip(),  # 곱셈
                2: row_data.get('H', '').strip(),  # 각도
                3: row_data.get('I', '').strip(),  # 자릿수 합
                # 4번 문제는 데이터에 없음
            }

            # 빈 문자열은 제거
            codes = {k: v for k, v in codes.items() if v}

            # 이름이 이미 있으면 업데이트 (최신 데이터 우선)
            if name in student_data:
                # 기존 데이터에 새 코드 병합
                student_data[name].update(codes)
            else:
                student_data[name] = codes

        return student_data


def print_data_summary(student_data: Dict[str, Dict[int, str]]):
    """데이터 요약 출력"""

    print("=" * 100)
    print(f"총 {len(student_data)}명의 참가자 데이터")
    print("=" * 100)
    print()

    for name, codes in sorted(student_data.items()):
        print(f"👤 {name}")
        print(f"   완료한 문제: {list(codes.keys())}")

        for prob_num in [1, 2, 3, 4]:
            code = codes.get(prob_num, '')
            if code:
                lines = code.split('\n')
                preview = lines[0][:50] if lines else ''
                print(f"   문제 {prob_num}: {preview}... ({len(code)}자)")
            else:
                print(f"   문제 {prob_num}: (없음)")

        print()


if __name__ == '__main__':
    try:
        # 데이터 로드
        student_data = load_hardskill_data()

        # 요약 출력
        print_data_summary(student_data)

        # 샘플 출력
        if student_data:
            sample_name = list(student_data.keys())[0]
            print("=" * 100)
            print(f"샘플: {sample_name}의 코드")
            print("=" * 100)

            for prob_num, code in student_data[sample_name].items():
                print(f"\n[문제 {prob_num}]")
                print(code)
                print()

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
