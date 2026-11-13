#!/usr/bin/env python3
"""Split the master brief text into docs/spec/NN_section.md files (brief section 12.2)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "brief.txt"
OUT = ROOT / "docs" / "spec"

TITLES = {
    1: "mission",
    2: "overview",
    3: "tech_foundation",
    4: "art_direction",
    5: "characters",
    6: "environments",
    7: "gameplay",
    8: "ui_ux",
    9: "audio",
    10: "architecture",
    11: "asset_pipeline",
    12: "milestones",
    13: "working_rules",
}


def main() -> None:
    text = SRC.read_text()
    text = re.sub(r"=== PAGE \d+ ===\n", "", text)
    text = re.sub(r"NULLS SKATEPARK  -  Master Build Prompt v1\.1\nPage \d+\n", "", text)
    # Section headers appear as "N. Title" at line start.
    marks = []
    for n in range(1, 14):
        m = re.search(rf"^{n}\. [A-Z][^\n]*$", text, re.M)
        if m:
            marks.append((n, m.start()))
    marks.sort(key=lambda t: t[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (n, start) in enumerate(marks):
        end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
        body = text[start:end].strip()
        name = TITLES.get(n, f"section{n}")
        (OUT / f"{n:02d}_{name}.md").write_text(f"# {body.splitlines()[0]}\n\n" + "\n".join(body.splitlines()[1:]).strip() + "\n")
        print("wrote", n, name, len(body))


if __name__ == "__main__":
    main()
