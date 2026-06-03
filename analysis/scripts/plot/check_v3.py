#!/usr/bin/env python3
"""v3 파일 확인 스크립트"""
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

RESULTS_DIR = Path(__file__).parent.parent.parent / 'results'

def read_xlsx(file_path):
    """xlsx 파일 읽기"""
    with zipfile.ZipFile(file_path, 'r') as z:
        # sharedStrings.xml 읽기
        shared_strings = []
        try:
            with z.open('xl/sharedStrings.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()
                ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in root.findall('.//t', ns):
                    shared_strings.append(si.text or '')
        except:
            pass

        # sheet1.xml 읽기
        with z.open('xl/worksheets/sheet1.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

            rows = []
            for row in root.findall('.//row', ns):
                row_data = {}
                for cell in row.findall('.//c', ns):
                    cell_ref = cell.get('r')
                    col = ''.join(filter(str.isalpha, cell_ref))

                    v = cell.find('.//v', ns)
                    if v is not None and v.text:
                        cell_type = cell.get('t')
                        if cell_type == 's':
                            # shared string
                            idx = int(v.text)
                            row_data[col] = shared_strings[idx]
                        else:
                            row_data[col] = v.text

                if row_data:
                    rows.append(row_data)

            return rows

# v3 파일 읽기
print("=== Word_count_result_v3.xlsx 확인 ===\n")
rows = read_xlsx(RESULTS_DIR / 'Word_count_result_v3.xlsx')

# 헤더 찾기
header = rows[0] if rows else {}
print("헤더:", header)
print()

# 444 찾기
print("=== 444가 나온 행 찾기 (정기찬, 유민지 제외) ===\n")
for i, row in enumerate(rows[1:], start=2):  # 헤더 제외
    name = row.get('A', '')

    # 정기찬, 유민지 제외
    if name in ['정기찬', '유민지']:
        continue

    # 모든 컬럼 검사
    for col, value in row.items():
        if value == '444' or (isinstance(value, str) and '444' in value):
            print(f"행 {i}: 이름={name}, 컬럼 {col}={value}")
            print(f"  전체 데이터: {row}")
            print()

# 전체 데이터 출력 (처음 10줄)
print("\n=== 전체 데이터 (처음 10줄) ===")
for i, row in enumerate(rows[:10], start=1):
    print(f"행 {i}: {row}")
