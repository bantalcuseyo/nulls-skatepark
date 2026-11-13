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


SKINS: dict[str, Skin] = {
    "riff": Skin(
        id="riff",
        outfit=hx("#e9ad76"), outfit_dark=hx("#b88460"),
        pants=hx("#254362"), pants_dark=hx("#1b2238"),
        accent=hx("#d42b2e"), accent_dark=hx("#5c0d11"),
        shoe=hx("#1b2238"), sole=hx("#adb18c"),
        rim=hx("#d42b2e"), ear_inner=None,
        headgear="headphones", ears="spiky", prop="handheld",
    ),
    "prism": Skin(
        id="prism",
        outfit=hx("#1c1228"), outfit_dark=hx("#130e20"),
        pants=hx("#130e20"), pants_dark=hx("#0b0715"),
        accent=hx("#12d4e0"), accent_dark=hx("#203270"),
        shoe=hx("#a28c89"), sole=hx("#53514a"),
        rim=hx("#e0245e"), ear_inner=hx("#d8956e"),
        headgear="visor", ears="tall_round", prop="handheld",
    ),
    "brass": Skin(
        id="brass",
        outfit=hx("#643522"), outfit_dark=hx("#502120"),
        pants=hx("#5b5a53"), pants_dark=hx("#3e3134"),
        accent=hx("#ed8445"), accent_dark=hx("#b8642a"),
        shoe=hx("#502120"), sole=hx("#d9a868"),
        rim=hx("#e8a93a"), ear_inner=hx("#9c6f58"),
        headgear="goggles", ears="tall_point", prop="notebook", fur_collar=True,
    ),
    "loop": Skin(
        id="loop",
        outfit=hx("#182b28"), outfit_dark=hx("#0d1c23"),
        pants=hx("#213047"), pants_dark=hx("#131629"),
        accent=hx("#183337"), accent_dark=hx("#66536b"),
        shoe=hx("#131629"), sole=hx("#53514a"),
        rim=hx("#b8642a"), ear_inner=hx("#66536b"),
        headgear="glasses", ears="point", prop="cdplayer",
    ),
}


