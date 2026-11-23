from pathlib import Path
"""Діаграма прецедентів UML (SVG). Ширина полотна 1000 px — шрифт 26 px дає ~11,5 пт у масштабі 160 мм."""
W, H = 1000, 800
F = "Liberation Serif, Times New Roman, serif"
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{F}">',
       '<rect width="100%" height="100%" fill="white"/>',
       '<defs><marker id="tri" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="18" markerHeight="18" orient="auto">'
       '<path d="M0,0 L20,10 L0,20 z" fill="white" stroke="black" stroke-width="1.5"/></marker></defs>']

def actor(x, y, name):
    s = [f'<circle cx="{x}" cy="{y}" r="16" fill="white" stroke="black" stroke-width="2.5"/>',
         f'<line x1="{x}" y1="{y+16}" x2="{x}" y2="{y+62}" stroke="black" stroke-width="2.5"/>',
         f'<line x1="{x-26}" y1="{y+32}" x2="{x+26}" y2="{y+32}" stroke="black" stroke-width="2.5"/>',
         f'<line x1="{x}" y1="{y+62}" x2="{x-22}" y2="{y+96}" stroke="black" stroke-width="2.5"/>',
         f'<line x1="{x}" y1="{y+62}" x2="{x+22}" y2="{y+96}" stroke="black" stroke-width="2.5"/>',
         f'<text x="{x}" y="{y+128}" font-size="26" text-anchor="middle">{name}</text>']
    out.extend(s)

def uc(cx, cy, lines, rx=178, ry=40):
    out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="white" stroke="black" stroke-width="2"/>')
    n = len(lines)
    for i, l in enumerate(lines):
        y = cy + (i - (n - 1) / 2) * 27 + 9
        out.append(f'<text x="{cx}" y="{y:.0f}" font-size="24" text-anchor="middle">{l}</text>')
    return (cx, cy, rx, ry)

def link(ax, ay, e, side):
    cx, cy, rx, ry = e
    ex = cx - rx if side == 'l' else cx + rx
    out.append(f'<line x1="{ax}" y1="{ay}" x2="{ex}" y2="{cy}" stroke="black" stroke-width="1.8"/>')

# Межа системи
out.append('<rect x="230" y="20" width="540" height="760" fill="none" stroke="black" stroke-width="2.5"/>')
out.append('<text x="500" y="56" font-size="26" font-weight="bold" text-anchor="middle">Вебсистема EquipRent</text>')

c = 500
u1 = uc(c, 112, ['Переглянути каталог'])
u2 = uc(c, 200, ['Переглянути календар', 'і розрахунок вартості'])
u3 = uc(c, 288, ['Надіслати заявку'])
u4 = uc(c, 376, ['Скасувати або', 'продовжити бронювання'])
u5 = uc(c, 464, ['Обробити заявку: підтвердити', 'або відхилити'], rx=200)
u6 = uc(c, 552, ['Зафіксувати видачу', 'і повернення'])
u7 = uc(c, 640, ['Керувати обладнанням', 'й екземплярами'])
u8 = uc(c, 730, ['Переглянути звіт'], ry=32)

actor(110, 90, 'Гість')
actor(110, 380, 'Клієнт')
actor(890, 430, 'Менеджер')
# Узагальнення Клієнт → Гість
out.append('<line x1="110" y1="362" x2="110" y2="236" stroke="black" stroke-width="2" marker-end="url(#tri)"/>')
for e in (u1, u2):
    link(140, 130, e, 'l')
for e in (u3, u4):
    link(140, 420, e, 'l')
for e in (u5, u6, u7, u8):
    link(860, 470, e, 'r')
out.append('</svg>')
open(Path(__file__).resolve().parent.parent / 'figures-src' / 'usecase.svg', 'w', encoding='utf-8').write('\n'.join(out))
