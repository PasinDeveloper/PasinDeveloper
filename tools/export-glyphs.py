"""One-off design-time tool: turns the Google Fonts (OFL) files in fonts/ into fonts/glyphs.json.
Needs fontTools (pip, in a venv). The daily workflow never runs this; it only reads glyphs.json."""
import json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.varLib import instancer

ASCII = "".join(chr(c) for c in range(32, 127))
EXTRA = "·—–’→↗"
CJK = "帕森度火"

def export(font, chars):
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    out = {}
    for ch in chars:
        name = cmap.get(ord(ch))
        if not name:
            continue
        pen = SVGPathPen(gs, ntos=lambda v: ("%.1f" % v).rstrip("0").rstrip("."))
        gs[name].draw(pen)
        out[ch] = {"d": pen.getCommands(), "adv": gs[name].width}
    return {"upm": font["head"].unitsPerEm, "asc": font["hhea"].ascent, "glyphs": out}

jura = instancer.instantiateVariableFont(TTFont("fonts/Jura[wght].ttf"), {"wght": 600})
jura7 = instancer.instantiateVariableFont(TTFont("fonts/Jura[wght].ttf"), {"wght": 700})
fonts = {
    "serif": export(TTFont("fonts/AbhayaLibre-Regular.ttf"), ASCII + EXTRA),
    "serifBold": export(TTFont("fonts/AbhayaLibre-SemiBold.ttf"), ASCII + EXTRA),
    "mono": export(TTFont("fonts/Tomorrow-Medium.ttf"), ASCII + EXTRA),
    "monoReg": export(TTFont("fonts/Tomorrow-Regular.ttf"), ASCII + EXTRA),
    "monoBold": export(TTFont("fonts/Tomorrow-Bold.ttf"), ASCII + EXTRA),
    "display": export(jura, ASCII + EXTRA),
    "displayBold": export(jura7, ASCII + EXTRA),
    "brush": export(TTFont("fonts/MaShanZheng-Regular.ttf"), CJK),
}
for k, v in fonts.items():
    missing = [c for c in (ASCII + EXTRA if k != "brush" else CJK) if c not in v["glyphs"]]
    print(k, len(v["glyphs"]), "glyphs; missing:", "".join(missing) or "none")
json.dump(fonts, open("fonts/glyphs.json", "w"), ensure_ascii=False, separators=(",", ":"))
