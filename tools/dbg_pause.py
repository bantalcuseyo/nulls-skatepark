"""Isolate the pause and run-complete behaviour, one keypress at a time."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:5199/?unlock=all"
EXE = "/usr/bin/chromium-browser"


def main() -> int:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE, args=["--use-gl=angle", "--use-angle=swiftshader",
                                                         "--enable-unsafe-swiftshader", "--no-sandbox"])
        pg = b.new_page(viewport={"width": 960, "height": 540})
        pg.on("pageerror", lambda e: print("PAGEERROR", e))
        pg.on("console", lambda m: print("CONSOLE", m.type, m.text) if m.type == "error" else None)
        pg.goto(URL, wait_until="networkidle")
        pg.wait_for_timeout(1600)
        # jump straight into a run to remove menu timing from the test
        pg.evaluate("""() => { const g = window.__phaserGame; g.scene.stop('Title');
            g.scene.start('Game', {levelId:'subway', characterId:'riff', freeSkate:false}); }""")
        pg.wait_for_timeout(1500)

        def snap(label):
            v = pg.evaluate("""() => { const g = window.__game; return {
                paused: g && g.paused, fin: g && g.finished,
                pauseActive: window.__phaserGame.scene.isActive('Pause'),
                results: window.__phaserGame.scene.isActive('Results'),
                gameActive: window.__phaserGame.scene.isActive('Game') }; }""")
            print(label, v)

        snap("start")
        for i in range(1, 5):
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(500)
            snap(f"esc#{i}")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(500)
        snap("esc#5")

        # now expire the clock
        pg.evaluate("() => { if (window.__game) window.__game.timeLeft = 0.05; }")
        pg.wait_for_timeout(2500)
        snap("after clock")
        b.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
