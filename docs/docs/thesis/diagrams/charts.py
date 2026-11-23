import json, csv
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams.update({'font.family': 'serif', 'font.serif': ['Times New Roman', 'Liberation Serif', 'DejaVu Serif'], 'font.size': 11, 'axes.titlesize': 11, 'axes.labelsize': 11,
                     'legend.fontsize': 10.5, 'xtick.labelsize': 10.5, 'ytick.labelsize': 10.5, 'savefig.dpi': 220})
# Шляхи відносно розташування скрипта: працює з будь-якої папки й на будь-якому комп'ютері
THESIS = Path(__file__).resolve().parent.parent          # docs/thesis
R = str(THESIS.parent.parent / 'loadtest' / 'results') + '/'
FIG = THESIS / 'figures'
# 1. Навантаження: затримки по рівнях
d = json.load(open(R + 'read-scenario.json'))
vus = [r['vus'] for r in d['results']]
fig, ax = plt.subplots(figsize=(6.3, 3.0))
w = 0.25
for i, (k, lab, hatch) in enumerate([('p50', 'p50', ''), ('p95', 'p95', '//'), ('p99', 'p99', 'xx')]):
    vals = [r['latencyMs'][k] for r in d['results']]
    bars = ax.bar([x + (i - 1) * w for x in range(len(vus))], vals, w, label=lab, color=['#bbbbbb', '#777777', '#333333'][i], hatch=hatch, edgecolor='black')
    for b, v in zip(bars, vals):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.8, f'{v:.1f}'.replace('.', ','), ha='center', fontsize=9.5)
ax.set_xticks(range(len(vus)), [f'{v} VU\n{r["rps"]:.0f} запитів/с'.replace('.', ',') for v, r in zip(vus, d['results'])])
ax.set_ylabel('Затримка, мс'); ax.legend(loc='upper left'); ax.set_ylim(0, max(r['latencyMs']['p99'] for r in d['results']) * 1.2)
ax.spines[['top', 'right']].set_visible(False)
fig.tight_layout(); fig.savefig(FIG / 'load-latency.png')
# 2. Обсяг даних
v = json.load(open(R + 'volume.json'))['runs']
ops = [('catalogPage', 'Каталог'), ('availabilityMonth', 'Календар'), ('quote', 'Розрахунок'),
       ('managerListPending', 'Заявки (очікують)'), ('managerListAll', 'Усі бронювання'), ('clientMyBookings', 'Мої бронювання'),
       ('utilizationReport30d', 'Звіт')]
runs = [('baseline', 100, '100'), ('baseline', 1000, '1 000'), ('baseline', 10000, '≈10 000'), ('optimized', 10000, '≈10 000, індекси V2')]
fig, ax = plt.subplots(figsize=(6.3, 3.6))
w = 0.2
cols = ['#dddddd', '#aaaaaa', '#666666', '#222222']
for i, (lab, n, name) in enumerate(runs):
    r = next(x for x in v if x['label'] == lab and x['requestedBookings'] == n)
    vals = [r['operations'][k]['p95Ms'] for k, _ in ops]
    ax.bar([x + (i - 1.5) * w for x in range(len(ops))], vals, w, label=name, color=cols[i], edgecolor='black')
ax.set_xticks(range(len(ops)), [o[1] for o in ops], rotation=20, ha='right')
ax.set_ylabel('p95, мс'); ax.set_ylim(0, 40); ax.legend(title='Бронювань у БД', ncols=4, fontsize=9.5, title_fontsize=10, loc='upper center', bbox_to_anchor=(0.5, 1.0), frameon=False)
ax.spines[['top', 'right']].set_visible(False)
fig.tight_layout(); fig.savefig(FIG / 'volume.png')
# 3. Порівняння алгоритмів календаря
rows = list(csv.DictReader(open(R + 'availability-benchmark.csv'), delimiter=';'))
fig, ax = plt.subplots(figsize=(6.3, 3.0))
for D, style in (('31', '-'), ('62', '--')):
    rr = [r for r in rows if r['D'] == D]
    B = [int(r['B']) for r in rr]
    ax.plot(B, [float(r['naive_us']) for r in rr], 'o' + style, color='black', label=f'наївний O(B·D), D = {D}')
    ax.plot(B, [float(r['sweep_us']) for r in rr], 's' + style, color='#888888', label=f'масив різниць O(B + D), D = {D}')
ax.set_xscale('log'); ax.set_yscale('log'); ax.set_xlabel('Кількість інтервалів B'); ax.set_ylabel('Час, мкс (медіана)')
ax.legend(fontsize=9.5); ax.grid(True, which='major', alpha=.3); ax.spines[['top', 'right']].set_visible(False)
fig.tight_layout(); fig.savefig(FIG / 'benchmark.png')
print('ok')
