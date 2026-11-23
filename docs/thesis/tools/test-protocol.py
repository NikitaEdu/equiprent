#!/usr/bin/env python3
"""Збирає протокол тестів для додатка Г з фактичних звітів запуску.

Джерела: backend/target/{surefire,failsafe}-reports/TEST-*.xml, frontend vitest JSON,
docs/evidence/e2e-results.json (Playwright). Назви тестів беруться з @DisplayName у коді.
Результат: docs/evidence/test-protocol.json
"""
import glob, json, os, re, sys, xml.etree.ElementTree as ET

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
BE = os.path.join(ROOT, 'backend')


def display_names():
    names = {}
    for f in glob.glob(os.path.join(BE, 'src/test/java/**/*.java'), recursive=True):
        src = open(f, encoding='utf-8').read()
        cls = os.path.splitext(os.path.basename(f))[0]
        for m in re.finditer(r'@DisplayName\("([^"]+)"\)\s*(?:@\w+(?:\([^)]*\))?\s*)*void\s+(\w+)', src):
            names[(cls, m.group(2))] = m.group(1)
    return names


def backend(kind):
    dn = display_names()
    out = []
    for x in sorted(glob.glob(os.path.join(BE, f'target/{kind}-reports/TEST-*.xml'))):
        r = ET.parse(x).getroot()
        cls = r.get('name').split('.')[-1]
        for tc in r.iter('testcase'):
            failed = tc.find('failure') is not None or tc.find('error') is not None
            skipped = tc.find('skipped') is not None
            raw = tc.get('name'); m = re.match(r'(\w+)\(.*\)\[(\d+)\]$', raw) or re.match(r'(\w+)\(\)$', raw)
            nm = dn.get((cls, raw)) or (dn.get((cls, m.group(1))) + (f' [{m.group(2)}]' if m.lastindex == 2 else '') if m and dn.get((cls, m.group(1))) else raw)
            out.append({'suite': cls, 'name': nm,
                        'status': 'не пройдено' if failed else 'пропущено' if skipped else 'пройдено',
                        'timeSec': round(float(tc.get('time') or 0), 2)})
    return out


def vitest(path):
    if not os.path.exists(path):
        return []
    d = json.load(open(path, encoding='utf-8'))
    out = []
    for f in d.get('testResults', []):
        for a in f.get('assertionResults', []):
            out.append({'suite': os.path.basename(f['name']), 'name': a['title'],
                        'status': 'пройдено' if a['status'] == 'passed' else a['status'],
                        'timeSec': round((a.get('duration') or 0) / 1000, 2)})
    return out


def playwright(path):
    d = json.load(open(path, encoding='utf-8'))
    out = []

    def walk(s, file):
        for sp in s.get('specs', []):
            for t in sp.get('tests', []):
                res = t['results'][-1] if t.get('results') else {}
                out.append({'suite': file, 'name': sp['title'],
                            'status': 'пройдено' if t.get('status') == 'expected' else t.get('status'),
                            'timeSec': round(res.get('duration', 0) / 1000, 2)})
        for ch in s.get('suites', []):
            walk(ch, file)
    for s in d['suites']:
        walk(s, os.path.basename(s.get('file', s.get('title', ''))))
    return out, d.get('stats', {})


unit = backend('surefire')
it = backend('failsafe')
vt = vitest(os.path.join(ROOT, 'docs/evidence/vitest-results.json'))
e2e, stats = playwright(os.path.join(ROOT, 'docs/evidence/e2e-results.json'))
res = {'unit': unit, 'integration': it, 'vitest': vt, 'e2e': e2e, 'e2eStats': stats}
json.dump(res, open(os.path.join(ROOT, 'docs/evidence/test-protocol.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k in ('unit', 'integration', 'vitest', 'e2e'):
    bad = [t for t in res[k] if t['status'] != 'пройдено']
    print(k, len(res[k]), 'не пройдено:', len(bad))
