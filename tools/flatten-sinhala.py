"""Flattens tools/sinhala.svg (pdftocairo output) into one path in fonts/sinhala.json."""
import re, json
s = open("tools/sinhala.svg").read()
glyphs = {m.group(1): m.group(2) for m in re.finditer(r'<g id="(glyph-\d+-\d+)">\s*<path d="([^"]*)"', s)}
def shift(d, dx, dy):
    toks = d.split()
    out, i, coord = [], 0, 0
    for t in toks:
        if re.fullmatch(r"[A-Za-z]", t):
            out.append(t); coord = 0
        else:
            v = float(t) + (dx if coord % 2 == 0 else dy)
            out.append(("%.2f" % v).rstrip("0").rstrip(".")); coord += 1
    return " ".join(out)
parts, ys = [], []
for m in re.finditer(r'<use xlink:href="#(glyph-\d+-\d+)" x="([\d.\-]+)" y="([\d.\-]+)"', s):
    gid, x, y = m.group(1), float(m.group(2)), float(m.group(3))
    if gid not in glyphs or y <= 0: continue  # the space glyph has no outline; y <= 0 is an off-page overflow copy
    parts.append(shift(glyphs[gid], x, y)); ys.append(y)
w = float(re.search(r'width="([\d.]+)"', s).group(1))
json.dump({"d": " ".join(parts), "width": w, "baseline": ys[0], "size": 75}, open("fonts/sinhala.json", "w"))
print(len(parts), "glyphs; width", w, "baseline", ys[0], "bytes", len(" ".join(parts)))
