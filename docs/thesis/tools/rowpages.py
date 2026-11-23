# Повертає для кожної таблиці верхнього рівня (у порядку документа) список сторінок її рядків.
import sys, json, time, subprocess, uno
from com.sun.star.beans import PropertyValue
path = sys.argv[1]
p = subprocess.Popen(['soffice', '--headless', '--invisible', '--norestore',
                      '--accept=pipe,name=rp;urp;'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ctx = None
for _ in range(60):
    try:
        local = uno.getComponentContext()
        res = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
        ctx = res.resolve('uno:pipe,name=rp;urp;StarOffice.ComponentContext'); break
    except Exception:
        time.sleep(0.5)
desk = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
pv = PropertyValue(); pv.Name = 'Hidden'; pv.Value = True
doc = desk.loadComponentFromURL(uno.systemPathToFileUrl(path), '_blank', 0, (pv,))
vc = doc.getCurrentController().getViewCursor()
out = []
en = doc.getText().createEnumeration()
while en.hasMoreElements():
    el = en.nextElement()
    if el.supportsService('com.sun.star.text.TextTable'):
        n = el.getRows().getCount(); pages = []
        for r in range(n):
            c = el.getCellByName('A%d' % (r + 1))
            vc.gotoRange(c.getStart(), False); pages.append(vc.getPage())
        out.append(pages)
vc.jumpToLastPage(); total = vc.getPage()
doc.close(True)
try: desk.terminate()
except Exception: pass
p.wait(timeout=30)
print(json.dumps({'tables': out, 'total': total}))
