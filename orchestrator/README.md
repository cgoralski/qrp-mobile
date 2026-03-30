# Build orchestrator (thin repo)

Generic interactive (and CI) driver for sibling app repositories. Each app ships a **`.build`** JSON file at its git root describing **actions** (shell commands) and optional **y/n prompts** after the default build.

## Quick install

1. Clone **this** repository to a hidden folder next to your projects, e.g.  
   `~/Documents/Projects/.qrp-orchestrator`
2. Copy [`stub-build.sh`](stub-build.sh) to `~/Documents/Projects/build.sh` and `chmod +x` it.
3. Ensure each app clone (sibling folder) contains a **`.build`** file — see [`docs/SCHEMA.md`](docs/SCHEMA.md).

Run:

```bash
~/Documents/Projects/build.sh
```

## Layout

```text
~/Documents/Projects/
  build.sh                 # stub (you copy from stub-build.sh)
  .qrp-orchestrator/       # this repo clone
  qrp-mobile/              # app repo with .build
  other-app/
```

## Environment

| Variable | Meaning |
|----------|---------|
| `ORCH_PARENT` | Set by stub: directory that **contains** project folders. |
| `ORCHESTRATOR_HOME` | Path to this repo clone (stub defaults to `$ORCH_PARENT/.qrp-orchestrator`). |
| `GIT_AUTO_UPDATE=1` | Before the menu, run `git pull --ff-only` in `ORCHESTRATOR_HOME`. |
| `FULL_REBUILD=1` | Consumed by app `.build` actions if referenced (e.g. QRP Mobile `npm ci`). |

## CI / non-interactive

```bash
export ORCH_PARENT=/path/to/parent
bash "$ORCHESTRATOR_HOME/build.sh" --non-interactive --project qrp-mobile
```

## Requirements

- **bash**, **python3** (read JSON catalogs)
- Per-action tools (Node, PlatformIO, etc.) as needed by each app’s `.build`

## License

Same as the repository that hosts this orchestrator (adjust as needed when you split repos).
