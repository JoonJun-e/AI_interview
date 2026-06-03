#!/usr/bin/env python3
"""
AI 면접 실험 결과 시각화 (분리 버전)
- Interaction plots: 각각 따로
- Bar charts: 3개 변수 나란히 (EMM 기반)
- Comparison table: Raw Mean vs EMM 비교
"""

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from scipy import stats
import statsmodels.formula.api as smf
from pathlib import Path

# 폰트 설정
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['axes.unicode_minus'] = False

DATA_DIR = Path(__file__).parent.parent.parent / 'data'
FIGURES_DIR = Path(__file__).parent.parent.parent / 'results' / 'figures'
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

# 데이터 로드
df = pd.read_excel(DATA_DIR / 'data_Fin.xlsx')

# Skill과 Outcome을 영어 텍스트로 변환
# SPSS 기준: Skill=1 → Soft Skill, Skill=0 → Hard Skill (confirmed by EMM comparison)
df['Skill_label'] = df['Skill'].map({1: 'Soft Skill', 0: 'Hard Skill'})
df['Outcome_label'] = df['Outcome'].map({1: 'Accepted', 0: 'Rejected'})

# 그래프를 그릴 변수들
variables = {
    'PJ':     'Procedural Justice',
    'OJ':     'Overall Justice',
    'OUTSAT': 'Outcome Satisfaction'
}

MH_MEAN = 3.2271

# 색상 설정
colors = {
    'Hard Skill': '#5DADE2',
    'Soft Skill':  '#943D8C'
}

# ============================================================
# EMM 계산 (ANCOVA: DV ~ Skill * Outcome + MH)
# ============================================================
conditions = [
    ('Hard Skill', 'Rejected'),
    ('Soft Skill', 'Rejected'),
    ('Hard Skill', 'Accepted'),
    ('Soft Skill', 'Accepted'),
]

def compute_emm(df, var):
    """ANCOVA 모델로 EMM 및 95% CI 계산"""
    model = smf.ols(f'{var} ~ C(Skill) * C(Outcome) + MH', data=df).fit()
    results = {}
    for skill, outcome in conditions:
        skill_code = 0 if skill == 'Hard Skill' else 1
        outcome_code = 1 if outcome == 'Accepted' else 0
        pred_df = pd.DataFrame({
            'Skill': [skill_code],
            'Outcome': [outcome_code],
            'MH': [MH_MEAN]
        })
        pred = model.get_prediction(pred_df).summary_frame(alpha=0.05)
        emm = pred['mean'].values[0]
        ci = (pred['mean_ci_upper'].values[0] - pred['mean_ci_lower'].values[0]) / 2
        results[(skill, outcome)] = {'emm': emm, 'ci': ci}
    return results

print("\n=== Computing EMMs via ANCOVA ===")
all_emm = {}
all_raw = {}
for var in variables:
    all_emm[var] = compute_emm(df, var)
    all_raw[var] = {}
    for skill, outcome in conditions:
        subset = df[(df['Skill_label'] == skill) & (df['Outcome_label'] == outcome)][var].dropna()
        all_raw[var][(skill, outcome)] = {
            'mean': subset.mean(),
            'ci': stats.sem(subset) * 1.96,
            'n': len(subset)
        }
    print(f"  {var}: done")

# ============================================================
# 0. Comparison Table: Raw Mean vs EMM
# ============================================================
print("\n=== Generating comparison table ===")

fig_tbl, ax_tbl = plt.subplots(figsize=(14, 6))
ax_tbl.axis('off')

col_labels = ['Variable', 'Skill', 'Outcome', 'N', 'Raw Mean', 'EMM', 'Diff (EMM-Raw)']
row_data = []
for var, var_title in variables.items():
    for skill, outcome in conditions:
        raw = all_raw[var][(skill, outcome)]
        emm = all_emm[var][(skill, outcome)]
        diff = emm['emm'] - raw['mean']
        row_data.append([
            var_title, skill, outcome,
            str(raw['n']),
            f"{raw['mean']:.3f}",
            f"{emm['emm']:.3f}",
            f"{diff:+.3f}"
        ])

