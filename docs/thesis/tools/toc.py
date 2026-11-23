import re, subprocess, sys
DOC='/tmp/fx/w/word/document.xml'; PDF=sys.argv[1]
s=open(DOC,encoding='utf-8').read()
t=subprocess.run(['pdftotext','-layout',PDF,'-'],capture_output=True,text=True).stdout.split('\f')
norm=lambda x: re.sub(r'\s+',' ',x).strip()
pages=[re.sub(r'^\d{1,3} ','',norm(p)) for p in t]
txt=lambda x: ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>',x))
it=list(re.finditer(r'<w:p[ >].*?</w:p>',s,flags=re.S))
i0=next(i for i,m in enumerate(it) if txt(m.group()).strip()=='ЗМІСТ')
i1=next(i for i,m in enumerate(it) if i>i0 and txt(m.group()).strip()=='ПЕРЕЛІК СКОРОЧЕНЬ')
cur=next(i for i,p in enumerate(pages) if i>2 and p.startswith('ПЕРЕЛІК СКОРОЧЕНЬ'))
out=[];last=0;found={}
for m in it[i0+1:i1]:
    para=m.group(); full=txt(para)
    title=re.sub(r'\d+\s*$','',full).strip()
    needle=norm(title)
    if needle.startswith('ДОДАТОК'): needle=needle.split(' ',2)[2]
    pg=None
    for p in range(cur,len(pages)):
        if needle[:60] in pages[p]: pg=p+1; cur=p; break
    assert pg, title
    found[title]=pg
    ts=list(re.finditer(r'(<w:t[^>]*>)([^<]*)(</w:t>)',para))
    tt=next(x for x in reversed(ts) if x.group(2).strip())
    mm=re.search(r'(\d+)(\s*)$',tt.group(2))
    new=tt.group(2)[:mm.start(1)]+str(pg)+mm.group(2)
    out.append(s[last:m.start()]); out.append(para[:tt.start(2)]+new+para[tt.end(2):]); last=m.end()
out.append(s[last:]); s=''.join(out)
total=len([p for p in t if p.strip()]) if False else int(subprocess.run(['pdfinfo',PDF],capture_output=True,text=True).stdout.split('Pages:')[1].split()[0])
intro=found['ВСТУП']; src=found['ПЕРЕЛІК ДЖЕРЕЛ']; app=next(v for k,v in found.items() if k.startswith('ДОДАТОК А'))
loc=lambda n: 'сторінці' if n%10==1 and n%100!=11 else 'сторінках'
main,srcp,appp=src-intro,app-src,total-app+1
s=re.sub(r'— \d+ с\.',f'— {total} с.',s); s=re.sub(r'— \d+ p\.',f'— {total} p.',s)
s=re.sub(r'частину на \d+ сторінк(ах|і)',f'частину на {main} {loc(main)}',s)
s=re.sub(r'найменування на \d+ сторінк(ах|і)',f'найменування на {srcp} {loc(srcp)}',s)
s=re.sub(r'додатки на \d+ сторінк(ах|і)',f'додатки на {appp} {loc(appp)}',s)
s=re.sub(r'main text part on \d+ pages',f'main text part on {main} pages',s)
s=re.sub(r'titles on \d+ pages',f'titles on {srcp} pages',s)
s=re.sub(r'appendices on \d+ pages',f'appendices on {appp} pages',s)
open(DOC,'w',encoding='utf-8').write(s)
print('total',total,'main',main,'src',srcp,'app',appp)
