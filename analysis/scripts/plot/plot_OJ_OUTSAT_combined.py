#!/usr/bin/env python3
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from scipy import stats
import statsmodels.formula.api as smf
from pathlib import Path

plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['axes.unicode_minus'] = False

DATA_DIR = Path(__file__).parent.parent.parent / 'data'
FIGURES_DIR = Path(__file__).parent.parent.parent / 'results' / 'figures'
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_excel(DATA_DIR / 'data_Fin.xlsx')
df['Skill_label'] = df['Skill'].map({1: 'Soft Skill', 0: 'Hard Skill'})
df['Outcome_label'] = df['Outcome'].map({1: 'Accepted', 0: 'Rejected'})

MH_MEAN = 3.2271

conditions = [
    ('Hard Skill', 'Rejected'),
    ('Soft Skill', 'Rejected'),
    ('Hard Skill', 'Accepted'),
    ('Soft Skill', 'Accepted'),
]

def compute_emm(df, var):
    model = smf.ols(f'{var} ~ C(Skill) * C(Outcome) + MH', data=df).fit()
    results = {}
    for skill, outcome in conditions:
        skill_code = 0 if skill == 'Hard Skill' else 1
        outcome_code = 1 if outcome == 'Accepted' else 0
        pred_df = pd.DataFrame({'Skill': [skill_code], 'Outcome': [outcome_code], 'MH': [MH_MEAN]})
        pred = model.get_prediction(pred_df).summary_frame(alpha=0.05)
        emm = pred['mean'].values[0]
        ci = (pred['mean_ci_upper'].values[0] - pred['mean_ci_lower'].values[0]) / 2
        results[(skill, outcome)] = {'emm': emm, 'ci': ci}
    return results

print("Computing EMMs...")
emm_oj = compute_emm(df, 'OJ')
emm_outsat = compute_emm(df, 'OUTSAT')

def plot_interaction(ax, emm_dict, ylabel):
    skills = ['Hard Skill', 'Soft Skill']
    for outcome in ['Rejected', 'Accepted']:
        means = [emm_dict[(skill, outcome)]['emm'] for skill in skills]
        color = '#5DADE2' if outcome == 'Rejected' else '#E8A0BF'
        ax.plot(skills, means, marker='o', color=color, linewidth=2, markersize=8, label=outcome)

    ax.set_ylabel(ylabel, fontsize=13, fontweight='bold')
    ax.set_xlim(-0.3, 1.3)
    ax.tick_params(axis='x', labelsize=16)
    ax.grid(True, alpha=0.3)
    ax.legend(title='Outcome', loc='best', frameon=True)

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(7, 10))

plot_interaction(ax1, emm_oj, 'Perceived Fairness')
plot_interaction(ax2, emm_outsat, 'Outcome Satisfaction')

fig.text(0.5, 0.01,
         'Covariates evaluated at: Machine Heuristic = 3.2271',
         ha='center', fontsize=11, style='italic')

plt.tight_layout(rect=[0, 0.04, 1, 1])
plt.subplots_adjust(hspace=0.4)

output_file = FIGURES_DIR / 'OJ_OUTSAT_combined.png'
plt.savefig(output_file, dpi=300, bbox_inches='tight', pad_inches=0.5)
print(f"Saved: {output_file}")
plt.close()
