#!/usr/bin/env python3
"""Read .build JSON catalogs. Used by orchestrator bash scripts (no jq required)."""
from __future__ import annotations

import json
import sys
from pathlib import Path


def load_build(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def cmd_discover(parent: str) -> None:
    root = Path(parent)
    if not root.is_dir():
        print(f"error: not a directory: {parent}", file=sys.stderr)
        sys.exit(1)
    rows: list[tuple[str, str]] = []
    for p in sorted(root.iterdir()):
        if not p.is_dir():
            continue
        bf = p / ".build"
        if not bf.is_file():
            continue
        try:
            data = load_build(bf)
        except (json.JSONDecodeError, OSError) as e:
            print(f"warning: skip {p.name}: {e}", file=sys.stderr)
            continue
        name = (data.get("project") or {}).get("name") or p.name
        rows.append((p.name, name))
    for slug, name in rows:
        print(f"{slug}\t{name}")


def cmd_project_name(build_file: str) -> None:
    data = load_build(Path(build_file))
    print((data.get("project") or {}).get("name", ""))


def cmd_default_action(build_file: str) -> None:
    data = load_build(Path(build_file))
    menu = data.get("menu") or {}
    print(menu.get("defaultAction") or "")


def cmd_action_command(build_file: str, action_id: str) -> None:
    data = load_build(Path(build_file))
    for a in data.get("actions") or []:
        if a.get("id") == action_id:
            print(a.get("command") or "")
            return
    sys.exit(1)


def cmd_action_cwd(build_file: str, action_id: str) -> None:
    data = load_build(Path(build_file))
    for a in data.get("actions") or []:
        if a.get("id") == action_id:
            print(a.get("cwd") or ".")
            return
    print(".")


def cmd_action_label(build_file: str, action_id: str) -> None:
    data = load_build(Path(build_file))
    for a in data.get("actions") or []:
        if a.get("id") == action_id:
            print(a.get("label") or action_id)
            return
    print(action_id)


def cmd_list_action_ids(build_file: str) -> None:
    data = load_build(Path(build_file))
    for a in data.get("actions") or []:
        aid = a.get("id")
        if aid:
            print(aid)


def cmd_after_prompts(build_file: str) -> None:
    data = load_build(Path(build_file))
    menu = data.get("menu") or {}
    for item in menu.get("afterDefaultPrompts") or []:
        p = item.get("prompt") or ""
        aid = item.get("actionId") or ""
        if p and aid:
            print(f"{p}\t{aid}")


def cmd_schema_version(build_file: str) -> None:
    data = load_build(Path(build_file))
    print(int(data.get("schemaVersion") or 0))


def cmd_repository(build_file: str) -> None:
    data = load_build(Path(build_file))
    print((data.get("project") or {}).get("repository") or "")


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: catalog.py discover <parent_dir>", file=sys.stderr)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "discover":
        cmd_discover(sys.argv[2])
    elif cmd == "project-name":
        cmd_project_name(sys.argv[2])
    elif cmd == "default-action":
        cmd_default_action(sys.argv[2])
    elif cmd == "action-command":
        cmd_action_command(sys.argv[2], sys.argv[3])
    elif cmd == "action-cwd":
        cmd_action_cwd(sys.argv[2], sys.argv[3])
    elif cmd == "action-label":
        cmd_action_label(sys.argv[2], sys.argv[3])
    elif cmd == "list-action-ids":
        cmd_list_action_ids(sys.argv[2])
    elif cmd == "after-prompts":
        cmd_after_prompts(sys.argv[2])
    elif cmd == "schema-version":
        cmd_schema_version(sys.argv[2])
    elif cmd == "repository":
        cmd_repository(sys.argv[2])
    else:
        print(f"unknown command: {cmd}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
