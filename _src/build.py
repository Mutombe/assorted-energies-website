"""Assembles the static pages: _src/pages/*.html -> ./*.html
Tokens: <!--@header:KEY-->  (KEY marks the active nav item)  and  <!--@footer-->  <!--@cta-->
Usage: python -P _src/build.py"""
import os, re, hashlib
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, '_src', *a)
header = open(P('partials', 'header.html'), encoding='utf-8').read()
footer = open(P('partials', 'footer.html'), encoding='utf-8').read()
# Assets are served with a one-week cache, so each CSS/JS link carries a content hash
def bust(m):
    path = m.group(2)
    digest = hashlib.md5(open(os.path.join(ROOT, path), 'rb').read()).hexdigest()[:8]
    return '%s="%s?v=%s"' % (m.group(1), path, digest)
for name in sorted(os.listdir(P('pages'))):
    html = open(P('pages', name), encoding='utf-8').read()
    def head(m):
        key = m.group(1)
        return re.sub(r'data-nav="%s"' % key, 'data-nav="%s" class="is-active" aria-current="page"' % key, header)
    html = re.sub(r'<!--@header:(\w+)-->', head, html)
    html = html.replace('<!--@footer-->', footer)
    html = re.sub(r'(href|src)="(assets/(?:css|js)/[\w.-]+\.(?:css|js))"', bust, html)
    open(os.path.join(ROOT, name), 'w', encoding='utf-8', newline='\n').write(html)
    print('built', name)
