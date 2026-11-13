"""QA harness for the ui-rebuild pass: drives the real game and writes evidence to docs/qa/.

Covers the brief's proof list:
  * character select: every skater must be selectable and launch a run as itself
  * a gameplay screenshot per character (HUD in Figure 1's positions)
  * a mid-trick screenshot per character (face visible / silhouette readable)
  * HEALTH: 4 bails -> 0 -> BAILED OUT -> RETRY works
  * STAMINA: repeated ollies drain, lockout under 15, refills while rolling
  * pause twice -> resume -> finish -> RETRY

Run against the dev server (http://127.0.0.1:5199/) with:
    python3 tools/qa.py
"""
from __future__ import annotations

import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:5199/?unlock=all&profile=desktop"
EXE = "/usr/bin/chromium-browser"
OUT = pathlib.Path(__file__).resolve().parent.parent / "qa"
CHARS = ["riff", "prism", "brass", "loop"]


def state(pg) -> dict:
    return pg.evaluate("""() => {
      const g = window.__game; const s = window.__sim;
      if (!g || !s) return {};
      return {
        char: g.characterId, level: g.currentLevel.id,
        x: Math.round(s.x), y: Math.round(s.y), state: s.state,
        health: Math.round(s.health), stamina: Math.round(s.stamina),
        score: s.score, bails: s.bails, meter: Math.round(s.specialMeter),
        bailedOut: !!s.bailedOut, anim: s.anim,
      };
    }""")


def goto_charsel(pg) -> None:
    """From a fresh page: title -> CAREER -> character select."""
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_timeout(1800)
    pg.keyboard.press("Enter")          # CAREER
    pg.wait_for_timeout(700)


def select_char(pg, index: int) -> None:
    """Move the real cursor to `index` using only arrow keys.

    The list wraps around, so a fixed number of ArrowUp presses lands somewhere unpredictable
    (that is a bug in the old harness, not in the game). Read the live cursor and step toward the
    target instead, which is also what a player does.
    """
    for _ in range(12):
        cur = pg.evaluate("() => window.__phaserGame.scene.getScene('Title').idx")
        if cur == index:
            return
        pg.keyboard.press("ArrowDown" if cur < index else "ArrowUp")
        pg.wait_for_timeout(80)
    raise RuntimeError(f"could not move the character cursor to {index}")


