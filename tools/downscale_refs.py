#!/usr/bin/env python3
"""Downscale the reference images to 480x270 (LANCZOS) and quantize to palette.json.

Usage: python3 tools/downscale_refs.py  -> public/assets/ref_scaled/*.png
Sources: spec/refs/pdf_p15_0.png (alley), pdf_p16_0.png (subway), pdf_p17_0.png (warehouse).
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "spec/refs"
OUT = ROOT / "public/assets/ref_scaled"
PAL = ROOT / "public/assets/palette.json"

MAP = {
    "pdf_p15_0.png": "ref_env_alley.png",
    "pdf_p16_0.png": "ref_env_subway.png",
    "pdf_p17_0.png": "ref_env_warehouse.png",
}


def main() -> None:
    colours = json.loads(PAL.read_text())["colours"]
    flat = []
    for c in colours:
        flat.extend(int(c[i : i + 2], 16) for i in (1, 3, 5))
    pal_img = Image.new("P", (1, 1))
    pal_img.putpalette(flat + [0] * (768 - len(flat)))
    OUT.mkdir(parents=True, exist_ok=True)
    for src, dst in MAP.items():
        im = Image.open(SRC / src).convert("RGB").resize((480, 270), Image.LANCZOS)
        q = im.quantize(palette=pal_img, dither=Image.Dither.NONE)
        q.convert("RGB").save(OUT / dst)
        print("wrote", OUT / dst)


if __name__ == "__main__":
    main()
