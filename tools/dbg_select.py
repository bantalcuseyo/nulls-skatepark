"""Debug the character-select cursor: prints idx + the character actually launched."""
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
        pg.goto(URL, wait_until="networkidle")
        pg.wait_for_timeout(1600)
        title = pg.evaluate("() => { const s = window.__phaserGame.scene.getScene('Title'); return {screen: s.screen, idx: s.idx, items: s.items.map(i=>i.id)}; }")
        print("title:", title)
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(600)
        print("after enter:", pg.evaluate("() => { const s = window.__phaserGame.scene.getScene('Title'); return {screen: s.screen, idx: s.idx, sel: s.selectedChar, items: s.items.map(i=>i.id)}; }"))
        pg.keyboard.press("ArrowDown")
        pg.wait_for_timeout(200)
        print("after 1 down:", pg.evaluate("() => { const s = window.__phaserGame.scene.getScene('Title'); return {idx: s.idx, items: s.items.map(i=>i.id)}; }"))
        pg.keyboard.press("ArrowDown")
        pg.wait_for_timeout(200)
        print("after 2 down:", pg.evaluate("() => { const s = window.__phaserGame.scene.getScene('Title'); return {idx: s.idx, items: s.items.map(i=>i.id)}; }"))
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(600)
        print("after confirm:", pg.evaluate("() => { const s = window.__phaserGame.scene.getScene('Title'); return {screen: s.screen, idx: s.idx, sel: s.selectedChar}; }"))
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(1500)
        print("game:", pg.evaluate("() => window.__game && window.__game.characterId"))
        b.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
