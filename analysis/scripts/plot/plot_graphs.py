#!/usr/bin/env python3
"""
AI 면접 실험 결과 시각화
- PJ (Procedural Justice)
- OJ (Overall Justice)
- OUTSAT (Outcome Satisfaction)
"""

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from scipy import stats
import matplotlib.font_manager as fm
from pathlib import Path

# 한글 폰트 설정 (macOS)
plt.rcParams['font.family'] = 'AppleGothic'
plt.rcParams['axes.unicode_minus'] = False

DATA_DIR = Path(__file__).parent.parent.parent / 'data'
FIGURES_DIR = Path(__file__).parent.parent.parent / 'results' / 'figures'
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

# 데이터 로드
df = pd.read_excel(DATA_DIR / 'data_Fin.xlsx')

# Skill과 Outcome을 텍스트로 변환
df['Skill_label'] = df['Skill'].map({1: '하드스킬', 0: '소프트스킬'})
df['Outcome_label'] = df['Outcome'].map({1: '합격', 0: '불합격'})

# 그래프를 그릴 변수들
variables = {
    'PJ': 'PJ의 추정 주변 평균',
    'OJ': 'OJ의 추정 주변 평균',
    'OUTSAT': 'OUTSAT의 추정 주변 평균'
}

# 색상 설정
colors = {
    '하드스킬': '#5DADE2',  # 파란색
    '소프트스킬': '#943D8C'  # 자주색
}

def calculate_stats(data, var):
    """각 조건별 평균과 95% CI 계산"""
    stats_dict = {}

    for skill in ['하드스킬', '소프트스킬']:
        for outcome in ['불합격', '합격']:
            subset = data[(data['Skill_label'] == skill) & (data['Outcome_label'] == outcome)]
            values = subset[var].dropna()

            mean = values.mean()
            se = stats.sem(values)  # Standard Error
            ci = se * 1.96  # 95% CI

            stats_dict[(skill, outcome)] = {
                'mean': mean,
                'se': se,
                'ci': ci,
                'n': len(values)
            }

    return stats_dict

def plot_interaction(ax, stats_dict, var_name, title):
    """Interaction plot (좌측)"""
    skills = ['하드스킬', '소프트스킬']

    for outcome in ['불합격', '합격']:
        means = [stats_dict[(skill, outcome)]['mean'] for skill in skills]

        # 선 색상 설정 (불합격=파란색, 합격=빨간색)
        color = '#5DADE2' if outcome == '불합격' else '#E8A0BF'
        marker = 'o'

        ax.plot(skills, means,
                marker=marker, color=color, linewidth=2, markersize=8,
                label=outcome)

    ax.set_xlabel('Skill', fontsize=12, fontweight='bold')
    ax.set_ylabel('추정 주변 평균', fontsize=12, fontweight='bold')
    ax.set_title(title, fontsize=13, fontweight='bold', pad=15)
    ax.grid(True, alpha=0.3)
    ax.set_ylim(2.5, 6.0)  # Y축 범위 조정

    # 범례 설정 (Outcome)
    ax.legend(title='Outcome', labels=['불합격', '합격'],
             loc='best', frameon=True)

def plot_bars(ax, stats_dict, var_name, title):
    """Bar chart with error bars (우측)"""
    x = np.arange(2)  # 불합격, 합격
    width = 0.35

    outcomes = ['불합격', '합격']

    # 하드스킬
    hard_means = [stats_dict[('하드스킬', outcome)]['mean'] for outcome in outcomes]
    hard_cis = [stats_dict[('하드스킬', outcome)]['ci'] for outcome in outcomes]

    # 소프트스킬
    soft_means = [stats_dict[('소프트스킬', outcome)]['mean'] for outcome in outcomes]
    soft_cis = [stats_dict[('소프트스킬', outcome)]['ci'] for outcome in outcomes]

    # 바 그래프
    bars1 = ax.bar(x - width/2, hard_means, width,
                   yerr=hard_cis, capsize=5,
                   label='하드스킬', color=colors['하드스킬'],
                   error_kw={'linewidth': 2, 'ecolor': 'black'})

    bars2 = ax.bar(x + width/2, soft_means, width,
                   yerr=soft_cis, capsize=5,
                   label='소프트스킬', color=colors['소프트스킬'],
                   error_kw={'linewidth': 2, 'ecolor': 'black'})

    ax.set_ylabel('추정 주변 평균', fontsize=12, fontweight='bold')
    ax.set_xlabel('Outcome', fontsize=12, fontweight='bold')
    ax.set_title(title, fontsize=13, fontweight='bold', pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(outcomes)
    ax.legend(title='Skill', loc='upper right', frameon=True)
    ax.set_ylim(0, 6)
    ax.grid(True, alpha=0.3, axis='y')

# 각 변수별로 그래프 생성
for var, title_base in variables.items():
    print(f"\nProcessing {var}...")

    # 통계 계산
    stats_dict = calculate_stats(df, var)

    # Figure 생성 (2개의 subplot)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle(f'{var}의 추정 주변 평균', fontsize=16, fontweight='bold', y=0.98)

    # 좌측: Interaction plot
    plot_interaction(ax1, stats_dict, var, f'{var}의 추정 주변 평균')

    # 우측: Bar chart
    plot_bars(ax2, stats_dict, var, f'{var}의 추정 주변 평균')

    # 하단 텍스트
    fig.text(0.5, 0.02, '모형에 나타나는 공변량은 다음 값에 대해 계산됩니다: MH = 3.2271\n오차 막대: 95% CI',
             ha='center', fontsize=10, style='italic')

    plt.tight_layout(rect=[0, 0.05, 1, 0.96])

    # 저장
    filename = FIGURES_DIR / f'{var}_plots.png'
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"Saved: {filename}")

    plt.close()

print("\n✅ All graphs generated successfully!")
print("\nGenerated files:")
for var in variables.keys():
    print(f"  - {var}_plots.png")
