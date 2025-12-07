"""
Script to update low-contrast Tailwind classes across frontend/src files.
Replacements (order matters):
 - text-slate-300 -> text-slate-500
 - text-slate-400 -> text-slate-600
 - text-slate-500 -> text-slate-700

Skips: frontend/src/index.css

Run from repo root with the project's Python interpreter.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'frontend' / 'src'

if not SRC.exists():
    print('frontend/src not found; aborting')
    raise SystemExit(1)

patterns = [
    (re.compile(r'\btext-slate-300\b'), 'text-slate-500'),
    (re.compile(r'\btext-slate-400\b'), 'text-slate-600'),
    (re.compile(r'\btext-slate-500\b'), 'text-slate-700'),
]

files_changed = []
for path in SRC.rglob('*'):
    if path.is_file() and path.suffix in {'.tsx', '.ts', '.jsx', '.js'}:
        if path.name == 'index.css':
            continue
        text = path.read_text(encoding='utf-8')
        new_text = text
        for pat, repl in patterns:
            new_text = pat.sub(repl, new_text)
        if new_text != text:
            path.write_text(new_text, encoding='utf-8')
            files_changed.append(str(path.relative_to(ROOT)))

print('Files changed:', len(files_changed))
for f in files_changed:
    print(' -', f)
print('\nDone')
