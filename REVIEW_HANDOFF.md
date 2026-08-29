# V3 Hybrid Canvas Review Handoff

## Review scope

Review the local branch `codex/v3-canvas-hybrid` against base commit `3c5d65e0b383db1582aee83e1ff4e51e4b4ffb89`. The implementation keeps the React workspace shell but makes Canvas List, Classic Canvas, and Smart Canvas the only runtime Canvas editors. It selectively ports functionality from upstream commits `2aeaba4fa15ec03a6d2b6926654a47f93b9a069e` and `1c141a5715c04bbf29b4c2cf76fb78739da8cfe8`.

The behavioral source of truth is `docs/specs/2026-08-29-v3-canvas-hybrid.md`; execution evidence is in `docs/plans/2026-08-29-v3-canvas-hybrid-integration.md`.

## Principal interfaces to inspect

- FastAPI exposes exactly 190 unique method/path pairs, including four Midjourney routes and `POST /api/smart-canvas/minimax-export`.
- Provider GET/PUT normalization must preserve every public advanced field while React edits common fields.
- `qcos_canvas_intake_items` stores append-only V1 batches, retains failed batches, caps pending items at 100, and migrates the legacy shape without overwriting corrupt input.
- Classic and Smart Canvas write `qcos_intake_batch_id` and `qcos_intake_item_id`, clear a batch only after save success, and deduplicate after 409/reload.
- Cross-frame messages require exact same-origin and a registered source window; no changed sender uses `"*"`.
- `/app/canvas` embeds the legacy Canvas List. React Canvas source remains in the tree but has no route, runtime import, render branch, or production-bundle reference.

## Deterministic verification already completed

- Python compile passed.
- Full pytest: 48 passed, 2 subtests passed, with 8 existing deprecation warnings.
- Syntax checks passed for all changed standalone JavaScript files.
- React production build passed.
- Hybrid Canvas and provider Playwright suites: 31 passed.
- Route audit: 190 HTTP decorators, 190 unique method/path pairs, plus the existing WebSocket route.
- `git diff --check` passed.
- Safety scan found no tracked secrets, databases, Canvas data, logs, backups, reports, dependencies, or high-confidence key material.
- Production bundle contains no `CanvasWorkspace` or `native-canvas` reference, and related static senders contain no wildcard `postMessage` target.

## Review closure

Pre-landing review found and fixed seven concrete issues before closeout: Classic Canvas now merges remote-only state on 409; legacy advanced settings preserves endpoints, primary state, model names, and every advanced provider field; Smart Canvas load failures are visible without consuming intake; frame messaging uses exact same-origin and known windows; RunningHub template mutation is locked and atomic; structurally corrupt V1 queues remain byte-for-byte untouched; and the React LoRA example matches the backend schema. The added regression cases pass and there are no open code findings.

## Live acceptance evidence

- Acceptance data is a permission-restricted copy at `/Users/lianglei/.codex/tmp/v3-canvas-acceptance.80vMu9/app`; original user data was not used as a write target.
- APIMart: one request, HTTP 200, one image.
- Comfly: one request, HTTP 401 invalid token, no retry.
- MiniMax H3: workflow/config load successfully; ComfyUI on port 8188 was unavailable, so node/model readiness is explicitly unverified.
- Canvas copies: 7 Classic and 4 Smart passed API load/save and 11/11 loaded in a headless browser without page errors.
- Original 11 Canvas files had no hash, size, or mtime changes; provider, project, and environment files match the pre-migration snapshot.
- The snapshot omitted historical generated-image files. Their expected 404s during page load are not evidence of a Canvas code regression.

## Review focus and known limits

Prioritize data-loss, duplicate insertion, cross-frame trust, provider-field loss, route duplication, and accidental React Canvas runtime reachability. Do not treat unavailable third-party credentials, ComfyUI models/nodes, or intentionally missing historical snapshot assets as implementation defects unless the code obscures those failures.

No deployment, push, merge, rebase, account creation, credit purchase, model installation, or original-user-data mutation is authorized or performed.