table = ax_tbl.table(
    cellText=row_data,
    colLabels=col_labels,
    loc='center',
    cellLoc='center'
)
table.auto_set_font_size(False)
table.set_fontsize(10)
table.scale(1, 1.6)

# 헤더 스타일
for j in range(len(col_labels)):
    table[0, j].set_facecolor('#2C3E50')
    table[0, j].set_text_props(color='white', fontweight='bold')

# 변수별 행 색상
var_colors = {
    'Procedural Justice':   '#EBF5FB',
    'Overall Justice':      '#FEF9E7',
    'Outcome Satisfaction': '#EAFAF1',
}
for i, row in enumerate(row_data):
    bg = var_colors.get(row[0], 'white')
    for j in range(len(col_labels)):
        table[i + 1, j].set_facecolor(bg)
        # Diff 열: 양수=초록, 음수=빨강
        if j == 6:
            val = float(row[6])
            table[i + 1, j].set_text_props(
                color='#1A5276' if val >= 0 else '#922B21',
                fontweight='bold'
            )

ax_tbl.set_title('Raw Mean vs EMM Comparison\n(EMM: ANCOVA adjusted at Machine Heuristic = 3.2271)',
                 fontsize=13, fontweight='bold', pad=20)

plt.tight_layout()
plt.savefig(FIGURES_DIR / 'Comparison_RawVsEMM.png', dpi=300, bbox_inches='tight')
print("✅ Saved: Comparison_RawVsEMM.png")
plt.close()

# ============================================================
# 공통 함수
# ============================================================
def calculate_stats(data, var):
    stats_dict = {}
    for skill in ['Hard Skill', 'Soft Skill']:
        for outcome in ['Rejected', 'Accepted']:
            subset = data[(data['Skill_label'] == skill) & (data['Outcome_label'] == outcome)]
            values = subset[var].dropna()
            mean = values.mean()
            se = stats.sem(values)
            ci = se * 1.96
            stats_dict[(skill, outcome)] = {'mean': mean, 'se': se, 'ci': ci, 'n': len(values)}
    return stats_dict

def plot_interaction_emm(ax, emm_dict, title):
    """Interaction plot using EMM values"""
    skills = ['Hard Skill', 'Soft Skill']
    for outcome in ['Rejected', 'Accepted']:
        means = [emm_dict[(skill, outcome)]['emm'] for skill in skills]
        color = '#5DADE2' if outcome == 'Rejected' else '#E8A0BF'
        ax.plot(skills, means, marker='o', color=color, linewidth=2, markersize=8, label=outcome)
    ax.set_xlabel('Skill', fontsize=13, fontweight='bold')
    ax.set_ylabel('Estimated Marginal Mean', fontsize=13, fontweight='bold')
    ax.set_title(title, fontsize=14, fontweight='bold', pad=15)
    ax.set_xlim(-0.3, 1.3)
    ax.grid(True, alpha=0.3)
    ax.legend(title='Outcome', loc='best', frameon=True)

# ============================================================
# 1. Interaction plots 각각 따로 생성 (EMM 기반)
# ============================================================
print("\n=== Generating individual interaction plots (EMM) ===")

for var, title_base in variables.items():
    fig, ax = plt.subplots(1, 1, figsize=(7, 5))
    plot_interaction_emm(ax, all_emm[var], variables[var])
    fig.text(0.5, 0.02, 'Covariates evaluated at: Machine Heuristic = 3.2271',
             ha='center', fontsize=11, style='italic')
    plt.tight_layout(rect=[0, 0.05, 1, 0.98])
    filename = FIGURES_DIR / f'{var}_interaction.png'
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"✅ Saved: {filename}")
    plt.close()

# ============================================================
# 2. Bar charts (EMM 기반): Skill → Outcome 순서
# ============================================================
print("\n=== Generating combined bar charts (Skill × Outcome, EMM) ===")

var_list = list(variables.keys())

