import re, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

files = [
    (r"C:/Users/UTKARSH/.kimi-code/sessions/wd_airguard_8d82f2e8d932/session_478c9d0d-ed37-4e47-9298-20ef72e33f82/agents/main/tool-results/FetchURL-tool_4tqyxBGOyxvqhSUqbELvxDqE-b487b69f-2482-46d7-bee1-8a404632c208.txt", "CHAT 1"),
    (r"C:/Users/UTKARSH/.kimi-code/sessions/wd_airguard_8d82f2e8d932/session_478c9d0d-ed37-4e47-9298-20ef72e33f82/agents/main/tool-results/FetchURL-tool_YcAbBKWLizP8qQawZFTby4Pd-683a4c27-4114-46ca-b676-7ad23a1d4086.txt", "CHAT 2"),
]

pattern = re.compile(r'"((?:[^"\\]|\\.){30,})"')

for path, label in files:
    with open(path, encoding='utf-8', errors='replace') as f:
        raw = f.read()
    print(f"===== {label} =====")
    frags = pattern.findall(raw)
    seen = set()
    keep = []
    for fr in frags:
        try:
            s = json.loads('"' + fr + '"')
        except Exception:
            continue
        if s in seen:
            continue
        seen.add(s)
        # keep sentence-like natural language, drop JSON blobs, code, ids
        if s.startswith(('{', '[', 'http', '/', 'cdn')):
            continue
        if '"name"' in s or 'rule_id' in s or 'feature_gate' in s:
            continue
        if s.count(' ') >= 6 and re.search(r'[a-z]{4,} [a-z]{4,} [a-z]{4,}', s):
            keep.append(s)
    for s in keep:
        print(s[:1500])
        print('---')
    print(f"===== END {label} ({len(keep)} frags) =====")
