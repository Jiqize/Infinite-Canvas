# Feebee Studios Architecture

## Runtime shape

```text
React workspace
  ├─ Generate / Enhance / Edit / Online / Angle / Chat
  ├─ Gallery
  ├─ API / Models
  └─ Canvas route
       └─ Canvas List
            ├─ Classic Canvas
            └─ Smart Canvas

All workspaces → FastAPI (`main.py`) → local data and configured providers
```

The React shell owns navigation, common provider settings, generation workspaces, Gallery, and the Creation Rail. It does not interpret or save Canvas nodes.

Canvas List, Classic Canvas, and Smart Canvas own board selection, node editing, node execution, conflict resolution, and Canvas persistence through `/api/canvases`.

## Canvas intake

Gallery and Generate append batches to `localStorage.qcos_canvas_intake_items`.

- The stored schema is version 1 and supports multiple pending batches.
- Pending items are capped at 100; an overflowing batch is rejected atomically.
- A batch remains queued until its target Canvas saves successfully or the user cancels it.
- Canvas nodes store batch and item identifiers so reloads and 409 retries do not duplicate content.
- Cross-frame messages accept only the exact current origin and registered frame windows.

## Provider configuration

The common React editor performs a lossless read-modify-write of the provider contract. Advanced fields remain available through the hidden `/app/provider-settings` route.

Supported protocol values are `openai`, `apimart`, `gemini`, `gemini-cli`, `volcengine`, `runninghub`, `jimeng`, and `codex`. Existing `tudou` values remain readable, while new official Tudou endpoints use the `tudou-async` image request mode.

## Data ownership

Runtime state is intentionally outside version control:

- `API/.env*` contains local secrets.
- `data/` contains provider settings, projects, Canvas JSON, conversations, previews, and databases.
- `assets/` contains uploaded and indexed media.
- `output/` contains generated files.

Code cleanup, branch changes, and updates must preserve these paths or operate on a verified copy.

## Verification baseline

The release gate consists of Python compilation, the full pytest suite, syntax checks for standalone browser JavaScript, a production React build, the two hybrid Playwright suites, a 190/190 unique FastAPI route audit, `git diff --check`, and a tracked-secret/runtime-data scan.

Real provider checks are deliberately limited: they must not buy credits, retry quota failures, or claim success when credentials, ComfyUI nodes, or models are unavailable.
