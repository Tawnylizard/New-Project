#!/usr/bin/env python3
"""
SessionStart hook: inject current feature context at the start of each Claude Code session.
Reads feature-roadmap.json, git log, and TODO scan to provide sprint snapshot.
Timeout: <= 10 seconds
"""

import json
import subprocess
import sys
import os
from pathlib import Path

def get_roadmap():
    roadmap_path = Path('.claude/feature-roadmap.json')
    if not roadmap_path.exists():
        return None
    with open(roadmap_path) as f:
        return json.load(f)

def get_recent_commits(n=5):
    try:
        result = subprocess.run(
            ['git', 'log', f'--oneline', f'-{n}'],
            capture_output=True, text=True, timeout=3
        )
        return result.stdout.strip().split('\n') if result.stdout.strip() else []
    except Exception:
        return []

def count_todos():
    try:
        result = subprocess.run(
            ['grep', '-r', 'TODO\|FIXME\|HACK', 'apps/', 'packages/', '--include=*.ts', '--include=*.tsx', '-l'],
            capture_output=True, text=True, timeout=3
        )
        files = [f for f in result.stdout.strip().split('\n') if f]
        return len(files)
    except Exception:
        return 0

def main():
    roadmap = get_roadmap()
    if not roadmap:
        return

    features = roadmap.get('features', [])

    in_progress = [f for f in features if f['status'] == 'in_progress']
    next_up = [f for f in features if f['status'] == 'next']
    done = [f for f in features if f['status'] == 'done']
    blocked = [f for f in features if f['status'] == 'blocked']
    total_mvp = [f for f in features if f.get('phase') == 'mvp']

    recent_commits = get_recent_commits()
    todo_count = count_todos()

    print("\n" + "="*60)
    print(f"🚀 Клёво — Sprint Context ({roadmap.get('version', 'mvp')})")
    print("="*60)

    # Progress bar
    done_count = len(done)
    mvp_total = len(total_mvp)
    progress = int((done_count / mvp_total * 20)) if mvp_total > 0 else 0
    bar = "█" * progress + "░" * (20 - progress)
    print(f"\n📊 MVP Progress: [{bar}] {done_count}/{mvp_total}")

    if in_progress:
        print(f"\n🔄 In Progress:")
        for f in in_progress:
            print(f"   • {f['name']}")

    if next_up:
        print(f"\n⏭️  Next Up:")
        for f in next_up[:3]:
            deps_done = all(
                any(d['id'] == dep_id and d['status'] == 'done' for d in features)
                for dep_id in f.get('depends_on', [])
            )
            status_icon = "✅" if deps_done else "⏳"
            print(f"   {status_icon} {f['name']}")

    if blocked:
        print(f"\n🚫 Blocked ({len(blocked)}):")
        for f in blocked[:2]:
            blocking = ', '.join(f.get('depends_on', []))
            print(f"   • {f['name']} (waiting: {blocking})")

    if recent_commits:
        print(f"\n📝 Recent commits:")
        for c in recent_commits[:3]:
            print(f"   {c}")

    if todo_count > 0:
        print(f"\n📌 TODOs/FIXMEs in code: {todo_count} files")

    print(f"\n💡 Commands: /next | /feature <name> | /go | /start | /plan <feature>")
    print("="*60 + "\n")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        # Never crash the session — silently ignore errors
        pass
