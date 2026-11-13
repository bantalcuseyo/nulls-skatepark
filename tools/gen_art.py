#!/usr/bin/env python3
"""Procedural pixel-art generator for NULLS SKATEPARK.

Draws everything on a strict 64x64 grid from a skeleton description, so all four skaters share
one animation set and differ only by ears, headgear, outfit palette and props (paper-doll rules,
brief section 5.1).

Outputs (public/assets/sprites/):
  skater_<id>.png    horizontal strips, one row per animation, 64x64 cells
  skater_<id>.json   atlas: { anims: { name: {row, frames, fps, loop} } }
  board.png          board strip for flip tricks (board only)
  fx.png             dust, spark, ring, streak particles

Run: python3 tools/gen_art.py
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/assets/sprites"
CELL = 64

# ---------------------------------------------------------------- palette (from palette.json)
PAL_JSON = json.loads((ROOT / "public/assets/palette.json").read_text())
MASTER = PAL_JSON["colours"]


def hx(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# Named anchors from the reference sheets (brief section 5.4), snapped to nearby palette values.
BLACK = (12, 12, 14)
OUTLINE = (6, 6, 10)
WHITE = (244, 240, 232)
SHADOW = (28, 26, 34)


@dataclass
class Skin:
    id: str
    outfit: tuple[int, int, int]
    outfit_dark: tuple[int, int, int]
    pants: tuple[int, int, int]
    pants_dark: tuple[int, int, int]
    accent: tuple[int, int, int]
    accent_dark: tuple[int, int, int]
    shoe: tuple[int, int, int]
    sole: tuple[int, int, int]
    rim: tuple[int, int, int]
    ear_inner: tuple[int, int, int] | None
    headgear: str          # 'headphones' | 'visor' | 'goggles' | 'glasses'
    ears: str              # 'spiky' | 'tall_round' | 'tall_point' | 'point'
    prop: str              # 'handheld' | 'notebook' | 'cdplayer' | 'none'
    fur_collar: bool = False
    deck: tuple[int, int, int] = (92, 13, 17)   # board deck colour


SKINS: dict[str, Skin] = {
    "riff": Skin(
        id="riff",
        outfit=hx("#e9ad76"), outfit_dark=hx("#b88460"),
        pants=hx("#254362"), pants_dark=hx("#1b2238"),
        accent=hx("#d42b2e"), accent_dark=hx("#5c0d11"),
        shoe=hx("#1b2238"), sole=hx("#adb18c"),
        rim=hx("#d42b2e"), ear_inner=None,
        headgear="headphones", ears="spiky", prop="handheld", deck=hx("#5c0d11"),
    ),
    "prism": Skin(
        id="prism",
        outfit=hx("#1c1228"), outfit_dark=hx("#130e20"),
        pants=hx("#130e20"), pants_dark=hx("#0b0715"),
        accent=hx("#12d4e0"), accent_dark=hx("#203270"),
        shoe=hx("#a28c89"), sole=hx("#53514a"),
        rim=hx("#e0245e"), ear_inner=hx("#d8956e"),
        headgear="visor", ears="tall_round", prop="handheld", deck=hx("#1c1228"),
    ),
    "brass": Skin(
        id="brass",
        outfit=hx("#643522"), outfit_dark=hx("#502120"),
        pants=hx("#5b5a53"), pants_dark=hx("#3e3134"),
        accent=hx("#ed8445"), accent_dark=hx("#b8642a"),
        shoe=hx("#502120"), sole=hx("#d9a868"),
        rim=hx("#e8a93a"), ear_inner=hx("#9c6f58"),
        headgear="goggles", ears="tall_point", prop="notebook", fur_collar=True, deck=hx("#643522"),
    ),
    "loop": Skin(
        id="loop",
        outfit=hx("#182b28"), outfit_dark=hx("#0d1c23"),
        pants=hx("#213047"), pants_dark=hx("#131629"),
        accent=hx("#183337"), accent_dark=hx("#66536b"),
        shoe=hx("#131629"), sole=hx("#53514a"),
        rim=hx("#b8642a"), ear_inner=hx("#66536b"),
        headgear="glasses", ears="point", prop="cdplayer", deck=hx("#182b28"),
    ),
}


# ---------------------------------------------------------------- tiny raster helpers
def SKIN_LIGHT(skin: "Skin"):
    """A slightly lighter pants shade for the front leg, so the two limbs read by value."""
    return (min(255, int(skin.pants[0] * 1.35) + 10),
            min(255, int(skin.pants[1] * 1.35) + 10),
            min(255, int(skin.pants[2] * 1.35) + 12))


def SKIN_SEAM(skin: "Skin"):
    """A near-black shade of the pants, used to separate overlapping limbs."""
    r = max(0, int(skin.pants[0] * 0.35))
    g = max(0, int(skin.pants[1] * 0.35))
    b = max(0, int(skin.pants[2] * 0.35))
    return (r, g, b)


def blank() -> Image.Image:
    return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))


def rect(d: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, c) -> None:
    if w <= 0 or h <= 0:
        return
    x0, y0 = max(0, round(x)), max(0, round(y))
    x1, y1 = min(CELL - 1, round(x + w) - 1), min(CELL - 1, round(y + h) - 1)
    if x1 < x0 or y1 < y0:
        return
    if len(c) == 3:
        c = tuple(c) + (255,)
    d.rectangle([x0, y0, x1, y1], fill=tuple(c))


def poly(d: ImageDraw.ImageDraw, pts, c) -> None:
    d.polygon([(round(x), round(y)) for x, y in pts], fill=c + (255,))


def ellipse(d: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, c) -> None:
    d.ellipse([round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)], fill=c + (255,))


def limb(d, x0, y0, x1, y1, w, c) -> None:
    """Thick line as a quad — used for arms and legs so width reads as clothing volume."""
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / ln * w / 2, dx / ln * w / 2
    poly(d, [(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], c)
    r = w / 2
    ellipse(d, x0, y0, r, r, c)
    ellipse(d, x1, y1, r, r, c)


# ---------------------------------------------------------------- pose model
@dataclass
class Pose:
    """All angles in degrees, lengths in px, origin at the board contact point (feet centre)."""
    crouch: float = 0.0        # 0 = standing tall, 1 = deep crouch
    lean: float = 0.0          # torso lean, + = toward facing direction
    body_rot: float = 0.0      # whole-body rotation for flips (deg)
    arm_front: float = 0.0     # 0 = down, + = forward/up
    arm_back: float = 0.0
    leg_spread: float = 0.0    # extra stance width
    board_angle: float = 0.0
    board_visible: bool = True
    grab: str = ""             # '', 'indy', 'melon', 'stalefish', 'method', 'mute'
    head_tilt: float = 0.0
    prop_visible: bool = False


def skater_frame(skin: Skin, pose: Pose, facing: int = 1) -> Image.Image:
    """Render one 64x64 cell.

    Chibi proportions per the brief: the head is about a third of the total figure, the ears read
    as a jagged crown taller than the head, and the outfit is a big baggy silhouette. Feet sit at
    y=57 with the board below them so the sprite grounds cleanly at any integer scale.
    """
    img = blank()
    d = ImageDraw.Draw(img)

    # Geometry is built to a measured budget (brief section 5.1): the whole figure lands at
    # 44-48 px tall inside the 64 px cell, feet at y=58, board below that, and the head is
    # about a third of the figure. Building it any taller overflows the cell and the limbs
    # collapse into one silhouette.
    FOOT_Y = 58.0
    crouch = pose.crouch
    HEAD_D = 13.6                    # head diameter
    leg_h = 10.4 - 3.8 * crouch      # hip to foot
    torso_h = 11.5 - 3.0 * crouch    # shoulder to hip
    head_r = HEAD_D / 2

    lean = math.radians(pose.lean)
    sway = math.sin(lean)
    cosp = math.cos(lean)

    hip = (32.0, FOOT_Y - leg_h)
    sh = (hip[0] + sway * torso_h, hip[1] - cosp * torso_h)
    hc = (sh[0] + sway * (head_r + 1.2), sh[1] - cosp * (head_r + 1.0))

    # Wide stance and thin legs: two limbs read as separate at game scale.
    stance = 8.2 + pose.leg_spread * 0.85
    f_front = (hip[0] + stance, FOOT_Y)
    f_back = (hip[0] - stance, FOOT_Y)

    # ---------------- board (under the feet, angle readable)
    if pose.board_visible:
        ba = math.radians(pose.board_angle)
        bx, by = 32.0, FOOT_Y + 2.5
        dx, dy = math.cos(ba), math.sin(ba)
        nx, ny = -dy, dx
        deck = [
            (bx - dx * 12.5 + nx * 1.8, by - dy * 14 + ny * 2),
            (bx + dx * 12.5 + nx * 1.8, by + dy * 14 + ny * 2),
            (bx + dx * 12.5 - nx * 1.8, by + dy * 14 - ny * 2),
            (bx - dx * 12.5 - nx * 1.8, by - dy * 14 - ny * 2),
        ]
        poly(d, deck, skin.deck)
        # grip tape stripe on the top edge
        poly(d, [
            (bx - dx * 11.5 + nx * 1.8, by - dy * 13 + ny * 2),
            (bx + dx * 11.5 + nx * 1.8, by + dy * 13 + ny * 2),
            (bx + dx * 11.5 + nx * 0.9, by + dy * 13 + ny * 1),
            (bx - dx * 11.5 + nx * 0.9, by - dy * 13 + ny * 1),
        ], hx("#312e3d"))
        for t in (-7, 7):
            wx, wy = bx + dx * t, by + dy * t + 2
            rect(d, wx - 2, wy, 4, 2, hx("#53514a"))
            for side in (-1, 1):
                ellipse(d, wx + side * 3, wy + 3.5, 1.7, 1.7, hx("#adb18c"))

    # ---------------- back leg (darkened for depth)
    knee_b = ((hip[0] + f_back[0]) / 2 - 0.5, (hip[1] + f_back[1]) / 2 + 1)
    limb(d, hip[0] - 0.5, hip[1] - 1, knee_b[0], knee_b[1], 5.5, skin.pants_dark)
    limb(d, knee_b[0], knee_b[1], f_back[0], f_back[1] - 2, 5, skin.pants_dark)
    rect(d, f_back[0] - 3, f_back[1] - 2, 7, 3.5, skin.shoe)
    rect(d, f_back[0] - 3, f_back[1] + 1.5, 7, 1.5, skin.sole)

    # ---------------- back arm
    ab = math.radians(pose.arm_back)
    elbow_b = (sh[0] - 3.0 - math.sin(ab) * 3, sh[1] + 4.0)
    hand_b = (elbow_b[0] - 1.5, elbow_b[1] + 4.5)
    limb(d, sh[0] - 1, sh[1] + 0.5, elbow_b[0], elbow_b[1], 4.5, skin.outfit_dark)
    limb(d, elbow_b[0], elbow_b[1], hand_b[0], hand_b[1], 4.5, skin.outfit_dark)
    ellipse(d, hand_b[0], hand_b[1] + 0.5, 2.2, 2.2, BLACK)

    # ---------------- torso: wide baggy block, flared hem
    tw = 13.5
    torso = [
        (sh[0] - tw / 2 + 0.5, sh[1] - 1),
        (sh[0] + tw / 2 - 0.5, sh[1] - 1),
        (sh[0] + tw / 2 + 1, sh[1] + torso_h * 0.55),
        (hip[0] + tw / 2 + 1.5, hip[1] + 2),
        (hip[0] - tw / 2 - 1.5, hip[1] + 2),
        (sh[0] - tw / 2 - 1, sh[1] + torso_h * 0.55),
    ]
    poly(d, torso, skin.outfit)
    # fabric shading down the trailing side + a hem band
    poly(d, [
        (sh[0] - tw / 2 + 0.5, sh[1] + 1),
        (sh[0] - tw / 2 + 4.5, sh[1] + 1),
        (hip[0] - tw / 2 + 3.5, hip[1] + 2),
        (hip[0] - tw / 2 - 1.5, hip[1] + 2),
    ], skin.outfit_dark)
    rect(d, hip[0] - tw / 2 - 1.5, hip[1] + 0.5, tw + 3, 1.6, skin.outfit_dark)

    if skin.fur_collar:
        # cream zig-zag collar, 3-4 px tall (brief sprite note)
        for i in range(8):
            cx = sh[0] - tw / 2 + 1 + i * 1.9
            rect(d, cx, sh[1] - 2.5 + (i % 2) * 1.4, 2.2, 3.4, hx("#d9a868"))
        rect(d, sh[0] - tw / 2, sh[1] - 3, tw, 1.4, hx("#9c6f58"))
    if skin.id == "prism":
        # 1-px rainbow piping plus the chest chevron
        for i, c in enumerate(("#12d4e0", "#5a7f64", "#e8a93a", "#e0245e")):
            rect(d, sh[0] - 6 + i * 3, sh[1] + 2, 3, 1, hx(c))
        rect(d, sh[0] - 4, sh[1] + 3, 8, 1, hx("#12d4e0"))
        rect(d, sh[0] - 2, sh[1] + 4, 4, 1, hx("#e8a93a"))
        rect(d, sh[0] - 6.5, sh[1] + 1, 1, torso_h, hx("#e0245e"))
    if skin.id == "brass":
        rect(d, sh[0] - 1.5, sh[1] + 1, 3, torso_h - 1, hx("#502120"))
        rect(d, sh[0] - 0.5, sh[1] + 1, 1, torso_h - 1, hx("#c79a5b"))
    if skin.id == "loop":
        # puffer quilting: horizontal seams
        for k in range(3):
            yy = sh[1] + 2.5 + k * 3.2
            rect(d, sh[0] - tw / 2 + 1, yy, tw - 2, 0.9, skin.outfit_dark)
        rect(d, sh[0] - 1.5, sh[1] + 0.5, 3, torso_h - 1, hx("#131629"))
    if skin.id == "riff":
        rect(d, sh[0] - tw / 2 + 1, sh[1] + 5, tw - 2, 1.2, skin.outfit_dark)

    # Carve a transparent 1-px channel between the two legs. Without this the pants merge into
    # one blob whenever the stance widens (frames 6-8 of the idle loop).
    carve_x = int(round(hip[0]))
    pxmap = img.load()
    for y in range(int(hip[1]) - 2, int(FOOT_Y) + 1):
        for x in (carve_x, carve_x + 1):
            if 0 <= x < CELL and 0 <= y < CELL:
                pxmap[x, y] = (0, 0, 0, 0)

    # ---------------- front leg (drawn back on top of the carved channel's right side)
    knee_f = ((hip[0] + f_front[0]) / 2 + 0.5, (hip[1] + f_front[1]) / 2 + 1)
    front_pants = SKIN_LIGHT(skin)
    limb(d, hip[0] + 1.5, hip[1] - 1, knee_f[0], knee_f[1], 5.5, front_pants)
    limb(d, knee_f[0], knee_f[1], f_front[0], f_front[1] - 2, 5, front_pants)
    # dark seam down the inner edge of the front leg
    limb(d, hip[0] + 2.0, hip[1] + 1, knee_f[0] - 1, knee_f[1] + 1, 2, SKIN_SEAM(skin))
    rect(d, knee_f[0] - 1.5, knee_f[1], 1, 4.5, skin.pants_dark)        # fold line
    rect(d, f_front[0] - 4, f_front[1] - 2, 8, 4, skin.shoe)
    rect(d, f_front[0] - 4, f_front[1] + 2, 8, 1.6, skin.sole)
    if skin.id == "prism":
        rect(d, knee_f[0] - 1, knee_f[1] - 2, 1, 6, hx("#12d4e0"))

    # ---------------- head: large solid black silhouette
    cx, cy = hc
    ellipse(d, cx, cy, head_r, head_r * 0.94, BLACK)
    # a soft inner shadow so the head is not a flat hole
    ellipse(d, cx - head_r * 0.35, cy + head_r * 0.25, head_r * 0.5, head_r * 0.45, SHADOW)

    ey = cy - head_r * 0.15

    # ---------------- ears (drawn before headgear, above the head)
    e = skin.ears
    top = cy - head_r * 0.75

    def ear_fill(pts, inner=None):
        poly(d, pts, BLACK)
        if inner:
            poly(d, inner, skin.ear_inner or BLACK)

    # Two distinct ears with a clear gap between them: a notch in the middle keeps the
    # silhouette reading as "cat" instead of one spiky crown/mohawk.
    if e == "spiky":
        # RIFF: wide, jagged, upright; the outer spike of each ear is the tallest
        ear_fill([(cx - 9.5, top + 3), (cx - 13.5, top - 9), (cx - 7.5, top - 5), (cx - 4.5, top + 2)])
        ear_fill([(cx - 4.5, top - 3), (cx - 2.5, top - 7), (cx + 1.5, top - 3)])
        ear_fill([(cx + 4.5, top + 2), (cx + 7.5, top - 6), (cx + 12, top - 9), (cx + 11, top + 3)])
    elif e == "tall_round":
        ear_fill([(cx - 9, top + 2), (cx - 11.5, top - 7), (cx - 6, top - 6), (cx - 2.5, top - 1)],
                 [(cx - 8.5, top - 1), (cx - 9.5, top - 7), (cx - 4.5, top - 3)])
        ear_fill([(cx + 2.5, top - 1), (cx + 6, top - 6), (cx + 11.5, top - 7), (cx + 9, top + 2)],
                 [(cx + 4.5, top - 3), (cx + 9.5, top - 7), (cx + 8.5, top - 1)])
    elif e == "tall_point":
        ear_fill([(cx - 9, top + 2), (cx - 11, top - 9), (cx - 6, top - 5), (cx - 2.5, top - 1)],
                 [(cx - 8.5, top - 2), (cx - 9, top - 9), (cx - 5, top - 4)])
        ear_fill([(cx + 2.5, top - 1), (cx + 6, top - 5), (cx + 11, top - 9), (cx + 9, top + 2)],
                 [(cx + 4.5, top - 4), (cx + 9, top - 9), (cx + 8.5, top - 2)])
    else:  # point (LOOP): the left ear leans outward
        ear_fill([(cx - 10.5, top + 1), (cx - 9, top - 8), (cx - 4, top - 4), (cx - 2.5, top - 1)],
                 [(cx - 9, top - 1), (cx - 8.5, top - 7), (cx - 5, top - 3)])
        ear_fill([(cx + 2.5, top - 1), (cx + 5.5, top - 8), (cx + 10, top - 7), (cx + 9.5, top + 2)],
                 [(cx + 4.5, top - 2), (cx + 8, top - 7), (cx + 8.5, top - 1)])

    # ---------------- eyes / headgear
    if skin.headgear == "visor":
        # 2-3 px tall rainbow strip across the face, white crescent underneath
        cols = ("#12d4e0", "#5a7f64", "#e8a93a", "#e0245e")
        for i, c in enumerate(cols):
            rect(d, cx - head_r + 1.5 + i * (head_r / 2), ey - 2.5, head_r / 2 + 0.6, 3, hx(c))
        rect(d, cx - 4, ey + 0.5, 4, 1.6, WHITE)
        rect(d, cx + 1, ey + 0.5, 4, 1.6, WHITE)
    else:
        # white half-lidded crescent eyes: a bright block with a shadowed lower lid
        for ex in (-4.6, 1.6):
            rect(d, cx + ex, ey - 1.5, 4, 3, WHITE)
            rect(d, cx + ex, ey + 1.4, 4, 1.2, SHADOW)
        if skin.headgear == "goggles":
            for gx in (-5, 2.5):
                ellipse(d, cx + gx + 1.4, ey + 0.4, 4.0, 3.8, hx("#502120"))
                ellipse(d, cx + gx + 1.4, ey + 0.4, 3.1, 2.9, skin.accent)
                rect(d, cx + gx - 0.4, ey - 1.4, 1.6, 1.6, hx("#f9c588"))
            rect(d, cx - head_r, cy - head_r * 0.85, head_r * 2, 1.6, hx("#c79a5b"))
        elif skin.headgear == "glasses":
            for gx in (-5, 2.5):
                d.rectangle([round(cx + gx) - 3, round(ey) - 3, round(cx + gx) + 3, round(ey) + 3],
                            outline=WHITE + (255,), width=1)

    if skin.headgear == "headphones":
        # Band sits LOW on the crown so it does not compete with the ears.
        rect(d, cx - head_r - 1, cy - head_r * 0.45, head_r * 2 + 2, 2, skin.accent)
        rect(d, cx - head_r - 1, cy - head_r * 0.45 + 2, head_r * 2 + 2, 1, skin.accent_dark)
        for side in (-1, 1):
            ex = cx + side * (head_r + 1.5)
            rect(d, ex - 2.5, cy - 4, 5, 7.5, skin.accent)
            rect(d, ex - 2.5, cy - 4, 1.5, 7.5, skin.accent_dark)
        rect(d, cx + head_r + 3, cy + 1, 1.4, 9, skin.accent_dark)
    elif skin.headgear == "glasses":
        # teal cups + silver arm (LOOP)
        rect(d, cx - head_r - 1, cy - head_r * 0.45, head_r * 2 + 2, 2, skin.accent)
        for side in (-1, 1):
            ex = cx + side * (head_r + 1.5)
            rect(d, ex - 2.5, cy - 4, 5, 7, skin.accent)
            rect(d, ex - 2.5, cy - 4, 1.4, 7, hx("#a28c89"))
        rect(d, cx + head_r + 3, cy + 2, 1.3, 8, hx("#131629"))
    elif skin.headgear == "visor":
        rect(d, cx - head_r - 2, cy - 3, 4, 6, hx("#a28c89"))
        ellipse(d, cx - head_r - 2, cy, 2.6, 3.2, hx("#a28c89"))

    # ---------------- front arm (over the torso) + grab poses
    if pose.grab in ("indy", "melon"):
        elbow_f = (sh[0] + 4, sh[1] + 5)
        hand_f = (hip[0] + 2, hip[1] + 1)
    elif pose.grab in ("stalefish", "mute"):
        elbow_f = (sh[0] + 5, sh[1] + 4)
        hand_f = (hip[0] - 5, hip[1] - 4)
    elif pose.grab == "method":
        elbow_f = (sh[0] + 6, sh[1] + 2)
        hand_f = (hip[0] - 2, hip[1] + 1)
    else:
        af = math.radians(pose.arm_front)
        elbow_f = (sh[0] + 2.5 + math.sin(af) * 2.5, sh[1] + 5)
        hand_f = (elbow_f[0] + 2.5, elbow_f[1] + 5)
    limb(d, sh[0] + 1, sh[1] + 0.5, elbow_f[0], elbow_f[1], 5, skin.outfit)
    limb(d, elbow_f[0], elbow_f[1], hand_f[0], hand_f[1], 5, skin.outfit)
    # outline the arm's outer edge so it reads against the torso
    limb(d, sh[0] + 1.5, sh[1] + 2.5, elbow_f[0] - 1, elbow_f[1] + 1, 1.4, skin.outfit_dark)
    ellipse(d, hand_f[0], hand_f[1] + 0.5, 2.4, 2.4, BLACK)

    # ---------------- idle prop in the front hand
    if pose.prop_visible:
        px_, py_ = hand_f[0] + 1.5, hand_f[1] - 1
        if skin.prop == "handheld":
            rect(d, px_ - 2.5, py_ - 3.5, 6, 7, skin.accent_dark)
            rect(d, px_ - 1, py_ - 2.5, 3.5, 2.5, hx("#c8f0a0"))
            rect(d, px_ - 1, py_ + 1, 3.5, 1.5, hx("#53514a"))
        elif skin.prop == "notebook":
            rect(d, px_ - 2.5, py_ - 3, 6, 6, hx("#bb9a68"))
            rect(d, px_ - 1.5, py_ - 2, 4, 4, hx("#f4f0e8"))
            rect(d, px_ + 0.5, py_ - 3, 1, 6, hx("#643522"))
        elif skin.prop == "cdplayer":
            rect(d, px_ - 2.5, py_ - 2, 6, 5, hx("#95847a"))
            ellipse(d, px_ - 0.5, py_ + 0.5, 1.6, 1.6, hx("#53514a"))
            rect(d, px_ + 3, py_ - 1, 1.2, 4, hx("#131629"))

    # ---------------- rim light (one side, warm or cool per character)
    rim = skin.rim
    px = img.load()
    for y in range(CELL):
        for x in range(1, CELL):
            if px[x, y][3] > 0 and px[x - 1, y][3] == 0 and (x + y) % 4 != 3:
                px[x, y] = rim + (255,)
    for x in range(CELL):
        for y in range(1, CELL):
            if px[x, y][3] > 0 and px[x, y - 1][3] == 0 and (x * 7 + y) % 3 != 0:
                px[x, y] = rim + (255,)

    # ---------------- 1-px dark outline around the whole silhouette
    out = img.copy()
    po = out.load()
    for y in range(CELL):
        for x in range(CELL):
            if px[x, y][3] > 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < CELL and 0 <= ny < CELL and px[nx, ny][3] > 0:
                    po[x, y] = OUTLINE + (255,)
                    break

    if facing < 0:
        out = out.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return out


# ---------------------------------------------------------------- animation table
def A(**kw) -> Pose:
    return Pose(**kw)


ANIMS: dict[str, tuple[int, float, bool, list[Pose]]] = {
    # name: (frames, fps, loop, poses)
    "idle": (4, 6, True, [
        A(crouch=0.10, lean=4, prop_visible=True, arm_front=-8, leg_spread=0),
        A(crouch=0.22, lean=7, prop_visible=True, arm_front=4, leg_spread=1.5),
        A(crouch=0.30, lean=9, prop_visible=True, arm_front=8, leg_spread=2.5),
        A(crouch=0.20, lean=6, prop_visible=True, arm_front=2, leg_spread=1),
    ]),
    "push": (6, 10, True, [
        A(crouch=0.45, lean=14, arm_front=-20, leg_spread=3),
        A(crouch=0.30, lean=18, arm_front=10, leg_spread=5),
        A(crouch=0.15, lean=16, arm_front=30, leg_spread=2),
        A(crouch=0.30, lean=12, arm_front=0, leg_spread=-2),
        A(crouch=0.45, lean=10, arm_front=-25, leg_spread=1),
        A(crouch=0.35, lean=12, arm_front=-10, leg_spread=3),
    ]),
    "roll": (2, 6, True, [
        A(crouch=0.35, lean=10, arm_front=-15),
        A(crouch=0.38, lean=10, arm_front=-18),
    ]),
    "brake": (3, 8, True, [
        A(crouch=0.55, lean=-16, arm_front=25, leg_spread=6),
        A(crouch=0.60, lean=-20, arm_front=30, leg_spread=7),
        A(crouch=0.55, lean=-14, arm_front=22, leg_spread=5),
    ]),
    "turn": (3, 10, False, [
        A(crouch=0.40, lean=8, arm_front=5),
        A(crouch=0.35, lean=0, arm_front=-5),
        A(crouch=0.40, lean=-8, arm_front=-10),
    ]),
    "land": (3, 12, False, [
        A(crouch=0.75, lean=16, arm_front=15, leg_spread=6),
        A(crouch=0.45, lean=10, arm_front=8, leg_spread=3),
        A(crouch=0.25, lean=7, arm_front=0, leg_spread=1),
    ]),
    "ollie": (3, 14, False, [
        A(crouch=0.85, lean=20, arm_front=20, board_angle=-12),
        A(crouch=0.50, lean=14, arm_front=30, board_angle=-18),
        A(crouch=0.20, lean=8, arm_front=35, board_angle=-6),
    ]),
    "air": (3, 8, True, [
        A(crouch=0.30, lean=4, arm_front=25, arm_back=15, leg_spread=4),
        A(crouch=0.35, lean=2, arm_front=30, arm_back=18, leg_spread=5),
        A(crouch=0.30, lean=6, arm_front=24, arm_back=12, leg_spread=4),
    ]),
    "flip": (6, 18, False, [
        A(crouch=0.55, lean=12, arm_front=25, arm_back=20, board_angle=0),
        A(crouch=0.50, lean=10, arm_front=28, arm_back=22, board_angle=30),
        A(crouch=0.45, lean=8, arm_front=30, arm_back=25, board_angle=70),
        A(crouch=0.45, lean=8, arm_front=30, arm_back=25, board_angle=110),
        A(crouch=0.50, lean=10, arm_front=28, arm_back=22, board_angle=150),
        A(crouch=0.55, lean=12, arm_front=25, arm_back=20, board_angle=0),
    ]),
    "grab_indy": (3, 10, False, [
        A(crouch=0.60, lean=16, grab="indy", arm_back=30, leg_spread=5),
        A(crouch=0.65, lean=18, grab="indy", arm_back=32, leg_spread=6),
        A(crouch=0.60, lean=14, grab="indy", arm_back=28, leg_spread=5),
    ]),
    "grab_melon": (3, 10, False, [
        A(crouch=0.55, lean=14, grab="melon", arm_back=35, leg_spread=4),
        A(crouch=0.62, lean=16, grab="melon", arm_back=38, leg_spread=5),
        A(crouch=0.55, lean=13, grab="melon", arm_back=32, leg_spread=4),
    ]),
    "grab_method": (3, 10, False, [
        A(crouch=0.50, lean=20, grab="method", arm_back=40, leg_spread=3),
        A(crouch=0.58, lean=24, grab="method", arm_back=45, leg_spread=4),
        A(crouch=0.50, lean=18, grab="method", arm_back=38, leg_spread=3),
    ]),
    "grind": (2, 8, True, [
        A(crouch=0.40, lean=6, arm_front=35, arm_back=25, leg_spread=5),
        A(crouch=0.44, lean=4, arm_front=32, arm_back=28, leg_spread=6),
    ]),
    "grind_wobble_l": (1, 8, False, [A(crouch=0.40, lean=-8, arm_front=45, arm_back=10, leg_spread=6)]),
    "grind_wobble_r": (1, 8, False, [A(crouch=0.40, lean=14, arm_front=20, arm_back=40, leg_spread=6)]),
    "manual": (2, 8, True, [
        A(crouch=0.30, lean=-12, arm_front=-25, arm_back=30, board_angle=-14, leg_spread=4),
        A(crouch=0.32, lean=-14, arm_front=-28, arm_back=32, board_angle=-16, leg_spread=4),
    ]),
    "nose_manual": (2, 8, True, [
        A(crouch=0.30, lean=14, arm_front=25, arm_back=-20, board_angle=14, leg_spread=4),
        A(crouch=0.32, lean=16, arm_front=28, arm_back=-22, board_angle=16, leg_spread=4),
    ]),
    "bail_slam": (5, 14, False, [
        A(crouch=0.60, lean=-25, arm_front=50, arm_back=50, board_angle=40, leg_spread=8),
        A(crouch=0.90, lean=-60, arm_front=70, arm_back=70, board_angle=90, leg_spread=12),
        A(crouch=1.00, lean=-80, arm_front=80, arm_back=80, board_angle=140, leg_spread=14, board_visible=False),
        A(crouch=1.00, lean=-90, arm_front=85, arm_back=85, board_angle=170, leg_spread=14, board_visible=False),
        A(crouch=1.00, lean=-90, arm_front=80, arm_back=80, board_angle=180, leg_spread=12, board_visible=False),
    ]),
    "getup": (6, 10, False, [
        A(crouch=1.00, lean=-70, arm_front=60, arm_back=60, board_visible=False, leg_spread=10),
        A(crouch=0.95, lean=-50, arm_front=45, arm_back=40, board_visible=False, leg_spread=9),
        A(crouch=0.80, lean=-30, arm_front=30, arm_back=25, leg_spread=7),
        A(crouch=0.60, lean=-12, arm_front=15, arm_back=10, leg_spread=5),
        A(crouch=0.40, lean=4, arm_front=5, arm_back=4, leg_spread=3),
        A(crouch=0.22, lean=6, arm_front=0, arm_back=0, leg_spread=1),
    ]),
    "special": (8, 14, False, [
        A(crouch=0.80, lean=22, arm_front=30, board_angle=-15, leg_spread=6),
        A(crouch=0.40, lean=10, arm_front=60, arm_back=40, board_angle=-30, leg_spread=8),
        A(crouch=0.30, lean=0, arm_front=80, arm_back=70, board_angle=-60, leg_spread=10, body_rot=90),
        A(crouch=0.30, lean=0, arm_front=85, arm_back=85, board_angle=-90, leg_spread=12, body_rot=180),
        A(crouch=0.30, lean=0, arm_front=85, arm_back=85, board_angle=-120, leg_spread=12, body_rot=270),
        A(crouch=0.30, lean=0, arm_front=80, arm_back=70, board_angle=-150, leg_spread=10, body_rot=360),
        A(crouch=0.55, lean=12, arm_front=40, board_angle=-20, leg_spread=7),
        A(crouch=0.30, lean=8, arm_front=15, leg_spread=3),
    ]),
    "victory": (4, 8, False, [
        A(crouch=0.20, lean=4, arm_front=70, arm_back=20),
        A(crouch=0.15, lean=2, arm_front=85, arm_back=25),
        A(crouch=0.20, lean=4, arm_front=80, arm_back=22),
        A(crouch=0.25, lean=6, arm_front=60, arm_back=15),
    ]),
}


def board_strip() -> Image.Image:
    """Board-only flip strip (6 frames of the deck spinning)."""
    sheet = Image.new("RGBA", (CELL * 6, CELL), (0, 0, 0, 0))
    for i in range(6):
        img = blank()
        d = ImageDraw.Draw(img)
        ang = math.radians(i * 30)
        cx, cy = 32, 44
        dx, dy = math.cos(ang), math.sin(ang)
        nx, ny = -dy, dx
        poly(d, [
            (cx - dx * 12.5 + nx * 1.8, cy - dy * 12.5 + ny * 1.8),
            (cx + dx * 12.5 + nx * 1.8, cy + dy * 12.5 + ny * 1.8),
            (cx + dx * 12.5 - nx * 1.8, cy + dy * 12.5 - ny * 1.8),
            (cx - dx * 12.5 - nx * 1.8, cy - dy * 12.5 - ny * 1.8),
        ], hx("#5c0d11"))
        for t in (-7, 7):
            ellipse(d, cx + dx * t, cy + dy * t + 2, 1.6, 1.6, hx("#adb18c"))
        sheet.alpha_composite(img, (i * CELL, 0))
    return sheet


def fx_strip() -> Image.Image:
    """16x16 particles in one row: dust(3), spark(3), ring(3), streak(2)."""
    n = 11
    sheet = Image.new("RGBA", (16 * n, 16), (0, 0, 0, 0))
    frames = []
    for i in range(3):  # dust puffs
        img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        r = 2 + i * 2
        for dx, dy in ((-r, 0), (r, 1), (0, -r + 1)):
            ellipse(d, 8 + dx, 10 + dy, max(1, 3 - i * 0.5), max(1, 3 - i * 0.5), hx("#adb18c"))
        frames.append(img)
    for i in range(3):  # grind sparks
        img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        for k in range(4):
            x = 3 + ((i * 3 + k * 4) % 11)
            y = 12 - k * 2 - i
            rect(d, x, y, 2, 1, hx("#f9c588") if k % 2 else hx("#e8a93a"))
        frames.append(img)
    for i in range(3):  # landing ring
        img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        r = 3 + i * 2
        d.ellipse([8 - r, 10 - r // 2, 8 + r, 10 + r // 2], outline=hx("#f9c588") + (200 - i * 60,), width=1)
        frames.append(img)
    for i in range(2):  # speed streaks
        img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        rect(d, 0 + i, 6 + i * 3, 12 - i * 3, 1, hx("#c8f0a0") + (180,))
        rect(d, 2 + i, 9 + i * 2, 8, 1, hx("#f9c588") + (120,))
        frames.append(img)
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, (i * 16, 0))
    return sheet


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for sid, skin in SKINS.items():
        rows = list(ANIMS.items())
        sheet = Image.new("RGBA", (CELL * max(a[1][0] for a in rows), CELL * len(rows)), (0, 0, 0, 0))
        atlas = {}
        for r, (name, (frames, fps, loop, poses)) in enumerate(rows):
            for c in range(frames):
                pose = poses[min(c, len(poses) - 1)]
                sheet.alpha_composite(skater_frame(skin, pose), (c * CELL, r * CELL))
            atlas[name] = {"row": r, "frames": frames, "fps": fps, "loop": loop}
        sheet.save(OUT / f"skater_{sid}.png")
        (OUT / f"skater_{sid}.json").write_text(json.dumps({"cell": CELL, "anims": atlas}, indent=2))
        print("wrote skater", sid, sheet.size)
    board_strip().save(OUT / "board.png")
    fx_strip().save(OUT / "fx.png")
    print("wrote board.png fx.png")


if __name__ == "__main__":
    main()
