# V3 Hybrid Canvas Handoff

## Current checkpoint

- Worktree: `/Users/lianglei/Projects/git/Infinite-Canvas.codex-worktrees/v3-canvas-hybrid`
- Branch: `codex/v3-canvas-hybrid`
- Source base: `v3` at `3c5d65e0b383db1582aee83e1ff4e51e4b4ffb89`
- Current source of truth: `docs/specs/2026-08-29-v3-canvas-hybrid.md`
- Execution plan: `docs/plans/2026-08-29-v3-canvas-hybrid-integration.md`
- External data snapshot: `/Users/lianglei/.codex/backups/infinite-canvas/20260829-204027`
- Status: Tasks 0–6 are complete locally. Nothing has been pushed, deployed, merged, or rebased.

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

The stage-closing gates recorded in the plan passed:

- `python3 -m py_compile main.py`
- full `python3 -m pytest -q`: 46 passed, 2 subtests passed (8 existing deprecation warnings)
- syntax checks for all six changed static JavaScript files
- `frontend npm run build`
- `canvas_hybrid_qa.spec.mjs` and `api_models_hybrid_qa.spec.mjs`: 27 passed
- FastAPI route audit: 190 decorators and 190 unique method/path pairs
- `git diff --check`
- repository safety scan for secrets, databases, Canvas data, logs, backups, reports, and dependencies

The obsolete `native_canvas_complete_qa.spec.mjs` was removed only after the hybrid Canvas suite passed. The committed `static/app` contains only the current build hashes and does not contain a React Canvas runtime reference.

## Remaining Task 7 only

- Run the application against copied snapshot data, never the original user Canvas directory.
- Submit at most one minimal APIMart request and one minimal Comfly request; wait at most ten minutes for each and do not retry quota/rate-limit failures.
- Check MiniMax local workflow readiness without installing missing models or nodes.
- Load and save copies of the seven Classic and four Smart Canvases; verify original hashes and mtimes remain unchanged.
- Record real outcomes and environment blockers in the plan, `TODOS.md`, and `REVIEW_HANDOFF.md`.
- Run the final focused closeout and local commit. Do not push, deploy, or merge.

## Safety rules

- Do not use the original dirty worktree for this migration.
- Do not modify original user Canvas or provider data during acceptance.
- Do not buy credits, create accounts, install missing workflow models/nodes, or broaden provider testing.
- Treat quota, rate-limit, missing ffmpeg, missing model, and missing custom-node results as explicit environment outcomes, not reasons to change product code.
- Do not restore the superseded zero-iframe/native React Canvas QA.
