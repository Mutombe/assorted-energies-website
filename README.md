# Assorted Energies International — website

**Live:** https://assorted-energies.onrender.com (Render static site, auto-deploys on push to `main`)

Static, dependency-free site. Open `index.html` directly, or serve the folder:

```
python -m http.server 8642
```

## Pages

| Page | Sections |
|---|---|
| `index.html` | Hero with live Harare sun widget · intro tiles · marquee · "Who we power" sector cards · 3D service cards · delivery · process rail · installation carousel · why us · Africa network map · glass-orb promise · CTA |
| `about.html` | Overture · 3D capability cards (globe, ring, ribbon) · values · team collage · Africa map with city list · community · CTA |
| `solutions.html` | Image-strip hero · core services · specialist tabs · equipment · savings calculator · FAQ · CTA |
| `projects.html` | Key numbers · filterable gallery · Zimbabwe coverage map · 3 interactive charts · agrivoltaics · CTA |
| `contact.html` | Contact card with today's hours highlighted · enquiry form (opens email) · OpenStreetMap · next steps |

## Editing

Header and footer are shared. Edit pages in `_src/pages/`, partials in `_src/partials/`, then rebuild:

```
python _src/build.py
```

| Tool | What it does |
|---|---|
| `_src/tools/build_images.py` | Converts the photo library to WebP (1600w + 800w `-sm`) and makes the logo variants |
| `_src/tools/render3d.py` | Ray-marches the 3D objects (`obj-panel`, `obj-battery`, `obj-sun`, `obj-globe`, `obj-ring`, `obj-ribbon`). Poses are set in `OBJECTS` |
| `_src/tools/build_map.py` | Builds `assets/js/map-data.js` (Africa + Zimbabwe dot maps) from Natural Earth data |
| `_src/tools/check_static.py` | Fails on dash characters, hollow words, missing links/assets and broken CSS `url()`s |
| `_src/tools/qa.mjs` | Browser checks per page: overflow at 1280/390, hero fit at six viewports, copy that wraps on mobile, stretched images, mobile menu, render without JS |

Fonts are self-hosted in `assets/fonts/` (all SIL Open Font License, Latin subset).

## Brand tokens (`assets/css/style.css`, top of file)

- Navy `#002A74` (sampled from the logo), with a scale from `--navy-950` to `--navy-50`
- Solar orange `#F07A1A`, with a scale from `--orange-700` to `--orange-50`
- Grays `--gray-900` to `--gray-50`, on a white base
- Type: Plus Jakarta Sans (UI), Caveat (handwritten accents, `.serif` class), Instrument Serif (long-form quotes), Geist Mono (labels)

## Before launch

1. **License the iStock photos.** Every `istockphoto-*` source image is a watermarked comp. Buy the licences, re-export the clean files into the source folder, then re-run `build_images.py`.
2. **Confirm company claims.** The "10 provinces served" figure on the home map, and the service ranges on the Solutions cards (for example "3–15 kWp" and "50 kWp–1 MWp").
3. **Review calculator and chart assumptions.** They use a yield of 1,700 kWh/kWp/yr, $850/kWp, $420/kWh of storage and a 5% tariff escalation. All are labelled "indicative".
4. **Add real testimonials and case studies** when available. None were invented.
5. **Decide how the form should send.** It currently opens the visitor's email app. Swap in Formspree or a backend for silent submission if preferred.
