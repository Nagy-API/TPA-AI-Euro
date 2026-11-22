"""Zero-dependency documentation and fake-fixture sanity checks.
This is NOT a product unit/integration or security test.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

required = [
    "README.md", "AGENTS.md", "HANDOFF.md", "PROJECT_STATUS.md",
    "ROADMAP.md", "docs/architecture.md", "docs/api-contracts.md",
    "docs/member-identity.md", "docs/definition-of-done.md",
]
for entry in required:
    if not (ROOT / entry).is_file():
        errors.append(f"missing required file: {entry}")

for path in ROOT.rglob("*.md"):
    content = path.read_text(encoding="utf-8")
    if content.count("```") % 2:
        errors.append(f"unbalanced code fences: {path.relative_to(ROOT)}")
    for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", content):
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        clean = target.split("#", 1)[0]
        if clean and not (path.parent / clean).exists():
            errors.append(f"broken local link: {path.relative_to(ROOT)} -> {target}")

for path in ROOT.rglob("*.json"):
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"invalid json: {path.relative_to(ROOT)}: {exc}")

seen_ids: set[str] = set()
path = ROOT / "evals/scenarios.jsonl"
if path.exists():
    for idx, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        try:
            case = json.loads(line)
            case_id = case["id"]
            if case_id in seen_ids:
                errors.append(f"duplicate eval ID: {case_id}")
            seen_ids.add(case_id)
        except (json.JSONDecodeError, KeyError) as exc:
            errors.append(f"invalid eval line {idx}: {exc}")

if errors:
    print("Validation FAILED:")
    for issue in errors:
        print("-", issue)
    sys.exit(1)
print(f"Validation OK: required files, markdown links/fences, JSON and {len(seen_ids)} eval definitions")
print("Note: this does not test the application, model responses, production security or Mermaid rendering.")
