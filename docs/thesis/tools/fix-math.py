#!/usr/bin/env python3
"""Перетворює прості формули OMML на звичайний текст Times New Roman 14 пт.

Формули записки містять лише рядкові символи й нижні індекси, тому їх надійніше подати
звичайними текстовими фрагментами: тоді Word і LibreOffice показують їх однаково, без квадратів
замість символів. Однолітерні латинські змінні — курсив, назви функцій (max, min, free, busy) і
решта символів — прямим шрифтом; індекси — через вертикальне вирівнювання «subscript».
"""
import html, re, shutil, sys, zipfile

def run(text, italic=False, sub=False):
    i = '<w:i/><w:iCs/>' if italic else ''
    v = '<w:vertAlign w:val="subscript"/>' if sub else ''
    t = html.escape(text, quote=False)
    return ('<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
            f'{i}<w:sz w:val="28"/><w:szCs w:val="28"/>{v}</w:rPr><w:t xml:space="preserve">{t}</w:t></w:r>')

def runs(xml, sub=False):
    out = []
    for t in re.findall(r'<m:t(?: [^>]*)?>([^<]*)</m:t>', xml):
        for p in re.findall(r'[A-Za-z]+|[^A-Za-z]+', html.unescape(t)):
            out.append(run(p, len(p) == 1 and p.isalpha(), sub))
    return ''.join(out)

def convert(m):
    body = m.group(1); out = []; pos = 0
    for sm in re.finditer(r'<m:sSub>.*?<m:e>(.*?)</m:e>.*?<m:sub>(.*?)</m:sub>.*?</m:sSub>', body, re.S):
        out.append(runs(body[pos:sm.start()])); out.append(runs(sm.group(1))); out.append(runs(sm.group(2), sub=True))
        pos = sm.end()
    out.append(runs(body[pos:]))
    return ''.join(out)

def fix(xml):
    return re.sub(r'<m:oMath>(.*?)</m:oMath>', convert, xml, flags=re.S)

if __name__ == '__main__':
    src = sys.argv[1]; tmp = src + '.tmp'
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename.endswith('/'):
                continue
            data = zin.read(item.filename)
            if item.filename == 'word/document.xml':
                data = fix(data.decode('utf-8')).encode('utf-8')
            zout.writestr(item, data)
    shutil.move(tmp, src)
