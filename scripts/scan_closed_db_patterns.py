#!/usr/bin/env python3
import pathlib
import re
import sys


ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGETS = [ROOT / "modules", ROOT / "main.py", ROOT / "mirror_worker.py", ROOT / "tg_client.py"]
START_RE = re.compile(r"^(?P<indent>\s*)with closing\(get_db_connection\(\)\) as conn:\s*$")
SUSPECT_RE = re.compile(r"\bconn\.|\bc\s*=\s*conn\.cursor\(|\bc\.execute\(|\bc\.fetch")


def iter_files():
    for target in TARGETS:
        if target.is_dir():
            yield from sorted(target.glob("*.py"))
        elif target.is_file():
            yield target


def find_closed_db_patterns(path: pathlib.Path):
    lines = path.read_text().splitlines()
    findings = []
    idx = 0
    while idx < len(lines):
        match = START_RE.match(lines[idx])
        if not match:
            idx += 1
            continue
        base_indent = len(match.group("indent"))
        block_has_commit = False
        j = idx + 1
        while j < len(lines):
            line = lines[j]
            stripped = line.strip()
            indent = len(line) - len(line.lstrip())
            if stripped and indent <= base_indent:
                break
            if "conn.commit()" in line or "conn.rollback()" in line:
                block_has_commit = True
            j += 1

        if block_has_commit:
            for k in range(j, min(len(lines), j + 5)):
                text = lines[k].strip()
                if not text or text.startswith("#"):
                    continue
                if SUSPECT_RE.search(text):
                    findings.append(
                        {
                            "path": path,
                            "with_line": idx + 1,
                            "suspicious_line": k + 1,
                            "text": text,
                        }
                    )
                    break
                # Stop once next real statement clearly moves on.
                break
        idx = j
    return findings


def main():
    findings = []
    for path in iter_files():
        findings.extend(find_closed_db_patterns(path))

    if not findings:
        print("No suspicious post-close DB usage found.")
        return 0

    print("Suspicious post-close DB usage:")
    for item in findings:
        rel_path = item["path"].relative_to(ROOT)
        print(f"- {rel_path}:{item['with_line']} -> line {item['suspicious_line']}: {item['text']}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