# ---------------------------------------------------------------- tiny raster helpers
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
    """Render one 64x64 cell. Facing 1 = right, -1 = left (mirrored at the end)."""
    img = blank()
    d = ImageDraw.Draw(img)

    # Body frame: feet at (32, 56), scaled by crouch.
    foot_y = 56.0
    hip_h = 15.0 - 6.0 * pose.crouch
    shoulder_h = 13.0 - 2.0 * pose.crouch
    head_h = 11.0
    hip = (32.0, foot_y - hip_h - 3.0)
    lean_rad = math.radians(pose.lean)
    sh = (hip[0] + math.sin(lean_rad) * shoulder_h, hip[1] - math.cos(lean_rad) * shoulder_h)
    head = (sh[0] + math.sin(lean_rad) * head_h * 0.8, sh[1] - math.cos(lean_rad) * head_h * 0.8)

    spread = 4.0 + pose.leg_spread
    # Feet positions (front foot toward facing).
    f_front = (hip[0] + spread * 0.9, foot_y)
    f_back = (hip[0] - spread * 0.7, foot_y)

    # ---- board
    if pose.board_visible:
        ba = math.radians(pose.board_angle)
        by = foot_y + 2
        bx = hip[0]
        dx, dy = math.cos(ba), math.sin(ba)
        nx, ny = -dy, dx
        deck = [
            (bx - dx * 13 + nx * 1.5, by - dy * 13 + ny * 1.5),
            (bx + dx * 13 + nx * 1.5, by + dy * 13 + ny * 1.5),
            (bx + dx * 13 - nx * 1.5, by + dy * 13 - ny * 1.5),
            (bx - dx * 13 - nx * 1.5, by - dy * 13 - ny * 1.5),
        ]
        poly(d, deck, skin.accent_dark if skin.id != "brass" else hx("#c79a5b"))
        # trucks + wheels
        for t in (-7, 7):
            wx, wy = bx + dx * t, by + dy * t + 2
            rect(d, wx - 1.5, wy, 3, 2, hx("#53514a"))
            ellipse(d, wx, wy + 3, 1.6, 1.6, hx("#adb18c"))

    # ---- back leg (darker, one px offset)
    knee_b = ((hip[0] + f_back[0]) / 2 - 1, (hip[1] + f_back[1]) / 2)
    limb(d, hip[0] + 1, hip[1], knee_b[0], knee_b[1], 7, skin.pants_dark)
    limb(d, knee_b[0], knee_b[1], f_back[0], f_back[1] - 2, 6, skin.pants_dark)
    rect(d, f_back[0] - 3, f_back[1] - 2, 7, 3, skin.shoe)
    rect(d, f_back[0] - 3, f_back[1] + 1, 7, 1.5, skin.sole)

    # ---- back arm
    ba_rad = math.radians(180 - pose.arm_back)
    elbow_b = (sh[0] + math.cos(ba_rad) * 5 - 1, sh[1] + abs(math.sin(ba_rad)) * -5 + 4)
    hand_b = (elbow_b[0] - 3, elbow_b[1] + 4)
    limb(d, sh[0] - 1, sh[1] + 1, elbow_b[0], elbow_b[1], 4, skin.outfit_dark)
    limb(d, elbow_b[0], elbow_b[1], hand_b[0], hand_b[1], 4, skin.outfit_dark)
    ellipse(d, hand_b[0], hand_b[1] + 1, 2, 2, BLACK)

    # ---- torso
    tw = 13.0
    torso = [
        (sh[0] - tw / 2, sh[1] - 1),
        (sh[0] + tw / 2, sh[1] - 1),
        (hip[0] + tw / 2 - 1, hip[1] + 2),
        (hip[0] - tw / 2 + 1, hip[1] + 2),
    ]
    poly(d, torso, skin.outfit)
    # sleeve / hem shading
    rect(d, sh[0] - tw / 2, sh[1] + 2, 3, hip_h - 3, skin.outfit_dark)
    if skin.fur_collar:
        for i in range(7):
            cx = sh[0] - tw / 2 + i * 2
            rect(d, cx, sh[1] - 2 + (i % 2), 2, 3, hx("#d9a868"))
    if skin.id == "prism":
        # rainbow chevron + piping
        for i, c in enumerate(("#12d4e0", "#5a7f64", "#e8a93a", "#e0245e")):
            rect(d, sh[0] - 5 + i, sh[1] + 2, 1, 6, hx(c))
        rect(d, sh[0] - tw / 2, hip[1] + 1, tw, 1, hx("#12d4e0"))
    if skin.id == "brass":
        rect(d, sh[0] - 1, sh[1] + 1, 2, hip_h - 2, hx("#502120"))
    if skin.id == "loop":
        rect(d, sh[0] - 1, sh[1] + 1, 2, hip_h, hx("#131629"))
    if skin.id == "riff":
        rect(d, sh[0] - 2, sh[1] + 3, tw - 2, 1, skin.outfit_dark)

    # ---- front leg
    knee_f = ((hip[0] + f_front[0]) / 2 + 1, (hip[1] + f_front[1]) / 2)
    limb(d, hip[0] - 1, hip[1], knee_f[0], knee_f[1], 8, skin.pants)
    limb(d, knee_f[0], knee_f[1], f_front[0], f_front[1] - 2, 7, skin.pants)
    # fold hints
    rect(d, knee_f[0] - 2, knee_f[1] + 1, 1, 4, skin.pants_dark)
    rect(d, f_front[0] - 4, f_front[1] - 2, 8, 3, skin.shoe)
    rect(d, f_front[0] - 4, f_front[1] + 1, 8, 1.5, skin.sole)

    # ---- head
    hx_, hy_ = head
    ellipse(d, hx_, hy_ - 2, 8.5, 7.5, BLACK)
    # eyes: white half-lidded crescents
    ey = hy_ - 3
    if skin.headgear == "visor":
        for i, c in enumerate(("#12d4e0", "#5a7f64", "#e8a93a", "#e0245e")):
            rect(d, hx_ - 7 + i * 4, ey - 1, 4, 2, hx(c))
        rect(d, hx_ - 2, ey, 4, 1, WHITE)
    else:
        rect(d, hx_ - 5, ey, 4, 2, WHITE)
        rect(d, hx_ + 1, ey, 4, 2, WHITE)
        rect(d, hx_ - 5, ey + 2, 3, 1, WHITE)
        rect(d, hx_ + 1, ey + 2, 3, 1, WHITE)

    # ---- ears
    e = skin.ears
    if e == "spiky":
        poly(d, [(hx_ - 8, hy_ - 6), (hx_ - 12, hy_ - 19), (hx_ - 4, hy_ - 10)], BLACK)
        poly(d, [(hx_ + 2, hy_ - 9), (hx_ + 9, hy_ - 21), (hx_ + 8, hy_ - 7)], BLACK)
        poly(d, [(hx_ + 5, hy_ - 9), (hx_ + 7, hy_ - 15), (hx_ + 8, hy_ - 8)], BLACK)
    elif e == "tall_round":
        poly(d, [(hx_ - 8, hy_ - 7), (hx_ - 10, hy_ - 18), (hx_ - 2, hy_ - 9)], BLACK)
        poly(d, [(hx_ + 2, hy_ - 9), (hx_ + 9, hy_ - 18), (hx_ + 8, hy_ - 6)], BLACK)
        if skin.ear_inner:
            poly(d, [(hx_ - 8, hy_ - 9), (hx_ - 9, hy_ - 15), (hx_ - 4, hy_ - 10)], skin.ear_inner)
    elif e == "tall_point":
        poly(d, [(hx_ - 7, hy_ - 7), (hx_ - 9, hy_ - 21), (hx_ - 2, hy_ - 9)], BLACK)
        poly(d, [(hx_ + 2, hy_ - 9), (hx_ + 8, hy_ - 21), (hx_ + 8, hy_ - 7)], BLACK)
        if skin.ear_inner:
            poly(d, [(hx_ - 6, hy_ - 10), (hx_ - 8, hy_ - 17), (hx_ - 4, hy_ - 11)], skin.ear_inner)
            poly(d, [(hx_ + 4, hy_ - 11), (hx_ + 7, hy_ - 17), (hx_ + 7, hy_ - 9)], skin.ear_inner)
    else:  # point
        poly(d, [(hx_ - 7, hy_ - 7), (hx_ - 8, hy_ - 17), (hx_ - 2, hy_ - 9)], BLACK)
        poly(d, [(hx_ + 2, hy_ - 9), (hx_ + 7, hy_ - 17), (hx_ + 8, hy_ - 7)], BLACK)
        if skin.ear_inner:
            rect(d, hx_ - 7, hy_ - 13, 1, 4, skin.ear_inner)
            rect(d, hx_ + 6, hy_ - 13, 1, 4, skin.ear_inner)

    # ---- headgear
    if skin.headgear == "headphones":
        rect(d, hx_ - 9, hy_ - 13, 18, 2, skin.accent)          # band
        rect(d, hx_ - 11, hy_ - 7, 4, 6, skin.accent)           # cups
        rect(d, hx_ + 7, hy_ - 7, 4, 6, skin.accent)
        rect(d, hx_ - 11, hy_ - 7, 1, 6, skin.accent_dark)
        rect(d, hx_ + 7, hy_ - 7, 1, 6, skin.accent_dark)
        rect(d, hx_ + 10, hy_ - 1, 1, 7, skin.accent_dark)      # cord
    elif skin.headgear == "goggles":
        for gx in (-5, 3):
            ellipse(d, hx_ + gx, ey + 1, 3.4, 3.2, skin.accent_dark)
            ellipse(d, hx_ + gx, ey + 1, 2.4, 2.2, skin.accent)
            rect(d, hx_ + gx - 1, ey, 1, 1, hx("#f9c588"))
        rect(d, hx_ - 10, hy_ - 12, 20, 1.5, hx("#c79a5b"))
    elif skin.headgear == "visor":
        rect(d, hx_ - 11, hy_ - 8, 3, 6, hx("#a28c89"))
        ellipse(d, hx_ - 11, hy_ - 4, 2.5, 3, hx("#a28c89"))
    elif skin.headgear == "glasses":
        rect(d, hx_ - 9, hy_ - 12, 17, 1.5, skin.accent)
        rect(d, hx_ - 10, hy_ - 7, 3, 5, skin.accent)
        rect(d, hx_ + 6, hy_ - 7, 3, 5, skin.accent)
        for gx in (-5, 3):
            d.rectangle([round(hx_ + gx) - 3, round(ey) - 2, round(hx_ + gx) + 2, round(ey) + 2],
                        outline=WHITE + (255,))

    # ---- front arm (over torso) + grab poses
    fa_rad = math.radians(-pose.arm_front)
    if pose.grab in ("indy", "melon"):
        elbow_f = (sh[0] + 3, sh[1] + 6)
        hand_f = (hip[0] + 2, hip[1] + 1)
    elif pose.grab in ("stalefish", "mute"):
        elbow_f = (sh[0] + 4, sh[1] + 5)
        hand_f = (hip[0] - 4, hip[1] - 3)
    elif pose.grab == "method":
        elbow_f = (sh[0] + 5, sh[1] + 3)
        hand_f = (hip[0] - 1, hip[1] + 2)
    else:
        elbow_f = (sh[0] + 3 + math.cos(fa_rad) * 2, sh[1] + 5)
        hand_f = (elbow_f[0] + 2, elbow_f[1] + 5)
    limb(d, sh[0] + 1, sh[1] + 1, elbow_f[0], elbow_f[1], 4, skin.outfit)
    limb(d, elbow_f[0], elbow_f[1], hand_f[0], hand_f[1], 4, skin.outfit)
    ellipse(d, hand_f[0], hand_f[1] + 1, 2, 2, BLACK)

    # ---- idle prop in hand
    if pose.prop_visible:
        px_, py_ = hand_f[0] + 1, hand_f[1] - 1
        if skin.prop == "handheld":
            rect(d, px_ - 2, py_ - 3, 5, 6, skin.accent_dark)
            rect(d, px_ - 1, py_ - 2, 3, 2, hx("#c8f0a0"))
        elif skin.prop == "notebook":
            rect(d, px_ - 2, py_ - 3, 5, 5, hx("#bb9a68"))
            rect(d, px_ - 1, py_ - 2, 3, 3, hx("#f4f0e8"))
        elif skin.prop == "cdplayer":
            rect(d, px_ - 2, py_ - 2, 5, 4, hx("#95847a"))
            ellipse(d, px_ - 1, py_, 1.2, 1.2, hx("#53514a"))

    # ---- rim light on the leading (left) edge of the silhouette
    rim = skin.rim
    px = img.load()
    for y in range(CELL):
        for x in range(1, CELL):
            if px[x, y][3] > 0 and px[x - 1, y][3] == 0 and (x + y) % 3 != 2:
                px[x, y] = rim + (255,)
    # top rim on the head
    for x in range(CELL):
        for y in range(1, CELL):
            if px[x, y][3] > 0 and px[x, y - 1][3] == 0 and (x + y) % 4 == 0:
                px[x, y] = rim + (255,)

    # ---- 1px dark outline outside the silhouette
    out = img.copy()
    po = out.load()
    for y in range(CELL):
        for x in range(CELL):
            if px[x, y][3] > 0:
                continue
            near = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < CELL and 0 <= ny < CELL and px[nx, ny][3] > 0:
                    near = True
                    break
            if near:
                po[x, y] = OUTLINE + (255,)

    if facing < 0:
        out = out.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return out


# ---------------------------------------------------------------- animation table
def A(**kw) -> Pose:
    return Pose(**kw)


ANIMS: dict[str, tuple[int, float, bool, list[Pose]]] = {
    # name: (frames, fps, loop, poses)
    "idle": (4, 6, True, [
        A(crouch=0.15, lean=6, prop_visible=True),
        A(crouch=0.18, lean=6, prop_visible=True),
        A(crouch=0.22, lean=7, prop_visible=True),
        A(crouch=0.18, lean=6, prop_visible=True),
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
            (cx - dx * 13 + nx * 1.5, cy - dy * 13 + ny * 1.5),
            (cx + dx * 13 + nx * 1.5, cy + dy * 13 + ny * 1.5),
            (cx + dx * 13 - nx * 1.5, cy + dy * 13 - ny * 1.5),
            (cx - dx * 13 - nx * 1.5, cy - dy * 13 - ny * 1.5),
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
