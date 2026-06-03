#!/usr/bin/env python3
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import matplotlib.patheffects as pe

# ─── 색상 ───
C_SOFT   = '#1565C0'
C_HARD   = '#6A1B9A'
C_ACC    = '#2E7D32'
C_REJ    = '#C62828'
C_CMN    = '#263238'
C_ARR    = '#546E7A'

BG_SOFT  = '#E3F2FD'
BG_HARD  = '#EDE7F6'
BG_ACC   = '#E8F5E9'
BG_REJ   = '#FFEBEE'
BG_CMN   = '#FFFFFF'

# ─── Figure ───
fig, ax = plt.subplots(figsize=(26, 10))
ax.set_xlim(0, 26)
ax.set_ylim(0, 10)
ax.axis('off')
fig.patch.set_facecolor('white')

Y_T  = 7.1
Y_M  = 4.5
Y_B  = 2.1
Y_PH = 9.35

# ─── 헬퍼 ───
def box(cx, cy, w, h, lines, tc, bg, bd, fs=10.5, bold=False, lw=2.2):
    ax.add_patch(FancyBboxPatch(
        (cx - w/2, cy - h/2), w, h,
        boxstyle='round,pad=0.15',
        facecolor=bg, edgecolor=bd,
        linewidth=lw, zorder=3
    ))
    text = '\n'.join(lines)
    ax.text(cx, cy, text,
            ha='center', va='center', fontsize=fs,
            color=tc, fontweight='bold' if bold else 'normal',
            multialignment='center', zorder=4,
            linespacing=1.45)

def arr(x1, y1, x2, y2, c=C_ARR, lw=2.2):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(
                    arrowstyle='->', color=c, lw=lw,
                    mutation_scale=18
                ), zorder=2)

def seg(x1, y1, x2, y2, c=C_ARR, lw=2.2):
    ax.plot([x1, x2], [y1, y2], color=c, lw=lw, zorder=2)

def dot(x, y, c='#263238', sz=7):
    ax.plot(x, y, 'o', color=c, markersize=sz, zorder=5)

def label_tag(cx, cy, text, fc, ec, tc, fs=10):
    ax.text(cx, cy, text, ha='center', va='center', fontsize=fs,
            color=tc, fontweight='bold',
            bbox=dict(boxstyle='round,pad=0.45',
                      facecolor=fc, edgecolor=ec, linewidth=2.0),
            zorder=5)

# ─── 페이즈 배경 ───
phases = [
    (0.15, 4.55,  '#F5F5F5', '#BDBDBD', 'Before AI Interview',  '#424242'),
    (4.65, 14.55, '#E8F4FD', '#5DADE2', 'During AI Interview',   '#0D47A1'),
    (14.65, 25.85,'#FFFDE7', '#F9A825', 'After AI Interview',    '#E65100'),
]
for x0, x1, bg, bd, lbl, tc in phases:
    ax.add_patch(FancyBboxPatch(
        (x0, 0.45), x1 - x0, 8.7,
        boxstyle='round,pad=0.12',
        facecolor=bg, edgecolor=bd,
        linewidth=2.0, alpha=0.6, zorder=0
    ))
    ax.text((x0 + x1) / 2, Y_PH, lbl,
            ha='center', va='center',
            fontsize=13.5, fontweight='bold', color=tc)

# ─── BEFORE ───
box(1.55, Y_M, 2.1, 1.3,
    ['Pre-test', 'Survey'],
    C_CMN, BG_CMN, C_CMN, fs=11)

box(3.75, Y_M, 2.1, 1.3,
    ['Providing', 'Instructions'],
    C_CMN, BG_CMN, C_CMN, fs=11)

arr(2.61, Y_M, 2.69, Y_M)   # pre-test → instructions

# ─── FORK 1 (IV1) ───
FX1 = 5.05
seg(4.81, Y_M, FX1, Y_M)
dot(FX1, Y_M)

seg(FX1, Y_M, FX1, Y_T)
arr(FX1, Y_T, 5.45, Y_T, c=C_SOFT)

seg(FX1, Y_M, FX1, Y_B)
arr(FX1, Y_B, 5.45, Y_B, c=C_HARD)

ax.text(5.28, 6.1, 'Soft\nSkill', ha='center', va='center',
        fontsize=9, color=C_SOFT, fontweight='bold')
ax.text(5.28, 3.2, 'Hard\nSkill', ha='center', va='center',
        fontsize=9, color=C_HARD, fontweight='bold')

# IV1 태그
label_tag(9.6, 8.85, '[ IV1 ]  Skill Type  ─  Soft vs. Hard',
          '#BBDEFB', '#1565C0', '#0D47A1', fs=11)

