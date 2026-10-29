"""Converts the brand photo library into web-ready WebP files.
Usage: python -P build_images.py <photos dir> <old-site dir> <out dir>"""
import sys, os
from PIL import Image

src, old, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)

# source file -> (output name, max width)
MAP = {
 '1-1.png': 'roof-commercial', '1.-Listicle-Solar-is-awesome-1024x683.jpg': 'field-tilted-rows',
 '2-1.png': 'roof-metal-install', '6a5ab63d619cea6270943999_Property Developer Finance jpg.jpg': 'property-development',
 'SNAP_NEW_LANDING_PAGE_BANNER_MAR2018.jpg': 'aerial-suburb', 'Untitled-711-x-450-px-4.png': 'roof-tile-panels',
 'a690ab84-4d48-41d8-84ca-a9675dda0f43.jpg': 'harare-skyline', 'electric-farm-with-panels-producing-clean-ecologic-energy-1024x683.jpg': 'farm-panels-dry',
 'image-up.png': 'installer-drill', 'images (2).jpg': 'field-golden-sunset',
 'istockphoto-1130758764-2048x2048.jpg': 'utility-inverters-field', 'istockphoto-1197590704-2048x2048.jpg': 'inverter-room',
 'istockphoto-1302659815-612x612.jpg': 'harare-city', 'istockphoto-1362872948-2048x2048.jpg': 'home-cottage',
 'istockphoto-1402475274-2048x2048.jpg': 'agrivoltaic-lettuce', 'istockphoto-1448607390-2048x2048.jpg': 'installer-vineyard-roof',
 'istockphoto-1462151309-2048x2048.jpg': 'hands-community', 'istockphoto-1463617670-2048x2048.jpg': 'engineers-wind',
 'istockphoto-1490061322-2048x2048.jpg': 'hybrid-inverter', 'istockphoto-1620576275-2048x2048.jpg': 'battery-wall',
 'istockphoto-1676495583-2048x2048.jpg': 'agrivoltaic-vineyard', 'istockphoto-1718847029-2048x2048.jpg': 'agrivoltaic-canopy',
 'istockphoto-1742670724-2048x2048.jpg': 'home-system-wall', 'istockphoto-1999953241-2048x2048.jpg': 'cyclists-green',
 'istockphoto-2045558460-2048x2048.jpg': 'hands-seedling', 'istockphoto-2160078175-2048x2048.jpg': 'farmers-field',
 'istockphoto-2162813543-2048x2048.jpg': 'tracker-closeup', 'istockphoto-2172501561-2048x2048.jpg': 'bess-containers',
 'istockphoto-2199726093-2048x2048.jpg': 'green-architecture', 'istockphoto-2209090636-2048x2048.jpg': 'installer-sunset-roof',
 'istockphoto-2211089749-2048x2048.jpg': 'wall-inverter-house', 'istockphoto-2214926216-2048x2048.jpg': 'advisor-office',
 'istockphoto-2220243310-2048x2048.jpg': 'team-green', 'istockphoto-2222813649-2048x2048.jpg': 'panels-canopy-trees',
 'istockphoto-2230159460-2048x2048.jpg': 'team-office', 'istockphoto-2231745593-2048x2048.jpg': 'panels-blue-sky',
 'istockphoto-2233448310-2048x2048.jpg': 'green-building-up', 'istockphoto-2246916593-2048x2048.jpg': 'field-sunset-rows',
 'istockphoto-2254411341-2048x2048.jpg': 'roof-house-dusk', 'istockphoto-2260659216-2048x2048.jpg': 'sun-sky',
 'istockphoto-2269681156-2048x2048.jpg': 'leader-map', 'istockphoto-2271995989-2048x2048.jpg': 'battery-rack',
 'istockphoto-2286461738-2048x2048.jpg': 'engineer-roof', 'istockphoto-2294102962-2048x2048.jpg': 'battery-detail',
 'istockphoto-909265570-2048x2048.jpg': 'string-inverters', 'solar-power-field-1024x701.jpg': 'field-green',
 'vTgfLwZ.jpeg': 'home-forest',
}
OLD = {'just-anoth_15921764677TqwPy.jpeg': 'product-panel-poly', 'solar-pane_1592175759hWuLS0.jpeg': 'product-panel-mono',
       'master.jpeg': 'panel-closeup', 'solar-inst_15921770199fVm9D.jpeg': 'roof-tile-array', 'solar-powe_1592177506Inwvua.jpeg': 'plant-aerial'}

def save(path, name):
    im = Image.open(path).convert('RGB')
    for suffix, w in (('', 1600), ('-sm', 800)):
        c = im.copy()
        if c.width > w: c = c.resize((w, round(c.height * w / c.width)), Image.LANCZOS)
        c.save(os.path.join(out, f'{name}{suffix}.webp'), 'WEBP', quality=80, method=6)
    print(name, im.size)

for f, n in MAP.items(): save(os.path.join(src, f), n)
for f, n in OLD.items(): save(os.path.join(old, f), n)

# Logo: transparent navy mark, plus a white version for dark surfaces
logo = Image.open(os.path.join(src, 'e086be12-c1c8-4699-bfcd-487be1f14f7b_removalai_preview.png')).convert('RGBA')
logo = logo.crop(logo.getbbox())
logo.save(os.path.join(out, 'logo-navy.png'))
white = Image.new('RGBA', logo.size, (255, 255, 255, 0)); white.putalpha(logo.getchannel('A'))
white.save(os.path.join(out, 'logo-white.png'))
# Monogram only (circle without wordmark) for favicon / nav
mark = logo.crop((0, 0, logo.width, 456)); mark = mark.crop(mark.getbbox())
mark.save(os.path.join(out, 'logo-mark.png'))
wm = Image.new('RGBA', mark.size, (255, 255, 255, 0)); wm.putalpha(mark.getchannel('A')); wm.save(os.path.join(out, 'logo-mark-white.png'))
fav = mark.copy(); fav.thumbnail((180, 180)); fav.save(os.path.join(out, 'favicon.png'))
print('logo', logo.size, 'mark', mark.size)