def start_run(pg) -> None:
    pg.keyboard.press("Enter")          # confirm skater -> level select
    pg.wait_for_timeout(600)
    pg.keyboard.press("Enter")          # first level
    pg.wait_for_timeout(1600)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    results: dict[str, object] = {}
    errors: list[str] = []

    with sync_playwright() as p:
        b = p.chromium.launch(
            executable_path=EXE,
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
        )
        pg = b.new_page(viewport={"width": 960, "height": 540}, device_scale_factor=2)
        logs: list[str] = []
        pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
        pg.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}"))

        # ---------------------------------------------------------------- per character
        for i, cid in enumerate(CHARS):
            goto_charsel(pg)
            select_char(pg, i)
            pg.wait_for_timeout(200)
            pg.screenshot(path=str(OUT / f"charsel_{cid}.png"))
            start_run(pg)
            st = state(pg)
            ok = st.get("char") == cid
            results[f"select_{cid}"] = ok
            if not ok:
                errors.append(f"select {cid}: run started as {st.get('char')}")

            pg.screenshot(path=str(OUT / f"gameplay_{cid}_idle.png"))
            # roll forward, then ollie+flip for a mid-trick shot
            pg.keyboard.down("ArrowRight")
            pg.wait_for_timeout(900)
            pg.keyboard.down("Space")
            pg.wait_for_timeout(140)
            pg.keyboard.up("Space")
            pg.keyboard.press("KeyX")
            pg.wait_for_timeout(180)
            pg.screenshot(path=str(OUT / f"gameplay_{cid}_trick.png"))
            pg.keyboard.up("ArrowRight")
            results[f"hud_{cid}"] = state(pg)
            pg.wait_for_timeout(400)

        # ---------------------------------------------------------------- HEALTH: 4 bails -> BAILED OUT
        goto_charsel(pg)
        select_char(pg, 0)
        start_run(pg)
        health_trace = []
        for _ in range(5):
            pg.evaluate("""() => { const s = window.__sim; s.bail('qa'); }""")
            pg.wait_for_timeout(1250)  # let the bail timer run + respawn
            health_trace.append(state(pg).get("health"))
            if state(pg).get("bailedOut"):
                break
        pg.wait_for_timeout(1200)
        pg.screenshot(path=str(OUT / "bailed_out.png"))
        results["health_trace"] = health_trace
        results["bailed_out"] = bool(state(pg).get("bailedOut"))
        results["score_kept"] = state(pg).get("score")

        # RETRY from the BAILED OUT screen
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(1800)
        st_retry = state(pg)
        results["retry_after_bailed_out"] = st_retry.get("health") == 100 and not st_retry.get("bailedOut")
        pg.screenshot(path=str(OUT / "retry_after_bailed_out.png"))

        # ---------------------------------------------------------------- STAMINA
        goto_charsel(pg)
        select_char(pg, 0)
        start_run(pg)
        pg.keyboard.down("ArrowRight")
        pg.wait_for_timeout(500)
        for _ in range(6):
            pg.keyboard.down("Space")
            pg.wait_for_timeout(200)
            pg.keyboard.up("Space")
            pg.wait_for_timeout(260)
        st_low = state(pg)
        results["stamina_after_ollies"] = st_low.get("stamina")
        pg.screenshot(path=str(OUT / "stamina_low.png"))
        # refill by rolling without pushing
        pg.keyboard.up("ArrowRight")
        pg.wait_for_timeout(2200)
        results["stamina_after_roll"] = state(pg).get("stamina")

        # ---------------------------------------------------------------- pause twice, resume, finish, retry
        # Wait for the state to actually change instead of sleeping a fixed 400 ms: the scene
        # transition takes longer than that on a software renderer, which made this block report
        # false negatives even though a hand-driven run paused and resumed cleanly.
        def wait_paused(want: bool) -> bool:
            try:
                pg.wait_for_function(
                    "w => window.__game && window.__game.paused === w", arg=want, timeout=4000)
                # The Pause scene registers its own ESC handler in create(), and Game.togglePause()
                # debounces repeat presses for 250 ms. A human cannot double-tap inside that window
                # (that debounce is what stops one keypress toggling twice); the harness must
                # respect it, so settle past it instead of feeding impossible input.
                pg.wait_for_timeout(340)
                return True
            except Exception:
                return False

        pg.keyboard.press("Escape")
        paused_once = wait_paused(True)
        pg.keyboard.press("Escape")
        resumed = wait_paused(False)
        pg.keyboard.press("Escape")
        paused_twice = wait_paused(True)
        pg.keyboard.press("Escape")
        resumed_twice = wait_paused(False)
        results["pause"] = {"paused_once": paused_once, "resumed": resumed,
                            "paused_twice": paused_twice, "resumed_twice": resumed_twice}

        # Make sure the run is actually live before expiring the clock: a paused Game scene never
        # runs update(), so timeLeft would sit at 0.05 and LOOK like a soft-lock that isn't one.
        for _ in range(6):
            if not pg.evaluate("() => window.__game.paused"):
                break
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(400)

        # run out the clock and confirm RUN COMPLETE appears, then RETRY works
        pg.evaluate("() => { window.__game.timeLeft = 0.05; }")
        try:
            pg.wait_for_function("() => window.__phaserGame.scene.isActive('Results')", timeout=8000)
            results["run_complete"] = True
        except Exception:
            results["run_complete"] = False
        pg.screenshot(path=str(OUT / "run_complete.png"))
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(1800)
        results["retry_after_complete"] = bool(pg.evaluate("() => !!window.__sim && window.__game.scene.isActive('Game') && !window.__game.scene.isActive('Results')"))
        pg.screenshot(path=str(OUT / "retry_after_complete.png"))

        b.close()

    errs = [l for l in logs if l.startswith(("PAGEERROR", "error"))]
    print(json.dumps({"results": results, "console_errors": errs[:10], "errors": errors}, indent=2))
    (OUT / "qa_report.json").write_text(json.dumps({"results": results, "console_errors": errs[:10], "errors": errors}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
