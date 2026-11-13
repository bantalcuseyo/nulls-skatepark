"""Screenshot harness: drives the real game in Chromium and writes PNGs to docs/qa/.

Usage: python3 tools/shoot.py <outdir> [--char riff] [--level subway]
Every shot is taken from the actual WebGL canvas, never mocked.
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:5199/"
# Playwright's bundled browsers are not installed on this VPS; use the system Chromium.
EXE = "/usr/bin/chromium-browser"


def main() -> int:
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "docs/qa")
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(
            executable_path=EXE,
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
        )
        pg = b.new_page(viewport={"width": 960, "height": 540}, device_scale_factor=2)
        logs = []
        pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
        pg.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}"))
        pg.goto(URL, wait_until="networkidle")
        pg.wait_for_timeout(2500)
        pg.screenshot(path=str(out / "00_title.png"))

        # choose CAREER -> char select
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(900)
        pg.screenshot(path=str(out / "01_charsel.png"))

        # walk the character list down to each entry and shoot the panel
        for i, name in enumerate(["riff", "prism", "brass", "loop"]):
            for _ in range(i):
                pg.keyboard.press("ArrowDown")
                pg.wait_for_timeout(200)
            pg.screenshot(path=str(out / f"02_charsel_{name}.png"))
            pg.keyboard.press("ArrowUp")
            pg.wait_for_timeout(150)
            for _ in range(i):
                pg.keyboard.press("ArrowDown")
                pg.wait_for_timeout(120)

        # enter a run with the currently highlighted character
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(1200)
        pg.screenshot(path=str(out / "03_levelsel.png"))
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(2200)
        pg.screenshot(path=str(out / "04_game_idle.png"))

        # hold right to get rolling, then ollie
        pg.keyboard.down("ArrowRight")
        pg.wait_for_timeout(1400)
        pg.screenshot(path=str(out / "05_game_rolling.png"))
        pg.keyboard.press("Space")
        pg.wait_for_timeout(320)
        pg.screenshot(path=str(out / "06_game_air.png"))
        pg.keyboard.up("ArrowRight")
        pg.wait_for_timeout(600)

        # runtime audit: any element that reports overlapping labels, plus canvas stats
        info = pg.evaluate("""() => ({
          overlaps: window.__uiOverlaps || [],
          w: document.querySelector('canvas')?.width,
          h: document.querySelector('canvas')?.height,
        })""")
        b.close()

    print("shots ->", out)
    print("canvas:", info.get("w"), "x", info.get("h"))
    print("overlaps:", info.get("overlaps"))
    errs = [l for l in logs if l.startswith(("PAGEERROR", "error"))]
    print("errors:", errs[:10])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
