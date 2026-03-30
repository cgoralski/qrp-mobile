# Pristine firmware reference (do not edit)

This folder is the **source of truth**: developer’s stock KV4P firmware plus local stubs (`SoftwareSerial.h`, `BUILD.md`) that are not in the upstream repo.

- **Do not edit** — keep it unchanged so you can diff or reset against it.
- **Working copy for builds and edits:** use the **`firmware/`** folder at the repo root. Open `firmware/microcontroller/` in PlatformIO (or the `.ino` in Arduino IDE), make changes there, and build `firmware.bin` from that tree.

To resync the working copy from this reference (e.g. after upstream changes), copy from `.original-poc/` into `firmware/` and re-apply any custom changes you keep in `firmware/`.
