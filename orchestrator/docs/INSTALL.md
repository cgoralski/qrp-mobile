# Installing the orchestrator

## 1. Clone this repository

Pick a path **next to** your application clones (sibling of `qrp-mobile`, etc.):

```bash
mkdir -p ~/Documents/Projects
cd ~/Documents/Projects
git clone <YOUR_ORCHESTRATOR_GIT_URL> .qrp-orchestrator
```

If you only have a ZIP: extract it to `.qrp-orchestrator`. **Self-update (`u` menu / `GIT_AUTO_UPDATE`) will be skipped** until you use a proper `git clone` — you will see a short message suggesting GitHub for version control and backups.

## 2. Install the stub `build.sh`

```bash
cp .qrp-orchestrator/stub-build.sh ./build.sh
chmod +x ./build.sh
```

The stub sets:

- `ORCH_PARENT` → `~/Documents/Projects` (the folder containing the stub)
- `ORCHESTRATOR_HOME` → `~/Documents/Projects/.qrp-orchestrator` (override if you cloned elsewhere)

## 3. Clone app repositories as siblings

```text
~/Documents/Projects/
  build.sh
  .qrp-orchestrator/
  qrp-mobile/     ← git clone of the app; must contain .build
```

Each **immediate child directory** of `ORCH_PARENT` that contains a file named **`.build`** appears in the menu.

## 4. Optional: auto-update on launch

```bash
export GIT_AUTO_UPDATE=1
./build.sh
```

Or add `export GIT_AUTO_UPDATE=1` inside your stub after the `ORCH_PARENT` line.

If `git pull` advances `HEAD`, the script prints that the orchestrator was updated and exits — **run `./build.sh` again**.

## 5. Dependencies

- **python3** (required)
- **jq** — not required; catalogs are read with Python.

## Symlink instead of stub

You may symlink `build.sh` to `stub-build.sh` inside the clone, but then `ORCH_PARENT` becomes the orchestrator directory, which is **wrong**. Always use a stub (or small wrapper) that sets `ORCH_PARENT` to the **projects parent**, not the orchestrator repo root.

## Manual run (developers)

From anywhere:

```bash
export ORCH_PARENT=/path/to/projects_parent
bash /path/to/.qrp-orchestrator/build.sh
```
