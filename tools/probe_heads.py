"""Probe the reference panels: find the character's head box by measuring dark pixels.

Writes /tmp/head_<id>.png crops (4x) so the crop can be inspected before use.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PANELS = ROOT / "public/assets/portraits"

for cid in ["riff", "prism", "brass", "loop"]:
    im = Image.open(PANELS / f"{cid}_panel.png").convert("RGB")
    W, H = im.size
    px = im.load()
    # dark pixels = the black Null head; search the top 45% of the panel only
    ys = [y for y in range(int(H * 0.45)) for x in range(W) if max(px[x, y]) < 60]
    xs = [x for y in range(int(H * 0.45)) for x in range(W) if max(px[x, y]) < 60]
    if not ys:
        print(cid, "no dark pixels")
        continue
    print(cid, "dark bbox", min(xs), min(ys), max(xs), max(ys))
    x0, y0, x1, y1 = min(xs), min(ys), max(xs) + 1, max(ys) + 1
    crop = im.crop((x0, y0, x1, y1))
    crop.resize((crop.width * 2, crop.height * 2), Image.NEAREST).save(f"/tmp/head_{cid}.png")
    print("  crop", crop.size)