# ─── DURING: Device Check ───
box(6.55, Y_T, 2.0, 1.1, ['Device', 'Check'],  C_SOFT, BG_SOFT, C_SOFT, fs=10.5)
box(6.55, Y_B, 2.0, 1.1, ['Device', 'Check'],  C_HARD, BG_HARD, C_HARD, fs=10.5)

# ─── DURING: Interview Content ───
# Soft:  device check right=7.55, interview left=8.2
box(11.0, Y_T, 5.6, 1.8,
    ['Soft Skill Interview',
     'Self-intro (1 min)   +   6 Situational Q&A',
     'Verbal responses  (~90 sec each)'],
    C_SOFT, BG_SOFT, C_SOFT, fs=10.5)

arr(7.56, Y_T, 8.2, Y_T, c=C_SOFT)   # device check right → interview left

# Hard:  device check right=7.55, interview left=8.2
box(11.0, Y_B, 5.6, 1.8,
    ['Hard Skill Interview',
     'Self-intro (1 min)   +   4× Coding Test + Verbal Explanation',
     'Coding (90s)  +  Explanation (60s each)'],
    C_HARD, BG_HARD, C_HARD, fs=10.5)

arr(7.56, Y_B, 8.2, Y_B, c=C_HARD)

# ─── MERGE 1 ───
MX1 = 14.15
seg(13.8, Y_T, MX1, Y_T)
seg(MX1, Y_T, MX1, Y_M)
seg(13.8, Y_B, MX1, Y_B)
seg(MX1, Y_B, MX1, Y_M)
dot(MX1, Y_M)

# ─── AFTER: Watching Video ───
arr(MX1, Y_M, 15.0, Y_M)
box(16.05, Y_M, 2.0, 1.3,
    ['Watching', 'Video'],
    C_CMN, BG_CMN, C_CMN, fs=11)

# ─── FORK 2 (IV2) ───
FX2 = 17.2
seg(17.06, Y_M, FX2, Y_M)
dot(FX2, Y_M)

seg(FX2, Y_M, FX2, Y_T)
arr(FX2, Y_T, 17.6, Y_T, c=C_ACC)

seg(FX2, Y_M, FX2, Y_B)
arr(FX2, Y_B, 17.6, Y_B, c=C_REJ)

ax.text(17.42, 6.1, 'Accepted', ha='center', va='center',
        fontsize=9, color=C_ACC, fontweight='bold')
ax.text(17.42, 3.2, 'Rejected', ha='center', va='center',
        fontsize=9, color=C_REJ, fontweight='bold')

# IV2 태그
label_tag(21.1, 8.85, '[ IV2 ]  Interview Outcome  ─  Accepted vs. Rejected',
          '#FFF9C4', '#F9A825', '#E65100', fs=11)

# ─── AFTER: Result pages ───
box(20.55, Y_T, 5.6, 1.6,
    ['Accepted  (Top 20%)',
     'AI Pass Notification'],
    C_ACC, BG_ACC, C_ACC, fs=11, bold=True)

box(20.55, Y_B, 5.6, 1.6,
    ['Rejected  (Bottom 80%)',
     'AI Fail Notification'],
    C_REJ, BG_REJ, C_REJ, fs=11, bold=True)

# ─── MERGE 2 ───
MX2 = 23.5
seg(23.36, Y_T, MX2, Y_T)
seg(MX2, Y_T, MX2, Y_M)
seg(23.36, Y_B, MX2, Y_B)
seg(MX2, Y_B, MX2, Y_M)
dot(MX2, Y_M)

# ─── AFTER: Post-test Survey ───
arr(MX2, Y_M, 23.8, Y_M)
box(24.9, Y_M, 2.0, 1.3,
    ['Post-test', 'Survey'],
    C_CMN, BG_CMN, C_CMN, fs=11)

# ─── 저장 페이지 안내 ───
ax.text(9.6, 0.62,
        '※ "Saving" screen appears between each question during the interview',
        ha='center', va='center', fontsize=9, color='#78909C', style='italic')

# ─── 4 조건 레이블 ───
ax.text(20.7, 0.85,
        'TSOA  ·  TSOR  ·  THOA  ·  THOR',
        ha='center', va='center', fontsize=9.5, color='#546E7A', fontweight='bold',
        bbox=dict(boxstyle='round,pad=0.35', facecolor='#F5F5F5',
                  edgecolor='#BDBDBD', linewidth=1.2))

plt.tight_layout()
output = 'experiment_procedure.png'
plt.savefig(output, dpi=220, bbox_inches='tight',
            facecolor='white', edgecolor='none')
print(f'Saved: {output}')
plt.close()
