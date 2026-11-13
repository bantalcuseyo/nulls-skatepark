#!/usr/bin/env python3
"""Generate the night-city environment layers and props for the three levels.

All art is 480x270 (or wider strips for parallax), drawn in the extracted master palette, with
Bayer-dithered light cones, neon signage, brickwork and silhouettes. Layers are drawn from far
to near and composited by the level loader.

Outputs public/assets/backgrounds/<level>_{far,mid,near}.png and public/assets/props/*.png.
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BG = ROOT / "public/assets/backgrounds"
PR = ROOT / "public/assets/props"
W, H = 480, 270
LW = 1440  # layer width (3 screens, tiled by the parallax system)
rng = random.Random(7)


def hx(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


C = {k: hx(v) for k, v in {
    "navy": "#0c1226", "navy2": "#131629", "brick": "#6b2f26", "brick_d": "#502120",
    "amber": "#e8a93a", "amber_soft": "#f9c588", "magenta": "#e0245e", "cyan": "#12d4e0",
    "sage": "#6f7a5e", "sage_d": "#294d50", "maroon": "#5a1f22", "green": "#1f3b2b",
    "rust": "#b8642a", "tan": "#c79a5b", "tube": "#c8f0a0", "grey": "#53514a",
    "grey_d": "#312e3d", "cream": "#adb18c", "black": "#000000",
}.items()}

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def dither_rect(img, box, c, strength=0.5):
    """Paint a rectangle with an ordered-dither fade from `strength` alpha to 0 vertically."""
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0)
        for x in range(x0, x1):
            if 0 <= x < img.width and 0 <= y < img.height:
                b = BAYER[y % 4][x % 4] / 16
                if t < strength * (0.6 + b * 0.8):
                    img.putpixel((x, y), c + (255,))
    return d


def glow(img, cx, cy, rx, ry, c, strength=1.0, dither=True):
    """Elliptical light pool with Bayer dithering on the edge."""
    px = img.load()
    for y in range(max(0, int(cy - ry)), min(img.height, int(cy + ry))):
        for x in range(max(0, int(cx - rx)), min(img.width, int(cx + rx))):
            nd = math.hypot((x - cx) / rx, (y - cy) / ry)
            if nd > 1:
                continue
            a = (1 - nd) ** 1.6 * strength
            if dither:
                b = BAYER[y % 4][x % 4] / 16
                if a < b:
                    continue
            base = px[x, y][:3]
            blended = tuple(min(255, int(base[i] + c[i] * a)) for i in range(3))
            px[x, y] = blended + (255,)


def cone(img, x, y_top, y_bot, half_top, half_bot, c, strength=0.9):
    """Dithered streetlamp light cone (trapezoid)."""
    for y in range(y_top, y_bot):
        t = (y - y_top) / max(1, y_bot - y_top)
        half = half_top + (half_bot - half_top) * t
        for dx in range(-int(half), int(half)):
            px_ = x + dx
            if 0 <= px_ < img.width:
                edge = abs(dx) / max(1, half)
                b = BAYER[y % 4][px_ % 4] / 16
                if edge > 0.55 + b * 0.5 - (1 - strength) * 0.4:
                    continue
                if BAYER[y % 4][px_ % 4] / 16 > strength * (1.1 - t * 0.5):
                    continue
                base = img.getpixel((px_, y))[:3]
                a = strength * (1 - t * 0.55) * (1 - edge * 0.6) * 0.55
                img.putpixel((px_, y), tuple(min(255, int(base[i] + c[i] * a)) for i in range(3)) + (255,))


def bricks(img, x0, y0, x1, y1, base, dark, mortar=None, bw=16, bh=8):
    d = ImageDraw.Draw(img)
    mortar = mortar or dark
    d.rectangle([x0, y0, x1, y1], fill=base)
    for row, y in enumerate(range(y0, y1, bh)):
        off = 0 if row % 2 == 0 else bw // 2
        for x in range(x0 - off, x1, bw):
            d.line([(x, y), (x, min(y + bh - 1, y1))], fill=mortar)
            d.line([(max(x0, x), y), (min(x1, x + bw - 1), y)], fill=mortar)
            # occasional darker brick
            if rng.random() < 0.12:
                d.rectangle([x + 1, y + 1, x + bw - 2, y + bh - 2], fill=dark)


def graffiti(img, x, y, w, h, palette):
    """Blocky throw-up: 3-4 chunky letters with outline + dropshadow."""
    d = ImageDraw.Draw(img)
    main, outline, accent = palette
    for i in range(4):
        lx = x + i * (w // 4)
        hh = h - rng.randint(0, 4)
        d.rectangle([lx + 1, y + h - hh + 2, lx + w // 4 - 2, y + h + 1], fill=outline)
        d.rectangle([lx, y + h - hh, lx + w // 4 - 3, y + h - 1], fill=main)
        d.line([(lx, y + h - hh), (lx + w // 4 - 3, y + h - hh + rng.randint(1, 4))], fill=accent, width=1)
        d.rectangle([lx + 1, y + h - hh + 2, lx + 2, y + h - 4], fill=outline)


def windows(img, x0, y0, x1, y1, lit_ratio=0.35):
    d = ImageDraw.Draw(img)
    for y in range(y0, y1, 14):
        for x in range(x0, x1, 11):
            lit = rng.random() < lit_ratio
            c = C["amber_soft"] if lit else C["navy2"]
            d.rectangle([x, y, x + 4, y + 7], fill=c)


# ------------------------------------------------------------------- layers
def alley_far():
    img = Image.new("RGB", (LW, H), C["navy"])
    d = ImageDraw.Draw(img)
    # skyline silhouettes
    x = 0
    while x < LW:
        w = rng.randint(40, 90)
        h = rng.randint(60, 150)
        d.rectangle([x, H - h - 60, x + w, H], fill=C["navy2"])
        windows(img, x + 3, H - h - 55, x + w - 3, H - 60, 0.25)
        x += w + rng.randint(4, 14)
    # stars
    for _ in range(80):
        img.putpixel((rng.randrange(LW), rng.randrange(0, 70)), C["cream"])
    return img


def alley_mid():
    img = Image.new("RGB", (LW, H), C["brick_d"])
    d = ImageDraw.Draw(img)
    # repeating tenement facades with fire escapes + shopfronts
    for i in range(6):
        bx = i * 240
        wall_h = rng.randint(150, 175)
        bricks(img, bx, H - wall_h - 40, bx + 232, H, C["brick"], C["brick_d"], bw=18, bh=9)
        windows(img, bx + 12, H - wall_h - 30, bx + 224, H - 70, 0.45)
        # fire escape zig-zag
        fy = H - wall_h + 20
        for lvl in range(3):
            yy = fy + lvl * 32
            d.rectangle([bx + 20, yy, bx + 90, yy + 2], fill=C["grey_d"])
            for bx2 in range(bx + 20, bx + 90, 7):
                d.line([(bx2, yy), (bx2, yy + 12)], fill=C["grey_d"])
            d.line([(bx + 20, yy + 12), (bx + 90, yy + 12)], fill=C["grey"])
            d.line([(bx + 85, yy + 12), (bx + 30, yy + 30)], fill=C["grey_d"], width=2)
        # shopfront at street level
        d.rectangle([bx + 8, H - 52, bx + 220, H - 20], fill=C["navy2"])
        # roll-up garage door with graffiti
        d.rectangle([bx + 130, H - 50, bx + 200, H - 22], fill=C["grey_d"])
        for yy in range(H - 50, H - 22, 3):
            d.line([(bx + 130, yy), (bx + 200, yy)], fill=C["grey"])
        if i % 2 == 0:
            graffiti(img, bx + 24, H - 50, 100, 26, [C["magenta"], C["navy"], C["cyan"]])
        else:
            graffiti(img, bx + 24, H - 48, 96, 24, [C["cyan"], C["navy"], C["sage"]])
    return img


def alley_near():
    img = Image.new("RGBA", (LW, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # neon signs + lamps + sidewalk details
    for i in range(6):
        bx = i * 240
        if i % 3 == 0:
            # ARCADE sign: red box, cyan letters
            d.rectangle([bx + 18, 60, bx + 92, 86], fill=C["maroon"], outline=C["magenta"])
            draw_block_text(img, "ARCADE", bx + 24, 66, C["cyan"])
            glow(img, bx + 55, 75, 55, 40, C["magenta"], 0.35)
        else:
            # vertical LIQUOR sign
            d.rectangle([bx + 196, 40, bx + 214, 130], fill=C["navy2"], outline=C["cyan"])
            for k, ch in enumerate("LIQUOR"):
                draw_block_text(img, ch, bx + 200, 44 + k * 14, C["cyan"])
            glow(img, bx + 205, 85, 30, 60, C["cyan"], 0.3)
        # streetlamp with dithered cone
        lx = bx + 120
        d.line([(lx, 150), (lx, 40)], fill=C["grey_d"], width=2)
        d.line([(lx, 40), (lx + 22, 40)], fill=C["grey_d"], width=2)
        d.rectangle([lx + 18, 40, lx + 26, 45], fill=C["amber_soft"])
        cone(img, lx + 22, 45, 232, 6, 52, C["amber"], 0.85)
        glow(img, lx + 22, 232, 55, 12, C["amber"], 0.35)
        # puddle neon spill
        d.ellipse([bx + 20, 244, bx + 100, 252], fill=C["sage_d"])
        glow(img, bx + 60, 248, 45, 5, C["magenta"] if i % 2 == 0 else C["cyan"], 0.5)
        # dumpster silhouette strip near ground
        d.rectangle([bx + 150, 218, bx + 190, 240], fill=C["green"])
        d.rectangle([bx + 150, 216, bx + 190, 219], fill=C["sage_d"])
    return img


SUBWAY_FONT = "3x5"


def draw_block_text(img, text, x, y, color, scale=1):
    """3x5 blocky sign letters, not the HUD font — used inside sign art."""
    d = ImageDraw.Draw(img)
    glyphs = {
        "A": ["010", "101", "111", "101", "101"], "B": ["110", "101", "110", "101", "110"],
        "C": ["011", "100", "100", "100", "011"], "D": ["110", "101", "101", "101", "110"],
        "E": ["111", "100", "110", "100", "111"], "F": ["111", "100", "110", "100", "100"],
        "G": ["011", "100", "101", "101", "011"], "H": ["101", "101", "111", "101", "101"],
        "I": ["111", "010", "010", "010", "111"], "J": ["001", "001", "001", "101", "010"],
        "K": ["101", "101", "110", "101", "101"], "L": ["100", "100", "100", "100", "111"],
        "M": ["101", "111", "111", "101", "101"], "N": ["101", "111", "111", "111", "101"],
        "O": ["010", "101", "101", "101", "010"], "P": ["110", "101", "110", "100", "100"],
        "Q": ["010", "101", "101", "111", "011"], "R": ["110", "101", "110", "101", "101"],
        "S": ["011", "100", "010", "001", "110"], "T": ["111", "010", "010", "010", "010"],
        "U": ["101", "101", "101", "101", "011"], "V": ["101", "101", "101", "101", "010"],
        "W": ["101", "101", "111", "111", "101"], "X": ["101", "101", "010", "101", "101"],
        "Y": ["101", "101", "010", "010", "010"], "Z": ["111", "001", "010", "100", "111"],
        "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
        "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"],
        "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
        "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "001", "010", "010"],
        "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
        " ": ["000"] * 5,
    }
    for i, ch in enumerate(text):
        g = glyphs.get(ch.upper(), glyphs[" "])
        for r, row in enumerate(g):
            for c, v in enumerate(row):
                if v == "1":
                    d.rectangle([x + (i * 4 + c) * scale, y + r * scale,
                                 x + (i * 4 + c) * scale + scale - 1, y + r * scale + scale - 1], fill=color)


def subway_far():
    img = Image.new("RGB", (LW, H), C["navy2"])
    d = ImageDraw.Draw(img)
    # ceiling with rusty pipes
    d.rectangle([0, 0, LW, 26], fill=C["grey_d"])
    for x in range(0, LW, 60):
        d.rectangle([x, 8, x + 40, 12], fill=C["maroon"])
        d.rectangle([x + 10, 16, x + 70, 19], fill=C["grey"])
    # tiled wall
    for y in range(30, 170, 10):
        for x in range(0, LW, 20):
            d.rectangle([x, y, x + 18, y + 8], fill=C["sage"] if rng.random() > 0.06 else C["sage_d"])
            d.rectangle([x, y + 8, x + 18, y + 9], fill=C["green"])
    # graffiti pieces
    pals = [C["magenta"], C["cyan"], C["tube"], C["amber"], C["rust"]]
    for i in range(8):
        gx = i * 180 + rng.randint(0, 30)
        graffiti(img, gx, 90 + rng.randint(-10, 20), 140, 60,
                 [pals[i % 5], C["navy"], pals[(i + 2) % 5]])
    # station name signs
    for i in range(4):
        sx = 60 + i * 360
        d.rectangle([sx, 36, sx + 90, 52], fill=C["navy"], outline=C["cream"])
        draw_block_text(img, "PLATFORM 0", sx + 6, 42, C["cream"])
    return img


def subway_mid():
    img = Image.new("RGB", (LW, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # support pillars + benches + posters
    for i in range(6):
        bx = i * 240
        d.rectangle([bx + 40, 26, bx + 62, 200], fill=C["grey_d"])
        d.rectangle([bx + 40, 26, bx + 44, 200], fill=C["grey"])
        d.rectangle([bx + 34, 190, bx + 68, 200], fill=C["grey"])
        # poster
        d.rectangle([bx + 90, 60, bx + 130, 110], fill=C["navy2"], outline=C["cream"])
        draw_block_text(img, "NOCTURNE", bx + 94, 66, C["magenta"])
        d.rectangle([bx + 96, 80, bx + 124, 100], fill=C["sage_d"])
        # fluorescent fixture + pool
        d.rectangle([bx + 150, 30, bx + 210, 34], fill=C["tube"])
        glow(img, bx + 180, 190, 90, 30, C["tube"], 0.25)
        cone(img, bx + 180, 34, 190, 26, 70, C["tube"], 0.4)
        # bench
        d.rectangle([bx + 150, 190, bx + 220, 196], fill=C["maroon"])
        for yy in range(192, 196, 2):
            d.line([(bx + 150, yy), (bx + 220, yy)], fill=C["grey_d"])
        d.rectangle([bx + 155, 196, bx + 160, 208], fill=C["grey_d"])
        d.rectangle([bx + 210, 196, bx + 215, 208], fill=C["grey_d"])
    # platform floor + safety line
    d.rectangle([0, 208, LW, 232], fill=C["grey_d"])
    for x in range(0, LW, 16):
        d.line([(x, 208), (x + 10, 208)], fill=C["grey"])
    d.rectangle([0, 224, LW, 227], fill=C["amber"])
    for x in range(0, LW, 24):
        d.rectangle([x, 225, x + 12, 226], fill=C["navy2"])
    # track bed
    d.rectangle([0, 232, LW, 250], fill=C["black"])
    for y in (236, 244):
        d.line([(0, y), (LW, y)], fill=C["grey"])
    return img.convert("RGB")


def warehouse_far():
    img = Image.new("RGB", (LW, H), C["brick_d"])
    d = ImageDraw.Draw(img)
    bricks(img, 0, 0, LW, 200, C["brick"], C["brick_d"], bw=22, bh=10)
    # steel trusses
    for i in range(4):
        bx = i * 360
        d.rectangle([bx, 0, bx + 14, 200], fill=C["grey_d"])
        for yy in range(10, 200, 24):
            d.line([(bx, yy), (bx + 14, yy + 12)], fill=C["grey"])
    d.rectangle([0, 20, LW, 30], fill=C["grey_d"])
    for x in range(0, LW, 40):
        d.line([(x, 20), (x + 20, 30)], fill=C["grey"])
    # high windows (moonlight)
    for i in range(8):
        wx = 40 + i * 170
        d.rectangle([wx, 44, wx + 60, 84], fill=C["navy"], outline=C["grey_d"])
        for k in range(1, 4):
            d.line([(wx + k * 15, 44), (wx + k * 15, 84)], fill=C["grey_d"])
    # hanging tubes
    for i in range(6):
        tx = 60 + i * 240
        d.line([(tx, 30), (tx, 96)], fill=C["grey_d"])
        d.rectangle([tx - 28, 96, tx + 28, 100], fill=C["tube"])
        cone(img, tx, 100, 210, 24, 80, C["tube"], 0.35)
    return img


def warehouse_mid():
    img = Image.new("RGB", (LW, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i in range(6):
        bx = i * 240
        # machinery block
        d.rectangle([bx + 20, 150, bx + 90, 208], fill=C["green"])
        d.rectangle([bx + 26, 156, bx + 84, 176], fill=C["sage_d"])
        d.rectangle([bx + 30, 182, bx + 46, 194], fill=C["grey_d"])
        d.rectangle([bx + 52, 182, bx + 56, 194], fill=C["amber"])
        d.rectangle([bx + 60, 182, bx + 64, 194], fill=C["magenta"])
        # crates
        for cx, cy, s in ((bx + 110, 188, 24), (bx + 136, 188, 24), (bx + 122, 164, 24)):
            d.rectangle([cx, cy, cx + s, cy + s], fill=C["tan"], outline=C["maroon"])
            d.line([(cx, cy), (cx + s, cy + s)], fill=C["maroon"])
        # oil drums
        for dx, c in ((bx + 180, C["rust"]), (bx + 200, C["green"])):
            d.rectangle([bx + dx % 240, 182, bx + dx % 240 + 14, 208], fill=c)
            d.rectangle([bx + dx % 240, 186, bx + dx % 240 + 14, 188], fill=C["grey_d"])
            d.rectangle([bx + dx % 240, 198, bx + dx % 240 + 14, 200], fill=C["grey_d"])
        graffiti(img, bx + 20, 110, 90, 30, [C["cyan"], C["navy"], C["tube"]])
    # floor
    d.rectangle([0, 208, LW, H], fill=C["grey"])
    for x in range(0, LW, 30):
        d.line([(x, 212), (x + 18, 214)], fill=C["grey_d"])
    for _ in range(60):
        x, y = rng.randrange(LW), rng.randrange(212, 250)
        d.line([(x, y), (x + rng.randint(2, 8), y + 2)], fill=C["grey_d"])
    return img.convert("RGB")


# ------------------------------------------------------------------- props (transparent)
def props():
    out = {}

    def new(w, h):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        return img, ImageDraw.Draw(img)

    # kicker 64x32
    img, d = new(64, 32)
    d.polygon([(0, 32), (64, 0), (64, 32)], fill=C["tan"])
    d.polygon([(0, 32), (64, 0), (64, 4), (4, 32)], fill=C["rust"])
    for x in range(8, 60, 8):
        d.line([(x, 32 - x // 2), (x, 32)], fill=C["maroon"])
    out["kicker"] = img

    # rail 96x24 (posts at ends)
    img, d = new(96, 24)
    d.rectangle([0, 0, 95, 2], fill=C["cream"])
    d.rectangle([0, 2, 95, 3], fill=C["grey_d"])
    for x in (6, 88):
        d.rectangle([x, 3, x + 2, 23], fill=C["grey"])
        d.rectangle([x - 3, 21, x + 5, 23], fill=C["grey_d"])
    out["rail"] = img

    # dumpster 40x28
    img, d = new(40, 28)
    d.rectangle([0, 4, 39, 27], fill=C["green"])
    d.rectangle([-1, 0, 40, 4], fill=C["sage_d"])
    d.rectangle([2, 8, 36, 12], fill=C["sage"])
    for x in (4, 34):
        d.rectangle([x, 24, x + 3, 28], fill=C["grey_d"])
    out["dumpster"] = img

    # quarter pipe 96x110 (right-facing concave)
    img, d = new(96, 110)
    pts = [(0, 110)]
    for i in range(24):
        t = i / 23
        pts.append((96 * t, 110 - 110 * (1 - math.cos(t * math.pi / 2))))
    pts.append((96, 110))
    d.polygon(pts, fill=C["grey"])
    d.polygon([(0, 108)] + [(96 * (i / 23), 110 - 110 * (1 - math.cos(i / 23 * math.pi / 2)) - 2) for i in range(24)] + [(96, 108)], fill=C["cream"])
    out["quarter"] = img

    # funbox 80x32
    img, d = new(80, 32)
    d.rectangle([0, 10, 79, 31], fill=C["sage_d"])
    d.rectangle([0, 6, 79, 10], fill=C["tan"])
    d.polygon([(0, 32), (14, 10), (14, 32)], fill=C["rust"])
    d.polygon([(80, 32), (66, 10), (66, 32)], fill=C["rust"])
    out["funbox"] = img

    # bench 48x20
    img, d = new(48, 20)
    for i in range(3):
        d.rectangle([0, 4 + i * 3, 47, 5 + i * 3], fill=C["maroon"])
    d.rectangle([4, 12, 7, 20], fill=C["grey_d"])
    d.rectangle([40, 12, 43, 20], fill=C["grey_d"])
    d.rectangle([0, 0, 47, 3], fill=C["maroon"])
    out["bench"] = img

    # letter tiles 16x16 (S K A T E) — neon sign style
    for ch, col in (("S", C["magenta"]), ("K", C["cyan"]), ("A", C["amber"]), ("T", C["tube"]), ("E", C["rust"])):
        img, d = new(16, 16)
        d.rectangle([1, 1, 14, 14], fill=C["navy2"], outline=col)
        draw_block_text(img, ch, 5, 5, col)
        out[f"letter_{ch}"] = img

    # secret items
    img, d = new(16, 16)
    d.ellipse([2, 2, 13, 13], fill=C["amber"], outline=C["maroon"])
    draw_block_text(img, "A", 6, 5, C["maroon"])
    out["token_arcade"] = img
    img, d = new(12, 16)
    d.rectangle([2, 4, 9, 15], fill=C["magenta"])
    d.rectangle([3, 1, 8, 4], fill=C["cream"])
    d.rectangle([2, 6, 9, 8], fill=C["cream"])
    out["spray"] = img
    img, d = new(16, 16)
    d.rectangle([6, 4, 9, 14], fill=C["amber"])
    d.rectangle([3, 2, 12, 5], fill=C["amber"])
    out["wrench"] = img
    img, d = new(16, 16)
    d.ellipse([2, 2, 13, 13], fill=C["cyan"], outline=C["navy"])
    draw_block_text(img, "M", 6, 5, C["navy"])
    out["token_metro"] = img

    # trash can (rolling hazard) 16x20
    img, d = new(16, 20)
    d.rectangle([2, 4, 13, 18], fill=C["grey"])
    d.rectangle([0, 2, 15, 4], fill=C["grey_d"])
    for x in (4, 8, 12):
        d.line([(x, 6), (x, 16)], fill=C["grey_d"])
    out["trashcan"] = img

    # oil drum (rolling hazard) 16x24
    img, d = new(16, 24)
    d.rectangle([1, 2, 14, 22], fill=C["rust"])
    d.rectangle([1, 6, 14, 8], fill=C["maroon"])
    d.rectangle([1, 14, 14, 16], fill=C["maroon"])
    out["drum"] = img

    # barrier (red-white striped) 24x20
    img, d = new(24, 20)
    d.rectangle([0, 0, 23, 6], fill=C["cream"])
    for x in range(0, 24, 6):
        d.rectangle([x, 0, x + 2, 6], fill=C["maroon"])
    d.rectangle([2, 6, 5, 20], fill=C["grey_d"])
    d.rectangle([18, 6, 21, 20], fill=C["grey_d"])
    out["barrier"] = img

    # manual pad 48x8
    img, d = new(48, 8)
    d.rectangle([0, 0, 47, 7], fill=C["sage_d"])
    d.rectangle([0, 0, 47, 1], fill=C["cream"])
    out["manualpad"] = img

    return out


def composite(level):
    far = globals()[f"{level}_far"]()
    mid = globals()[f"{level}_mid"]() if level != "alley" else alley_mid()
    near = globals()[f"{level}_near"]() if level == "alley" else None
    full = far.convert("RGBA")
    full.alpha_composite(mid.convert("RGBA"), (0, 0))
    if near:
        full.alpha_composite(near.convert("RGBA"), (0, 0))
    return far, mid, near, full


def mirror_seam(img):
    """Return a 2x-wide strip: original + horizontal mirror. Tiling this reads as a continuous
    street instead of a hard repeat cut (brief section 6: mirror-tiled seams)."""
    w, h = img.size
    out = Image.new(img.mode, (w * 2, h))
    out.paste(img, (0, 0))
    out.paste(img.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (w, 0))
    return out


def main():
    BG.mkdir(parents=True, exist_ok=True)
    PR.mkdir(parents=True, exist_ok=True)
    for lvl in ("alley", "subway", "warehouse"):
        far, mid, near, full = composite(lvl)
        mirror_seam(far).save(BG / f"{lvl}_far.png")
        mirror_seam(mid).save(BG / f"{lvl}_mid.png")
        if near:
            mirror_seam(near).save(BG / f"{lvl}_near.png")
        full.crop((0, 0, 480, 270)).save(BG / f"{lvl}_preview.png")
        print("level", lvl, "layers written")
    for name, img in props().items():
        img.save(PR / f"{name}.png")
    print("props:", len(props()))
    # palette-locked check: count colours used in one preview
    im = Image.open(BG / "alley_preview.png").convert("RGB")
    print("alley preview colours:", len(im.getcolors(4096) or []))


if __name__ == "__main__":
    main()