conditions_so = [
    ('Hard Skill', 'Accepted'),
    ('Hard Skill', 'Rejected'),
    ('Soft Skill', 'Accepted'),
    ('Soft Skill', 'Rejected'),
]

bar_colors = {
    ('Hard Skill', 'Accepted'): '#2471A3',
    ('Hard Skill', 'Rejected'): '#AED6F1',
    ('Soft Skill', 'Accepted'): '#6C3483',
    ('Soft Skill', 'Rejected'): '#D7BDE2',
}
text_colors = {
    ('Hard Skill', 'Accepted'): 'white',
    ('Hard Skill', 'Rejected'): '#333333',
    ('Soft Skill', 'Accepted'): 'white',
    ('Soft Skill', 'Rejected'): '#333333',
}

n_vars = len(var_list)
bar_width = 0.75
bar_gap = 0.08
skill_gap = 0.25
group_gap = 0.85
group_width = 4 * bar_width + 2 * bar_gap + skill_gap

fig, ax = plt.subplots(figsize=(17, 7))
group_centers = np.arange(n_vars) * (group_width + group_gap)

bar_positions = []
bar_labels = []
skill_centers_all = []

for v_idx, var in enumerate(var_list):
    center = group_centers[v_idx]
    start = center - group_width / 2 + bar_width / 2
    x_positions = [
        start + 0 * (bar_width + bar_gap),
        start + 1 * (bar_width + bar_gap),
        start + 2 * (bar_width + bar_gap) + skill_gap,
        start + 3 * (bar_width + bar_gap) + skill_gap,
    ]
    hard_center = (x_positions[0] + x_positions[1]) / 2
    soft_center = (x_positions[2] + x_positions[3]) / 2
    skill_centers_all.append((hard_center, soft_center))

    for c_idx, (skill, outcome) in enumerate(conditions_so):
        emm_val = all_emm[var][(skill, outcome)]['emm']
        ci_val  = all_emm[var][(skill, outcome)]['ci']
        x_pos = x_positions[c_idx]

        ax.bar(x_pos, emm_val, bar_width,
               color=bar_colors[(skill, outcome)],
               edgecolor='white', linewidth=0.5,
               yerr=ci_val, capsize=6,
               error_kw={'linewidth': 2.0, 'ecolor': '#444444', 'capthick': 2.0})

        ax.text(x_pos, 1.15, f'{emm_val:.2f}',
                ha='center', va='bottom',
                fontsize=11, color=text_colors[(skill, outcome)], fontweight='bold')

        bar_positions.append(x_pos)
        bar_labels.append(outcome)

for v_idx in range(n_vars - 1):
    sep_x = (group_centers[v_idx] + group_width / 2 + group_centers[v_idx + 1] - group_width / 2) / 2
    ax.axvline(x=sep_x, color='#888888', linewidth=1.2, linestyle='--', zorder=0)

ax.set_xticks(bar_positions)
ax.set_xticklabels(bar_labels, fontsize=11)
ax.tick_params(axis='x', length=0)

skill_tick_positions = []
skill_tick_labels = []
for hc, sc in skill_centers_all:
    skill_tick_positions += [hc, sc]
    skill_tick_labels   += ['Hard Skill', 'Soft Skill']

ax2 = ax.twiny()
ax2.set_xlim(ax.get_xlim())
ax2.set_xticks(skill_tick_positions)
ax2.set_xticklabels(skill_tick_labels, fontsize=12, fontweight='bold')
ax2.xaxis.set_ticks_position('bottom')
ax2.xaxis.set_label_position('bottom')
ax2.spines['bottom'].set_position(('outward', 38))
ax2.tick_params(axis='x', length=0, pad=2)

ax3 = ax.twiny()
ax3.set_xlim(ax.get_xlim())
ax3.set_xticks(group_centers)
ax3.set_xticklabels([variables[v] for v in var_list], fontsize=13, fontweight='bold')
ax3.xaxis.set_ticks_position('bottom')
ax3.xaxis.set_label_position('bottom')
ax3.spines['bottom'].set_position(('outward', 75))
ax3.tick_params(axis='x', length=0, pad=2)

