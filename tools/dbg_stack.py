"""Print the full stack of the pause-resume exception."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:5199/?unlock=all"
EXE = "/usr/bin/chromium-browser"


def main() -> int:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE, args=["--use-gl=angle", "--use-angle=swiftshader",
                                                         "--enable-unsafe-swiftshader", "--no-sandbox"])
        pg = b.new_page(viewport={"width": 960, "height": 540})
        pg.on("pageerror", lambda e: print("STACK:", e.stack))
        pg.goto(URL, wait_until="networkidle")
        pg.wait_for_timeout(1600)
        pg.evaluate("""() => { const g = window.__phaserGame; g.scene.stop('Title');
            g.scene.start('Game', {levelId:'subway', characterId:'riff', freeSkate:false}); }""")
        pg.wait_for_timeout(1400)
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(400)
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(900)
        b.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
