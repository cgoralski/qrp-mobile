# QRP Mobile

Documentation lives in the **[docs/](docs/)** folder:

- [Project overview & setup](docs/README.md)
- [Deployment](docs/DEPLOY.md)
- [KV4P specs & firmware](docs/firmware/)
- [PCB & hardware](docs/pcb/)

Run the app: `npm i && npm run dev`

**Multi-project / local build menu:** This repo includes [`orchestrator/`](orchestrator/) (thin, app-agnostic driver) and a root [`.build`](.build) catalog. From the repo, run `bash scripts/build.sh` to pick a sibling project under the parent folder, or use a [stub](orchestrator/stub-build.sh) in `~/Documents/Projects/` as described in [`orchestrator/docs/INSTALL.md`](orchestrator/docs/INSTALL.md).
