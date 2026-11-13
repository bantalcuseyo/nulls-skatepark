#!/usr/bin/env python3
"""Crop the HUD/menu portrait heads out of the owner's reference panels.

The panels in public/assets/portraits/<id>_panel.png are the art direction's own pixels, so the
portrait is a crop of them, never a redraw. Boxes were measured off a 50 px grid overlay and
verified by eye on the 4-up contact sheet (/tmp/headboxes.png).

Outputs public/assets/portraits/head_<id>.png at 64x64 (HUD) — nearest-neighbour, so the pixel
grid survives the downscale.

Usage: python3 tools/gen_portraits.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PANELS = ROOT / "public/assets/portraits"

# Head + ears + headgear, measured per panel. Wider at the top than the bottom so ear tips and
# the headphone cup are never clipped.
BOXES = {
    "riff": (222, 38, 480, 296),
    "prism": (218, 40, 482, 292),
    "brass": (214, 40, 486, 294),
    "loop": (216, 38, 484, 294),
}
OUT = 32


def main() -> None:
    for cid, box in BOXES.items():
        im = Image.open(PANELS / f"{cid}_panel.png").convert("RGB")
        crop = im.crop(box)
        # square it around the centre so the head is not stretched
        side = max(crop.size)
        sq = Image.new("RGB", (side, side), (12, 18, 38))
        sq.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
        # 32x32 is what the HUD draws 1:1; 64x64 is for the character-select panel.
        sq.resize((OUT, OUT), Image.NEAREST).save(PANELS / f"head_{cid}.png")
        sq.resize((OUT * 2, OUT * 2), Image.NEAREST).save(PANELS / f"head_{cid}_2x.png")
        print(cid, "->", f"head_{cid}.png")


if __name__ == "__main__":
    main()
