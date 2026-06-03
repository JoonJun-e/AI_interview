#!/usr/bin/env python3
"""
하드스킬 채점 스크립트
- 자기소개를 제외한 1, 2, 3, 4번 코딩 문제 채점
- 발화 문항(1-2, 2-2, 3-2, 4-2)은 제외
"""

import os
import re
import ast
import sys
import signal
from typing import Dict, List, Tuple
import traceback

# 출력 버퍼링 비활성화
sys.stdout.reconfigure(line_buffering=True)

# 타임아웃 예외
class TimeoutError(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutError("테스트 실행 시간 초과")

# 타임아웃 설정 (각 테스트당 2초)
TEST_TIMEOUT = 2

# ============================================================================
# 정답 코드 정의
# ============================================================================

ANSWER_CODE = {
    1: """def solution(num1, num2):
    return num1 * num2""",

    2: """def solution(angle):
    if 0 < angle < 90:
        return 1  # 예각
    elif angle == 90:
        return 2  # 직각
    elif 90 < angle < 180:
        return 3  # 둔각
    else:  # angle == 180
        return 4  # 평각""",

    3: """def solution(N):
    return sum(int(digit) for digit in str(N))""",
}

# ============================================================================
# 테스트 케이스 정의
# ============================================================================

TEST_CASES = {
    1: [
        ((3, 4), 12),
        ((27, 19), 513),
        ((0, 5), 0),
        ((100, 1), 100),
        ((-5, 3), -15),
    ],

    2: [
        (70, 1),   # 예각
        (90, 2),   # 직각
        (120, 3),  # 둔각
        (180, 4),  # 평각
        (45, 1),   # 예각
        (179, 3),  # 둔각
    ],

    3: [
        (123, 6),
        (987, 24),
        (5, 5),
        (999, 27),
        (100, 1),
    ],
}

# ============================================================================
# 코드 실행 및 테스트
# ============================================================================

def extract_function_from_code(code: str) -> str:
    """코드에서 함수 정의 부분만 추출"""
    # 여러 줄 주석 제거
    code = re.sub(r'""".*?"""', '', code, flags=re.DOTALL)
    code = re.sub(r"'''.*?'''", '', code, flags=re.DOTALL)

    # 한 줄 주석 제거 (함수 내부 주석은 유지)
    lines = []
    for line in code.split('\n'):
        # 들여쓰기가 있으면 주석 유지 (함수 내부)
        if line.strip().startswith('#') and not line.startswith('    '):
            continue
        lines.append(line)

    return '\n'.join(lines)


def normalize_code(code: str) -> str:
    """코드 정규화: 공백, 들여쓰기, 주석 등 정리"""
    try:
        # AST로 파싱해서 재생성하면 정규화됨
        tree = ast.parse(code)
        return ast.unparse(tree)
    except:
        # 파싱 실패하면 원본 반환
        return code.strip()


def test_solution(problem_num: int, student_code: str) -> Tuple[float, str, List[Dict]]:
    """
    솔루션 테스트 실행

    Returns:
        (점수, 피드백, 테스트결과리스트)
    """
    if not student_code or student_code.strip() == "":
        return 0.0, "코드가 비어있습니다.", []

    # input() 사용 감지
    if 'input(' in student_code:
        return 0.0, "input() 사용으로 테스트 불가 (solution 함수 형식 필요)", []

    # 함수 추출
    student_code = extract_function_from_code(student_code)

    # 테스트 케이스 가져오기
    test_cases = TEST_CASES.get(problem_num, [])
    if not test_cases:
        return 0.0, f"문제 {problem_num}에 대한 테스트 케이스가 없습니다.", []

    # 네임스페이스 준비
    namespace = {}

    # 코드 실행
    try:
        exec(student_code, namespace)
    except SyntaxError as e:
        return 0.0, f"구문 오류: {e}", []
    except Exception as e:
        return 0.0, f"실행 오류: {e}", []

    # solution 함수 확인
    if 'solution' not in namespace:
        return 0.0, "solution 함수를 찾을 수 없습니다.", []

    solution_func = namespace['solution']

    # 각 테스트 케이스 실행
    test_results = []
    passed = 0

    for i, (input_data, expected) in enumerate(test_cases, 1):
        try:
            # 타임아웃 설정
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(TEST_TIMEOUT)

            try:
                # 입력이 튜플이면 언팩, 아니면 그대로
                if isinstance(input_data, tuple):
                    result = solution_func(*input_data)
                else:
                    result = solution_func(input_data)

                is_pass = result == expected

                test_results.append({
                    'test_num': i,
                    'input': input_data,
                    'expected': expected,
                    'output': result,
                    'passed': is_pass
                })

                if is_pass:
                    passed += 1

            finally:
                # 타임아웃 해제
                signal.alarm(0)

        except TimeoutError:
            test_results.append({
                'test_num': i,
                'input': input_data,
                'expected': expected,
                'output': None,
                'error': '실행 시간 초과 (무한 루프 의심)',
                'passed': False
            })

        except Exception as e:
            test_results.append({
                'test_num': i,
                'input': input_data,
                'expected': expected,
                'output': None,
                'error': str(e),
                'passed': False
            })

    # 점수 계산
    total_tests = len(test_cases)
    score = (passed / total_tests) * 100

    # 피드백 생성
    feedback = f"{passed}/{total_tests} 테스트 통과"

    return score, feedback, test_results


def calculate_partial_score(problem_num: int, student_code: str, test_score: float) -> float:
    """
    부분 점수 계산
    - 테스트 통과율 기반
    - 코드 품질 보너스
    """
    if test_score == 0:
        # 테스트를 하나도 못 통과했지만 함수는 정의함
        if 'def solution' in student_code:
            return 10.0  # 10점 부분 점수
        return 0.0

    base_score = test_score

    # 보너스 점수 (최대 10점)
    bonus = 0.0

    # 1. 코드 간결성 보너스 (+5점)
    lines = [line for line in student_code.split('\n') if line.strip()]
    answer_code = ANSWER_CODE.get(problem_num, "")
    answer_lines = [line for line in answer_code.split('\n') if line.strip()]

    if len(lines) <= len(answer_lines) + 2:
        bonus += 5.0

    # 2. 효율성 보너스 (+5점) - 문제별로 다르게 적용
    if problem_num == 3:
        # 3번 문제: sum() 사용 여부
        if 'sum(' in student_code:
            bonus += 5.0

    return min(base_score + bonus, 100.0)


# ============================================================================
# 채점 메인 함수
# ============================================================================

def grade_student(name: str, codes: Dict[int, str]) -> Dict:
    """
    학생 채점

    Args:
        name: 학생 이름
        codes: {문제번호: 코드} 딕셔너리

    Returns:
        채점 결과 딕셔너리
    """
    print(f"\n{'='*70}")
    print(f"📝 채점 중: {name}")
    print(f"{'='*70}\n")

    results = {
        'name': name,
        'problems': {},
        'total_score': 0.0,
        'completed': 0,
        'summary': ""
    }

    # 각 문제 채점
    for problem_num in [1, 2, 3]:
        print(f"문제 {problem_num} 채점 중...")

        code = codes.get(problem_num, "")

        if not code or code.strip() == "":
            print(f"  ❌ 코드 없음 (0점)\n")
            results['problems'][problem_num] = {
                'score': 0.0,
                'feedback': "코드가 제출되지 않았습니다.",
                'test_results': []
            }
            continue

        # 테스트 실행
        test_score, feedback, test_results = test_solution(problem_num, code)

        # 부분 점수 계산
        final_score = calculate_partial_score(problem_num, code, test_score)

        print(f"  ✅ 점수: {final_score:.1f}점 ({feedback})\n")

        results['problems'][problem_num] = {
            'score': final_score,
            'feedback': feedback,
            'test_results': test_results
        }

        if final_score > 0:
            results['completed'] += 1

    # 총점 계산 (각 문제 33.33점 만점, 총 100점)
    total_score = sum(
        results['problems'][i]['score'] / 3.0
        for i in [1, 2, 3]
        if i in results['problems']
    )

    results['total_score'] = total_score

    # 요약
    results['summary'] = f"{results['completed']}/3 문제 완료, 총점: {total_score:.1f}/100"

    print(f"\n{'='*70}")
    print(f"📊 {name} 채점 완료: {results['summary']}")
    print(f"{'='*70}\n")

    return results


def generate_report(all_results: List[Dict], output_file: str = "hardskill_grades.txt"):
    """채점 결과 리포트 생성"""

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("="*70 + "\n")
        f.write("하드스킬 채점 결과 리포트\n")
        f.write("="*70 + "\n\n")

        for result in sorted(all_results, key=lambda x: x['total_score'], reverse=True):
            f.write(f"👤 {result['name']}\n")
            f.write(f"   총점: {result['total_score']:.1f}/100\n")
            f.write(f"   완료: {result['completed']}/3 문제\n\n")

            for prob_num in [1, 2, 3]:
                if prob_num in result['problems']:
                    prob_result = result['problems'][prob_num]
                    f.write(f"   문제 {prob_num}: {prob_result['score']:.1f}점 - {prob_result['feedback']}\n")
                else:
                    f.write(f"   문제 {prob_num}: 0.0점 - 코드 없음\n")

            f.write("\n" + "-"*70 + "\n\n")

        # 통계
        f.write("\n" + "="*70 + "\n")
        f.write("📊 전체 통계\n")
        f.write("="*70 + "\n\n")

        avg_score = sum(r['total_score'] for r in all_results) / len(all_results)
        f.write(f"평균 점수: {avg_score:.1f}/100\n")

        for prob_num in [1, 2, 3]:
            scores = [r['problems'].get(prob_num, {}).get('score', 0.0) for r in all_results]
            avg_prob = sum(scores) / len(scores) if scores else 0.0
            f.write(f"문제 {prob_num} 평균: {avg_prob:.1f}/100\n")

    print(f"\n✅ 리포트 생성 완료: {output_file}")


# ============================================================================
# 메인 실행
# ============================================================================

if __name__ == '__main__':
    # 하드스킬 데이터 로드
    from load_hardskill_data import load_hardskill_data

    print("📂 하드스킬 답안 데이터 로딩 중...")
    student_codes = load_hardskill_data('ai_interview_hard_answer.xlsx')
    print(f"✅ {len(student_codes)}명의 데이터 로드 완료\n")

    # 채점 실행
    all_results = []
    for name, codes in sorted(student_codes.items()):
        # 빈 코드는 건너뛰기
        if not codes:
            print(f"⏭️  {name}: 제출된 코드 없음 (건너뛰기)\n")
            continue

        result = grade_student(name, codes)
        all_results.append(result)

    # 리포트 생성
    if all_results:
        generate_report(all_results)
        print("\n🎉 모든 채점 완료!")
        print(f"📊 총 {len(all_results)}명 채점")
    else:
        print("\n❌ 채점할 데이터가 없습니다.")
