import re, json, subprocess, sys, os, shutil
W = '/tmp/fx/w'; DOC = W + '/word/document.xml'
def pack(out):
    if os.path.exists(out): os.remove(out)
    subprocess.run(f'cd {W} && zip -qXrD {out} .', shell=True, check=True)
def tables_xml(s):
    return [m for m in re.finditer(r'<w:tbl>.*?</w:tbl>', s, flags=re.S)]
NUM = re.compile(r'(?:Таблиця|таблиці)\s+((?:[А-ЯЄІЇҐ]\.)?\d+(?:\.\d+)?)')
txt = lambda x: ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', x))
for it in range(40):
    pack('/tmp/fx/t.docx')
    subprocess.run('pkill -f soffice', shell=True)
    r = subprocess.run(['python3', '/tmp/fx/tools/rowpages.py', '/tmp/fx/t.docx'], capture_output=True, text=True, timeout=300)
    d = json.loads(r.stdout)
    s = open(DOC, encoding='utf-8').read()
    tbls = tables_xml(s)
    assert len(tbls) == len(d['tables']), (len(tbls), len(d['tables']))
    k = next((i for i, p in enumerate(d['tables']) if len(set(p)) > 1), None)
    if k is None:
        print('done, total pages', d['total']); break
    pages = d['tables'][k]
    r0 = next(i for i in range(1, len(pages)) if pages[i] != pages[i - 1])
    m = tbls[k]; tbl = m.group()
    # попередній абзац (підпис або мітка продовження)
    before = s[:m.start()]
    pm = list(re.finditer(r'<w:p[ >](?:(?!<w:p[ >]).)*?</w:p>', before[-20000:], flags=re.S))[-1]
    cap = pm.group(); num = NUM.search(txt(cap)).group(1)
    head_end = tbl.find('<w:tr')
    pre = tbl[:head_end]
    rows = re.findall(r'<w:tr[ >].*?</w:tr>', tbl, flags=re.S)
    if r0 == 1:
        print('header alone on page, table', num, '- keep header with next')
        hdr = rows[0].replace('<w:pPr>', '<w:pPr><w:keepNext/>')
        s = s[:m.start()] + pre + hdr + ''.join(rows[1:]) + '</w:tbl>' + s[m.end():]
        open(DOC, 'w', encoding='utf-8').write(s); continue
    header = rows[0] if '<w:tblHeader' in rows[0] else ''
    part1 = pre + ''.join(rows[:r0]) + '</w:tbl>'
    part2 = pre + header + ''.join(rows[r0:]) + '</w:tbl>'
    ppr = re.search(r'<w:pPr>.*?</w:pPr>', cap, flags=re.S)
    ppr = ppr.group() if ppr else '<w:pPr></w:pPr>'
    ppr = re.sub(r'<w:spacing [^>]*/>', '', ppr)
    ppr = re.sub(r'<w:(keepNext|pageBreakBefore)/>', '', ppr)
    ppr = ppr.replace('<w:pPr>', '<w:pPr><w:keepNext/><w:pageBreakBefore/><w:spacing w:before="0" w:after="60" w:line="360" w:lineRule="auto"/>', 1)
    ORDER = ['pStyle','keepNext','keepLines','pageBreakBefore','widowControl','numPr','tabs','spacing','ind','jc','outlineLvl','rPr']
    els = [x.group(0) for x in re.finditer(r'<w:(\w+)(?:[^<>]*/>|[^<>]*>.*?</w:\1>)', ppr[7:-8], re.S)]
    els.sort(key=lambda e: ORDER.index(re.match(r'<w:(\w+)', e).group(1)) if re.match(r'<w:(\w+)', e).group(1) in ORDER else 99)
    ppr = '<w:pPr>' + ''.join(els) + '</w:pPr>'
    rpr = re.search(r'<w:rPr>.*?</w:rPr>', cap[cap.find('<w:r>') if '<w:r>' in cap else 0:], flags=re.S)
    rpr = rpr.group() if rpr else ''
    label = f'<w:p>{ppr}<w:r>{rpr}<w:t xml:space="preserve">Продовження таблиці {num}</w:t></w:r></w:p>'
    s = s[:m.start()] + part1 + label + part2 + s[m.end():]
    open(DOC, 'w', encoding='utf-8').write(s)
    print(f'split table {num} at row {r0} (pages {pages[r0-1]}->{pages[r0]})', flush=True)