legend_elements = [
    mpatches.Patch(facecolor=bar_colors[('Hard Skill', 'Accepted')],   label='Hard Skill × Accepted'),
    mpatches.Patch(facecolor=bar_colors[('Hard Skill', 'Rejected')], label='Hard Skill × Rejected', edgecolor='#AAAAAA'),
    mpatches.Patch(facecolor=bar_colors[('Soft Skill', 'Accepted')],   label='Soft Skill × Accepted'),
    mpatches.Patch(facecolor=bar_colors[('Soft Skill', 'Rejected')], label='Soft Skill × Rejected', edgecolor='#AAAAAA'),
]
ax.legend(handles=legend_elements, loc='upper right', frameon=True, fontsize=11)
ax.set_ylabel('Estimated Marginal Mean', fontsize=13, fontweight='bold')
ax.set_ylim(1, 7.5)
ax.set_yticks(np.arange(1, 7.5, 1))
ax.tick_params(axis='y', labelsize=11)
ax.yaxis.grid(True, alpha=0.4, linestyle='-', linewidth=0.8)
ax.set_axisbelow(True)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color('#AAAAAA')
ax.spines['bottom'].set_color('#AAAAAA')

fig.text(0.5, -0.03,
         'Covariates evaluated at: Machine Heuristic = 3.2271    Error bars: 95% CI',
         ha='center', fontsize=11, style='italic', color='gray')

plt.tight_layout()
plt.savefig(FIGURES_DIR / 'All_BarCharts.png', dpi=300, bbox_inches='tight')
print("✅ Saved: All_BarCharts.png")
plt.close()

# ============================================================
# 3. Bar charts (EMM 기반): Outcome → Skill 순서
# ============================================================
print("\n=== Generating combined bar charts (Outcome × Skill, EMM) ===")

conditions_os = [
    ('Hard Skill', 'Accepted'),
    ('Soft Skill', 'Accepted'),
    ('Hard Skill', 'Rejected'),
    ('Soft Skill', 'Rejected'),
]

bar_colors_os = {
    ('Hard Skill', 'Accepted'): '#2471A3',
    ('Soft Skill', 'Accepted'): '#6C3483',
    ('Hard Skill', 'Rejected'): '#AED6F1',
    ('Soft Skill', 'Rejected'): '#D7BDE2',
}
text_colors_os = {
    ('Hard Skill', 'Accepted'): 'white',
    ('Soft Skill', 'Accepted'): 'white',
    ('Hard Skill', 'Rejected'): '#333333',
    ('Soft Skill', 'Rejected'): '#333333',
}

fig2, ax_os = plt.subplots(figsize=(17, 7))

bar_positions_os = []
bar_labels_os = []
outcome_centers_all = []

for v_idx, var in enumerate(var_list):
    center = group_centers[v_idx]
    start = center - group_width / 2 + bar_width / 2
    x_positions = [
        start + 0 * (bar_width + bar_gap),
        start + 1 * (bar_width + bar_gap),
        start + 2 * (bar_width + bar_gap) + skill_gap,
        start + 3 * (bar_width + bar_gap) + skill_gap,
    ]
    acc_center = (x_positions[0] + x_positions[1]) / 2
    rej_center = (x_positions[2] + x_positions[3]) / 2
    outcome_centers_all.append((acc_center, rej_center))

    for c_idx, (skill, outcome) in enumerate(conditions_os):
        emm_val = all_emm[var][(skill, outcome)]['emm']
        ci_val  = all_emm[var][(skill, outcome)]['ci']
        x_pos = x_positions[c_idx]

        ax_os.bar(x_pos, emm_val, bar_width,
                  color=bar_colors_os[(skill, outcome)],
                  edgecolor='white', linewidth=0.5,
                  yerr=ci_val, capsize=6,
                  error_kw={'linewidth': 2.0, 'ecolor': '#444444', 'capthick': 2.0})

        ax_os.text(x_pos, 1.15, f'{emm_val:.2f}',
                   ha='center', va='bottom',
                   fontsize=11, color=text_colors_os[(skill, outcome)], fontweight='bold')

        bar_positions_os.append(x_pos)
        bar_labels_os.append(skill)

