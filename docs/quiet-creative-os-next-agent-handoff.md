# V3 Hybrid Canvas Handoff

## Current checkpoint

- Worktree: `/Users/lianglei/Projects/git/Infinite-Canvas.codex-worktrees/v3-canvas-hybrid`
- Branch: `codex/v3-canvas-hybrid`
- Source base: `v3` at `3c5d65e0b383db1582aee83e1ff4e51e4b4ffb89`
- Current source of truth: `docs/specs/2026-08-29-v3-canvas-hybrid.md`
- Execution plan: `docs/plans/2026-08-29-v3-canvas-hybrid-integration.md`
- External data snapshot: `/Users/lianglei/.codex/backups/infinite-canvas/20260829-204027`
- Status: Tasks 0–7, final review, and local closeout are complete. Nothing has been pushed, deployed, merged, or rebased.

This handoff supersedes the earlier native React Canvas direction. Historical phase documents remain in the repository as history; they are not current implementation requirements.

## Product architecture now

- React owns the workspace shell, Gallery, Generate, common provider settings, and Creation Rail.
- `/app/canvas` embeds `/static/canvas-list.html` as the only product Canvas entry.
- Canvas List, Classic Canvas, and Smart Canvas own all node editing, execution, conflict handling, and Canvas persistence.
- React Canvas source files remain for one release-cycle rollback safety, but there is no `native-canvas` route kind, runtime import, render branch, or production bundle reference.
- Creation Rail exposes only pending Canvas intake count, save status, and the advanced provider-settings entry.

## Completed behavior

- Ported the selected 2026-08-01 and 2026-08-04 upstream backend features without replacing local `main.py`.
- Added four Midjourney endpoints, Smart Canvas MiniMax export, MiniMax H3 assets, Tudou async mode, RunningHub assets, and targeted APIMart/Gemini/Jimeng fixes.
- Synced Classic and Smart Canvas Midjourney/MiniMax functionality while excluding DX-OS, announcements, README/VERSION changes, and backup files.
- React common provider settings now preserve the complete backend public contract and expose eight protocols plus five image request modes; legacy Tudou values remain lossless.
- `/app/provider-settings` is hidden, not kept alive, and keeps API / Models highlighted.
- Canvas intake uses append-only V1 batches in `qcos_canvas_intake_items`, preserves corrupt/failed data, caps pending items at 100, and supports explicit cancellation.
- Classic maps intake `image` to image nodes and `output` to output nodes. Smart maps both to `smart-image` nodes.
- Intake batches clear only after a successful Canvas save. 409 retries and saved-node markers prevent duplicate insertion across retries or refreshes.
- Cross-frame messages require exact same-origin and a registered source window. Canvas metadata polling pauses in the background and checks immediately on return; generation polling is unchanged.

## Verification at the Task 6 boundary

The original Task 6 stage-closing gates passed. Final review expanded the same gates to:

- `python3 -m py_compile main.py`
- full `python3 -m pytest -q`: 48 passed, 2 subtests passed (8 existing deprecation warnings)
- syntax checks for all changed standalone JavaScript files
- `frontend npm run build`
- `canvas_hybrid_qa.spec.mjs` and `api_models_hybrid_qa.spec.mjs`: 31 passed
- FastAPI route audit: 190 HTTP decorators and 190 unique method/path pairs, plus the existing WebSocket route
- `git diff --check`
- repository safety scan for secrets, databases, Canvas data, logs, backups, reports, and dependencies
- no wildcard `postMessage` target and no React Canvas runtime reference in `static/app`

The obsolete `native_canvas_complete_qa.spec.mjs` was removed only after the hybrid Canvas suite passed. The committed `static/app` contains only the current build hashes and does not contain a React Canvas runtime reference.

Final pre-landing review closed seven implementation findings: Classic 409 now performs a real no-loss merge; legacy advanced settings preserves unedited fields; Smart Canvas load failures are visible and retain intake; cross-frame messages are same-origin and known-source only; RunningHub static-template writes are locked and atomic; corrupt V1 intake is preserved; and the React LoRA sample matches the backend contract. Regression coverage for each material data boundary is green, with no open code findings.

## Task 7 acceptance results

- Acceptance ran from the restricted snapshot copy `/Users/lianglei/.codex/tmp/v3-canvas-acceptance.80vMu9/app`, not from the user's dirty worktree or original Canvas data.
- APIMart received exactly one minimal live request and returned HTTP 200 with one image.
- Comfly received exactly one minimal live request and returned HTTP 401 for an invalid token. It was not retried and remains an environment/configuration follow-up.
- `MiniMax_H3.json` loaded with 19 nodes and its config loaded with 5 fields. Local ComfyUI on `127.0.0.1:8188` was unreachable, so custom-node and model readiness is not claimed.
- All seven Classic and four Smart Canvas copies passed API load/save smoke. A real headless browser loaded all 11 editor pages without page errors.
- Historical output assets were intentionally absent from the data snapshot, so old output-image requests returned 404 during browser smoke; this did not prevent editor load or save.
- Original Canvas hashes, sizes, and mtimes had zero changes. Original provider config, projects, and environment config still match the Task 0 snapshot byte-for-byte.

## External follow-ups

- Refresh the Comfly key before its next one-shot live acceptance.
- Provide valid ModelScope and RunningHub environments before their live acceptance.
- Start a compatible ComfyUI installation with the four referenced MiniMax H3 model files and required custom nodes before claiming local workflow readiness.
- Delete the frozen React Canvas source only after one stable release cycle, as recorded in `TODOS.md`.

## Safety rules

- Do not use the original dirty worktree for this migration.
- Do not modify original user Canvas or provider data during acceptance.
- Do not buy credits, create accounts, install missing workflow models/nodes, or broaden provider testing.
- Treat quota, rate-limit, missing ffmpeg, missing model, and missing custom-node results as explicit environment outcomes, not reasons to change product code.
- Do not restore the superseded zero-iframe/native React Canvas QA.
