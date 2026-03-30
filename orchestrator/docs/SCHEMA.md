# `.build` catalog schema (v1)

Place a file named **`.build`** at the **root of the application git repository** (same level as `package.json` or your main project files). It must be valid **JSON**.

Orchestrator behavior:

1. Verifies the project directory is inside a **git** work tree.
2. Runs **`menu.defaultAction`** (non-interactive: only this action).
3. Optionally asks **y/n** for each entry in **`menu.afterDefaultPrompts`**, running the linked action on **y**.

## Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | number | yes | Use `1` for this schema. |
| `project` | object | yes | Display metadata. |
| `project.name` | string | yes | Shown in the menu. |
| `project.description` | string | no | Reserved for future use. |
| `project.repository` | string | no | Clone URL (informational). |
| `actions` | array | yes | Declarative shell steps. |
| `menu` | object | yes | Default action and prompts. |
| `menu.defaultAction` | string | yes | `id` of an action (CI / primary build). |
| `menu.afterDefaultPrompts` | array | no | `{ "prompt": "…", "actionId": "…" }` |

## Actions

Each element of `actions`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Stable identifier. |
| `label` | string | yes | Shown when the action runs. |
| `command` | string | yes | Passed to `bash -c` after `cd` to project root (and optional `cwd`). |
| `cwd` | string | no | Subdirectory of project root (default `"."`). |

The orchestrator prepends **PATH** and loads **nvm** when present; your command can assume a reasonable shell environment.

## Example (minimal)

```json
{
  "schemaVersion": 1,
  "project": {
    "name": "My App",
    "repository": "https://github.com/org/my-app.git"
  },
  "actions": [
    {
      "id": "build",
      "label": "Production build",
      "command": "npm ci && npm run build"
    }
  ],
  "menu": {
    "defaultAction": "build"
  }
}
```

## JSON Schema file

Machine-readable schema: [`../schema/build.schema.json`](../schema/build.schema.json).
