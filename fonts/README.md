# Fonts

All text in the SVGs is drawn as outlines, so no font loads in the viewer's browser or app.
`glyphs.json` and `sinhala.json` are the exported outlines the build reads. The `.ttf` sources
are not stored here; to regenerate, download them from https://github.com/google/fonts (`ofl/` folder) into this directory and run `tools/`.

| Use | Font | License |
|---|---|---|
| Name, numbers, English and Sinhala | Abhaya Libre (Regular, SemiBold) | SIL OFL 1.1 |
| Chinese characters | Ma Shan Zheng | SIL OFL 1.1 |
| Small labels, tags, percentages | Tomorrow (Medium) | SIL OFL 1.1 |
| Tagline | Jura (wght 600) | SIL OFL 1.1 |

Regenerate: `python tools/export-glyphs.py` (needs `fonttools`), then for the Sinhala line
`node tools/sinhala.cjs "<text>"`, `pdftocairo -svg tools/sinhala.pdf tools/sinhala.svg`, `python tools/flatten-sinhala.py`.
