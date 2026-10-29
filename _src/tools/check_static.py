"""Static launch checks over the built site: dashes, hollow words, links, asset paths, CSS url()s.
Usage: python -P _src/tools/check_static.py"""
import os, re, glob, html
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
BANNED = r'seamless|robust|leverage|\belevate\b|unlock|bespoke|cutting.edge|comprehensive|tailored|holistic|not just|world.class'
problems = 0
for f in sorted(glob.glob('*.html')):
    s = open(f, encoding='utf-8').read()
    text = re.sub(r'(?s)<(script|style)[^>]*>.*?</\1>', '', s)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', text))
    dashes = re.findall('[‒–—―]', s)
    words = [w for w in re.findall(BANNED, text, re.I)]
    missing = []
    for ref in re.findall(r'(?:href|src)="([^"#?]+)', s):
        if re.match(r'(https?:|mailto:|tel:|data:)', ref): continue
        if not os.path.exists(ref): missing.append(ref)
    print(f'{f:16} dashes={len(dashes)} hollow={words} missing={missing}')
    problems += len(dashes) + len(words) + len(missing)
for f in glob.glob('assets/css/*.css'):
    for u in re.findall(r'url\(([^)]+)\)', open(f, encoding='utf-8').read()):
        u = u.strip('\'"')
        if u.startswith('data:') or u.startswith('#'): continue
        if not os.path.exists(os.path.normpath(os.path.join(os.path.dirname(f), u))):
            print('broken css url', f, u); problems += 1
js = open('assets/js/main.js', encoding='utf-8').read()
js_dashes = len(re.findall('[–—]', re.sub(r'//.*', '', js)))
print('main.js user-facing dashes:', js_dashes)
print('TOTAL PROBLEMS:', problems + js_dashes)
