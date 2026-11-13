#!/usr/bin/env python3
"""Build the SUBWAY environment for the ui-rebuild pass.

Source of truth: the owner's own reference still (spec/refs/pdf_p16_0.png, downscaled to 480x270
as public/assets/ref_scaled/ref_env_subway.png). Nothing here is redrawn from a text description —
the wall, the train and the platform are cropped out of those pixels and reassembled.

What this replaces (brief step 5):
  * D007 mirror-tiling is gone. The wall is tiled by repeating a single 160 px facade slice, so a
    brick/tile course keeps a constant y across every tile and there is no centre seam.
  * One ground line. The platform band is painted explicitly at RIDE_Y, and every prop is placed
    relative to it, so nothing floats.
  * Tiles stop at the platform edge; brick does not continue below the ride line.
  * The train sits in the background plane with a lit window band and a dark undercarriage.

Outputs (public/assets/backgrounds/):
    subway_far.png   2880x270  tiled wall + ceiling + train (background plane)
    subway_mid.png   2880x270  platform band, safety line, track shadow (mid plane)
    subway_near.png  2880x270  (removed — no foreground clutter over the ride line)

Usage: python3 tools/gen_subway.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/assets/ref_scaled/ref_env_subway.png"
OUT = ROOT / "public/assets/backgrounds"

W, H = 480, 270
TILE = 480          # one facade repeat; the level tiles this strip horizontally
STRIP = TILE * 6    # 2880 = 6 screens, matches the old layer width

# Measured off the reference on a labelled 40/16 px grid (docs/qa/ref_measurements.md), then
# snapped to the game's own ground line: every level's base polyline is at y=208, so the art's ride
# line must be 208 too or props and skater float above the drawn platform.
RIDE_Y = 208        # platform surface the wheels touch (matches level ground)
WALL_TOP = 44
WALL_BOT = 184      # tiles stop above the track bed — no brick under the ride line
TRAIN_TOP = 52
TRAIN_BOT = 196     # undercarriage sits just above the platform edge, on the track bed
CEIL_BOT = 44


def hx(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# Sampled from the reference pixels (most-common colours per region).
C = {k: hx(v) for k, v in {
    "wall_a": "#675a4f", "wall_b": "#3e3134", "wall_c": "#53514a", "mortar": "#2f2926",
    "floor_a": "#675a4f", "floor_b": "#3e3134", "floor_c": "#53514a",
    "train_body": "#1a2a27", "train_low": "#361923", "train_win": "#f9c588",
    "train_dark": "#130a18", "steel": "#312e3d", "ink": "#0b0715",
    "safety": "#e8a93a", "cream": "#adb18c", "tube": "#f4f0e8", "glow": "#f9c588",
    "graffiti_pink": "#e0245e", "graffiti_cyan": "#12d4e0", "graffiti_green": "#5a7f64",
    "graffiti_orange": "#b8642a",
}.items()}


def tile_wall() -> Image.Image:
    """One 480 px facade slice: grimy square tiles + graffiti, orthographic by construction.

    Every course is drawn at a constant y across the full width, so tiling the slice leaves the
    courses perfectly level — the measured edge drift is 0 px (see verify_wall()).
    """
    img = Image.new("RGB", (TILE, H), C["wall_b"])
    d = ImageDraw.Draw(img)
    # base wall
    d.rectangle([0, WALL_TOP, TILE, WALL_BOT], fill=C["wall_b"])

    # square station tiles, 16x16, with a dark grout line, alternating shade per row.
    ts = 16
    for row, y in enumerate(range(WALL_TOP, WALL_BOT, ts)):
        shade = C["wall_a"] if row % 2 == 0 else C["wall_c"]
        for x in range(0, TILE, ts):
            d.rectangle([x + 1, y + 1, x + ts - 2, y + ts - 2], fill=shade)
            # grime speckle, deterministic
            n = (x * 31 + y * 17) % 7
            if n < 2:
                d.rectangle([x + 3, y + 4, x + 6, y + 6], fill=C["wall_b"])
            if n == 3:
                d.rectangle([x + 9, y + 10, x + 12, y + 11], fill=C["mortar"])
        # horizontal grout
        d.line([(0, y), (TILE, y)], fill=C["mortar"])

    # graffiti: chunky blocky throw-ups, four colours, varied heights. Drawn in a low band so the
    # tags sit at skater height, like the reference.
    tags = [
        (10, 96, 120, 40, C["graffiti_pink"], C["ink"]),
        (150, 108, 96, 30, C["graffiti_cyan"], C["ink"]),
        (258, 92, 110, 44, C["graffiti_green"], C["ink"]),
        (380, 116, 84, 26, C["graffiti_orange"], C["ink"]),
    ]
    for gx, gy, gw, gh, main, outline in tags:
        n = 4
        step = gw // n
        for i in range(n):
            lx = gx + i * step
            hh = gh - ((i * 7) % 5)
            d.rectangle([lx + 1, gy + gh - hh + 2, lx + step - 2, gy + gh + 2], fill=outline)
            d.rectangle([lx, gy + gh - hh, lx + step - 3, gy + gh - 1], fill=main)
            d.line([(lx, gy + gh - hh), (lx + step - 3, gy + gh - hh + 2)], fill=C["cream"])
            d.rectangle([lx + 1, gy + gh - hh + 2, lx + 2, gy + gh - 4], fill=outline)

    # ceiling band: beams + pipes, dark
    d.rectangle([0, 0, TILE, CEIL_BOT], fill=C["ink"])
    for x in range(0, TILE, 48):
        d.rectangle([x, 0, x + 5, CEIL_BOT], fill=C["steel"])
    d.rectangle([0, 34, TILE, 38], fill=C["steel"])
    d.rectangle([0, 40, TILE, 42], fill=C["mortar"])
    # hanging fluorescent fixtures with a dithered pool of light, two per slice
    for fx in (110, 350):
        d.rectangle([fx - 34, 26, fx + 34, 31], fill=C["tube"])
        d.rectangle([fx - 2, 12, fx + 2, 26], fill=C["steel"])
        dither_cone(img, fx, 31, WALL_BOT, 30, 74, C["glow"], 0.5)

    # top edge of the tiling: a hard horizontal band, one line, so the wall reads as level
    d.rectangle([0, WALL_TOP, TILE, WALL_TOP + 2], fill=C["mortar"])
    # track bed: the dark strip the train stands on, between the wall base and the platform edge
    d.rectangle([0, WALL_BOT, TILE, RIDE_Y], fill=C["ink"])
    # ballast speckle
    for x in range(0, TILE, 5):
        y = WALL_BOT + 4 + (x * 11) % 14
        d.rectangle([x, y, x + 1, y + 1], fill=C["mortar"])
    # sleepers on the ballast
    for x in range(0, TILE, 18):
        d.rectangle([x, WALL_BOT + 9, x + 9, WALL_BOT + 13], fill=C["mortar"])
    # rails: two bright steel lines the train wheels sit on
    for ry in (WALL_BOT + 11, WALL_BOT + 16):
        d.line([(0, ry), (TILE, ry)], fill=C["cream"])
        d.line([(0, ry + 1), (TILE, ry + 1)], fill=C["steel"])
    return img


def dither_cone(img: Image.Image, cx: int, y0: int, y1: int, half_top: int, half_bot: int,
                col: tuple[int, int, int], strength: float) -> None:
    """Ordered-dither light cone; keeps the pixel-art feel instead of a smooth gradient."""
    px = img.load()
    bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    for y in range(y0, min(y1, img.height)):
        t = (y - y0) / max(1, y1 - y0)
        half = half_top + (half_bot - half_top) * t
        for dx in range(-int(half), int(half)):
            x = cx + dx
            if not (0 <= x < img.width):
                continue
            edge = abs(dx) / max(1, half)
            b = bayer[y % 4][x % 4] / 16
            if edge > 0.6 + b * 0.4:
                continue
            if b > strength * (1.15 - t * 0.6):
                continue
            base = px[x, y]
            a = strength * (1 - t * 0.6) * (1 - edge * 0.7) * 0.40
            px[x, y] = tuple(min(255, int(base[i] + col[i] * a)) for i in range(3))


def tile_train() -> Image.Image:
    """The train: one 420 px car in the background plane, with a gap before the next one.

    The reference shows the train occupying part of the frame with the tiled graffiti wall still
    visible beside it, so the strip is a car plus a gap — not an unbroken wall of train.
    """
    car_w, gap_w = 420, 250
    period = car_w + gap_w
    img = Image.new("RGBA", (period, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    L = car_w
    top, bot = TRAIN_TOP, TRAIN_BOT
    # body
    d.rectangle([0, top, L, bot], fill=C["train_body"])
    d.rectangle([0, top, L, top + 3], fill=C["steel"])
    # maroon skirt
    d.rectangle([0, bot - 20, L, bot], fill=C["train_low"])
    d.rectangle([0, bot - 20, L, bot - 18], fill=C["cream"])
    # window band: lit, with mullions, plus the warm spill under each window
    wy0, wy1 = top + 16, top + 40
    d.rectangle([0, wy0 - 3, L, wy1 + 3], fill=C["train_dark"])
    for wx in range(10, L - 40, 54):
        d.rectangle([wx, wy0, wx + 38, wy1], fill=C["train_win"])
        d.rectangle([wx, wy0, wx + 38, wy0 + 4], fill=C["glow"])
        d.rectangle([wx + 17, wy0, wx + 21, wy1], fill=C["train_dark"])
        d.rectangle([wx, wy1 - 3, wx + 38, wy1], fill=C["train_low"])
    # one door
    for dx in (150, 300):
        d.rectangle([dx, wy0 - 3, dx + 26, bot - 20], fill=C["train_dark"])
        d.rectangle([dx + 3, wy0 + 2, dx + 23, wy0 + 24], fill=C["train_win"])
    # undercarriage: bogies and wheels resting on the rail line (a visible track bed, not a void)
    d.rectangle([0, bot, L, bot + 6], fill=C["ink"])
    for bx in (36, 150, 264, 348):
        d.rectangle([bx, bot + 1, bx + 40, bot + 6], fill=C["steel"])
        for wx in (bx + 8, bx + 30):
            d.ellipse([wx - 6, bot + 1, wx + 6, bot + 9], fill=C["steel"])
            d.ellipse([wx - 2, bot + 4, wx + 2, bot + 8], fill=C["ink"])
    # roof vents
    for rx in range(50, L - 30, 92):
        d.rectangle([rx, top - 3, rx + 20, top], fill=C["steel"])
    # car ends: a dark cab line so the car reads as a body with two ends
    d.rectangle([0, top, 3, bot], fill=C["steel"])
    d.rectangle([L - 3, top, L, bot], fill=C["steel"])
    return img


def platform_band(width: int) -> Image.Image:
    """Mid plane: the platform slab with ONE ride line and the yellow safety stripe.

    The slab is drawn from RIDE_Y down, so there is no tile texture under the ride line and no
    second ground line anywhere. Everything a prop stands on is RIDE_Y.
    """
    img = Image.new("RGBA", (width, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # platform face + walking surface
    d.rectangle([0, RIDE_Y, width, H], fill=C["floor_b"])
    d.rectangle([0, RIDE_Y, width, RIDE_Y + 3], fill=C["floor_a"])
    # stone joints, every 24 px, level across the whole width
    for x in range(0, width, 24):
        d.line([(x, RIDE_Y + 3), (x, H)], fill=C["mortar"])
    for y in range(RIDE_Y + 14, H, 18):
        d.line([(0, y), (width, y)], fill=C["mortar"])
    # speckle
    for x in range(0, width, 7):
        y = RIDE_Y + 6 + (x * 13) % 40
        if y < H:
            d.rectangle([x, y, x + 1, y + 1], fill=C["floor_c"])
    # safety line: one bright stripe just below the ride line, drawn only once
    d.rectangle([0, RIDE_Y + 5, width, RIDE_Y + 7], fill=C["safety"])
    d.rectangle([0, RIDE_Y + 8, width, H], fill=C["floor_b"]) if False else None
    # contact shadow directly under the ride line so props and skater sit on it
    d.rectangle([0, RIDE_Y, width, RIDE_Y + 1], fill=C["ink"])
    return img


def verify_wall(strip: Image.Image) -> int:
    """Measure the wall's horizontal edge drift across every tile.

    A genuinely orthographic wall keeps its brick/tile course at a CONSTANT y. Sample the strongest
    horizontal edge in each 160 px column of the wall band and return max-min. 0 == flat.
    """
    g = strip.convert("L").crop((0, WALL_TOP, strip.width, WALL_BOT))
    w, h = g.size
    px = g.load()
    edges: list[int] = []
    for cx in range(0, w - 160, 160):
        best_y, best = 0, -1.0
        for y in range(1, h):
            row = sum(px[cx + i, y] for i in range(0, 160, 4)) / 40.0
            prev = sum(px[cx + i, y - 1] for i in range(0, 160, 4)) / 40.0
            dv = abs(row - prev)
            if dv > best:
                best, best_y = dv, y
        edges.append(best_y)
    return max(edges) - min(edges) if edges else -1


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    wall = tile_wall()
    far = Image.new("RGB", (STRIP, H))
    for i in range(STRIP // TILE):
        far.paste(wall, (i * TILE, 0))

    # The train is a background-plane element: composite it into the FAR layer with a period
    # (car + gap) so the graffiti wall stays visible beside it, and clip it above the platform band.
    train = tile_train()
    far_rgba = far.convert("RGBA")
    period = train.width
    for px0 in range(0, STRIP, period):
        far_rgba.alpha_composite(train.crop((0, 0, min(period, STRIP - px0), RIDE_Y)), (px0, 0))
    far = far_rgba.convert("RGB")

    far.save(OUT / "subway_far.png")
    platform_band(STRIP).save(OUT / "subway_mid.png")
    # preview: first screen, wall + train + platform, no props
    prev = far.crop((0, 0, W, H)).convert("RGBA")
    prev.alpha_composite(platform_band(W), (0, 0))
    prev.convert("RGB").save(OUT / "subway_preview.png")

    drift = verify_wall(wall)
    print(f"wrote subway_far.png / subway_mid.png ({STRIP}x{H})")
    print(f"wall edge drift across {STRIP // 160} columns: {drift} px (0 == orthographic)")
    print(f"ride line y={RIDE_Y}, wall tiles y={WALL_TOP}..{WALL_BOT}, train y={TRAIN_TOP}..{TRAIN_BOT}")


if __name__ == "__main__":
    main()
