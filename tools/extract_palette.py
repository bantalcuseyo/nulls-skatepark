#!/usr/bin/env python3
"""Extract the master 32-colour palette from the reference images (median-cut).

Usage: python3 tools/extract_palette.py docs/refs/*.png  -> public/assets/palette.json
"""
import json
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public/assets/palette.json"


def main(paths: list[str]) -> None:
    if not paths:
        sys.exit("usage: extract_palette.py <image> [...]")
    merged = Image.new("RGB", (0, 0))
    tiles = []
    for p in paths:
        img = Image.open(p).convert("RGB")
        tiles.append(img)
    total_w = max(t.width for t in tiles)
    total_h = sum(t.height for t in tiles)
    merged = Image.new("RGB", (total_w, total_h))
    y = 0
    for t in tiles:
        merged.paste(t, (0, y))
        y += t.height
    quant = merged.quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    pal = quant.getpalette()[: 32 * 3]
    colours = ["#%02x%02x%02x" % tuple(pal[i : i + 3]) for i in range(0, len(pal), 3)]
    # Count pixel usage so unused slots are visible.
    counts = {}
    for idx, n in quant.getcolors(maxcolors=256):
        counts[idx] = n
    entries = [{"index": i, "hex": c, "pixels": counts.get(i, 0)} for i, c in enumerate(colours)]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": paths, "colours": colours, "entries": entries}, indent=2))
    print(f"wrote {OUT} with {len(colours)} colours")


if __name__ == "__main__":
    main(sys.argv[1:])