for v_idx in range(n_vars - 1):
    sep_x = (group_centers[v_idx] + group_width / 2 + group_centers[v_idx + 1] - group_width / 2) / 2
    ax_os.axvline(x=sep_x, color='#888888', linewidth=1.2, linestyle='--', zorder=0)

ax_os.set_xticks(bar_positions_os)
ax_os.set_xticklabels(bar_labels_os, fontsize=11)
ax_os.tick_params(axis='x', length=0)

outcome_tick_positions = []
outcome_tick_labels = []
for ac, rc in outcome_centers_all:
    outcome_tick_positions += [ac, rc]
    outcome_tick_labels   += ['Accepted', 'Rejected']

ax2_os = ax_os.twiny()
ax2_os.set_xlim(ax_os.get_xlim())
ax2_os.set_xticks(outcome_tick_positions)
ax2_os.set_xticklabels(outcome_tick_labels, fontsize=12, fontweight='bold')
ax2_os.xaxis.set_ticks_position('bottom')
ax2_os.xaxis.set_label_position('bottom')
ax2_os.spines['bottom'].set_position(('outward', 38))
ax2_os.tick_params(axis='x', length=0, pad=2)

ax3_os = ax_os.twiny()
ax3_os.set_xlim(ax_os.get_xlim())
ax3_os.set_xticks(group_centers)
ax3_os.set_xticklabels([variables[v] for v in var_list], fontsize=13, fontweight='bold')
ax3_os.xaxis.set_ticks_position('bottom')
ax3_os.xaxis.set_label_position('bottom')
ax3_os.spines['bottom'].set_position(('outward', 75))
ax3_os.tick_params(axis='x', length=0, pad=2)

legend_elements_os = [
    mpatches.Patch(facecolor=bar_colors_os[('Hard Skill', 'Accepted')], label='Accepted × Hard Skill'),
    mpatches.Patch(facecolor=bar_colors_os[('Soft Skill', 'Accepted')], label='Accepted × Soft Skill'),
    mpatches.Patch(facecolor=bar_colors_os[('Hard Skill', 'Rejected')], label='Rejected × Hard Skill', edgecolor='#AAAAAA'),
    mpatches.Patch(facecolor=bar_colors_os[('Soft Skill', 'Rejected')], label='Rejected × Soft Skill', edgecolor='#AAAAAA'),
]
ax_os.legend(handles=legend_elements_os, loc='upper right', frameon=True, fontsize=11)
ax_os.set_ylabel('Estimated Marginal Mean', fontsize=13, fontweight='bold')
ax_os.set_ylim(1, 7.5)
ax_os.set_yticks(np.arange(1, 7.5, 1))
ax_os.tick_params(axis='y', labelsize=11)
ax_os.yaxis.grid(True, alpha=0.4, linestyle='-', linewidth=0.8)
ax_os.set_axisbelow(True)
ax_os.spines['top'].set_visible(False)
ax_os.spines['right'].set_visible(False)
ax_os.spines['left'].set_color('#AAAAAA')
ax_os.spines['bottom'].set_color('#AAAAAA')

fig2.text(0.5, -0.03,
          'Covariates evaluated at: Machine Heuristic = 3.2271    Error bars: 95% CI',
          ha='center', fontsize=11, style='italic', color='gray')

plt.tight_layout()
plt.savefig(FIGURES_DIR / 'All_BarCharts_OutcomeSkill.png', dpi=300, bbox_inches='tight')
print("✅ Saved: All_BarCharts_OutcomeSkill.png")
plt.close()

print("\n🎉 All graphs generated successfully!")
print("\nGenerated files:")
print("  [Comparison table]")
print("    - Comparison_RawVsEMM.png")
print("  [Interaction plots]")
for var in variables.keys():
    print(f"    - {var}_interaction.png")
print("  [Bar charts - EMM based]")
print("    - All_BarCharts.png")
print("    - All_BarCharts_OutcomeSkill.png")
