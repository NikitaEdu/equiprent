"""Діаграма послідовності UML (створення бронювання й конфлікт), SVG у натуральному масштабі:
ширина 160 мм, шрифт 12 пт — після вставлення у записку на 160 мм написи мають 12 пт."""
MM = 72 / 25.4            # пунктів в 1 мм
W = 160 * MM
F = 12                    # кегль, пт
cols = {'BR': 17/160, 'CT': 58/160, 'SV': 104/160, 'DB': 141/160}
names = {'BR': 'Браузер', 'CT': 'Контролер', 'SV': 'BookingService', 'DB': 'PostgreSQL'}
x = {k: v * W for k, v in cols.items()}
steps = [
    ('msg', 'BR', 'CT', 'POST /api/bookings'),
    ('note', 'CT', 'сесія, CSRF, роль, поля → 400'),
    ('msg', 'CT', 'SV', 'create(запит)'),
    ('self', 'SV', 'період, вартість'),
    ('msg', 'SV', 'DB', 'BEGIN; … FOR UPDATE'),
    ('ret', 'DB', 'SV', 'екземпляри типу'),
    ('msg', 'SV', 'DB', 'активні інтервали'),
    ('ret', 'DB', 'SV', 'зайнятість'),
    ('alt', '[є вільний екземпляр]'),
    ('msg', 'SV', 'DB', 'INSERT; COMMIT'),
    ('ret', 'DB', 'SV', 'OK'),
    ('ret', 'SV', 'CT', 'бронювання'),
    ('ret', 'CT', 'BR', '201 Created'),
    ('else', '[немає вільного або SQLSTATE 23P01]'),
    ('msg', 'SV', 'DB', 'ROLLBACK'),
    ('ret', 'SV', 'CT', 'BOOKING_CONFLICT'),
    ('ret', 'CT', 'BR', '409 problem+json'),
    ('end',),
]
out = []
def text(x0, y0, s, anchor='middle', size=F, style=''):
    s = s.replace('&', '&amp;').replace('<', '&lt;')
    out.append(f'<text x="{x0:.1f}" y="{y0:.1f}" font-size="{size}" text-anchor="{anchor}" stroke="white" stroke-width="3" paint-order="stroke" {style}>{s}</text>')
def arrow(x1, x2, y, dashed):
    d = ' stroke-dasharray="4,3"' if dashed else ''
    out.append(f'<line x1="{x1:.1f}" y1="{y:.1f}" x2="{x2:.1f}" y2="{y:.1f}" stroke="black" stroke-width="0.9"{d}/>')
    s = 1 if x2 > x1 else -1
    if dashed:
        out.append(f'<polyline points="{x2-6*s:.1f},{y-3.5:.1f} {x2:.1f},{y:.1f} {x2-6*s:.1f},{y+3.5:.1f}" fill="none" stroke="black" stroke-width="0.9"/>')
    else:
        out.append(f'<polygon points="{x2-7*s:.1f},{y-3.5:.1f} {x2:.1f},{y:.1f} {x2-7*s:.1f},{y+3.5:.1f}" fill="black"/>')
y = 8
bw, bh = 31 * MM, 9 * MM
for k in x:
    out.append(f'<rect x="{x[k]-bw/2:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="white" stroke="black" stroke-width="0.9"/>')
    text(x[k], y + bh / 2 + F * 0.35, names[k])
top = y + bh
y = top + 10
alt_top = None; else_y = None
for st in steps:
    kind = st[0]
    if kind in ('msg', 'ret'):
        y += F + 4
        a, b, lab = st[1], st[2], st[3]
        text((x[a] + x[b]) / 2, y - 4, lab)
        arrow(x[a], x[b], y, kind == 'ret')
        y += 5
    elif kind == 'note':
        y += 6
        w = 56 * MM
        out.append(f'<rect x="{x[st[1]]-w/2:.1f}" y="{y:.1f}" width="{w:.1f}" height="{F+8}" fill="#eeeeee" stroke="black" stroke-width="0.7"/>')
        text(x[st[1]], y + F + 1.5, st[2])
        y += F + 10
    elif kind == 'self':
        y += F + 4
        text(x[st[1]] + 8, y - 4, st[2], anchor='start')
        out.append(f'<path d="M{x[st[1]]:.1f},{y:.1f} h22 v10 h-22" fill="none" stroke="black" stroke-width="0.9"/>')
        out.append(f'<polygon points="{x[st[1]]+7:.1f},{y+6.5:.1f} {x[st[1]]:.1f},{y+10:.1f} {x[st[1]]+7:.1f},{y+13.5:.1f}" fill="black"/>')
        y += 16
    elif kind == 'alt':
        y += 8; alt_top = y
        text(x['BR'] - 10, y + F + 1, 'alt', anchor='start')
        text(x['SV'] - 40, y + F + 1, st[1], anchor='middle', style='font-style="italic"')
        y += F + 4
    elif kind == 'else':
        y += 8; else_y = y
        text(x['SV'] - 40, y + F + 1, st[1], anchor='middle', style='font-style="italic"')
        y += F + 4
    elif kind == 'end':
        y += 8
        x0, x1 = x['BR'] - 14, x['DB'] + 14
        out.append(f'<rect x="{x0:.1f}" y="{alt_top:.1f}" width="{x1-x0:.1f}" height="{y-alt_top:.1f}" fill="none" stroke="black" stroke-width="0.9"/>')
        out.append(f'<path d="M{x0:.1f},{alt_top+F+5:.1f} h24 l6,-6 v-{F-1:.1f}" fill="none" stroke="black" stroke-width="0.9"/>')
        out.append(f'<line x1="{x0:.1f}" y1="{else_y:.1f}" x2="{x1:.1f}" y2="{else_y:.1f}" stroke="black" stroke-width="0.9" stroke-dasharray="5,3"/>')
bottom = y + 10
for k in x:
    out.insert(0, f'<line x1="{x[k]:.1f}" y1="{top:.1f}" x2="{x[k]:.1f}" y2="{bottom:.1f}" stroke="#777" stroke-width="0.8" stroke-dasharray="3,3"/>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.1f}pt" height="{bottom+6:.1f}pt" viewBox="0 0 {W:.1f} {bottom+6:.1f}" font-family="Liberation Serif, Times New Roman, serif"><rect width="100%" height="100%" fill="white"/>' + ''.join(out) + '</svg>'
import sys
open(sys.argv[1], 'w', encoding='utf-8').write(svg)
print('height mm', (bottom + 6) / MM)
