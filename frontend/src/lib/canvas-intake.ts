import type { GalleryAsset, GenerateRecord } from "./api";

export const CANVAS_INTAKE_EVENT = "qcos:canvas-intake";
export const CANVAS_INTAKE_STATUS_EVENT = "qcos:canvas-intake-status";
export const CANVAS_INTAKE_STORAGE_KEY = "qcos_canvas_intake_items";
export const CANVAS_INTAKE_MAX_ITEMS = 100;

export interface CanvasIntakeItem {
  id?: string;
  url: string;
  title?: string;
  prompt?: string;
  source?: string;
  model?: string;
  type?: "image" | "output";
  width?: number;
  height?: number;
  created_at?: string | number;
}

export interface CanvasIntakeBatchV1 {
  id: string;
  created_at: number;
  items: CanvasIntakeItem[];
}

export interface CanvasIntakeQueueV1 {
  version: 1;
  batches: CanvasIntakeBatchV1[];
}

export interface CanvasIntakeReadResult {
  ok: boolean;
  queue: CanvasIntakeQueueV1;
  raw: string;
  migrated: boolean;
  error: string;
}

export interface CanvasIntakeWriteResult {
  ok: boolean;
  items: CanvasIntakeItem[];
  batch?: CanvasIntakeBatchV1;
  queue?: CanvasIntakeQueueV1;
  error: string;
}

export type CanvasIntakeStatus = "queued" | "saving" | "succeeded" | "failed" | "cancelled";

interface LegacyStoredCanvasIntake {
  created_at?: number;
  items?: CanvasIntakeItem[];
}

function emptyQueue(): CanvasIntakeQueueV1 {
  return { version: 1, batches: [] };
}

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function assetImage(asset: GalleryAsset): string {
  return asset.url || asset.thumb_url || asset.thumbnail || "";
}

function assetTitle(asset: GalleryAsset): string {
  return asset.title || asset.name || asset.filename || "Gallery asset";
}

function assetPrompt(asset: GalleryAsset): string {
  return asset.prompt || asset.phrase || "";
}

function sourceLabel(asset: GalleryAsset): string {
  return (asset.source_labels?.length ? asset.source_labels : [asset.source_label || asset.source || "Gallery"]).filter(Boolean).join(" + ");
}

function normalizeItem(value: unknown): CanvasIntakeItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as CanvasIntakeItem;
  const url = String(input.url || "").trim();
  if (!url) return null;
  const item: CanvasIntakeItem = {
    ...input,
    url,
    type: input.type === "output" ? "output" : "image"
  };
  if (item.id !== undefined) item.id = String(item.id).trim();
  for (const key of ["title", "prompt", "source", "model"] as const) {
    if (item[key] !== undefined && item[key] !== null) item[key] = String(item[key]);
  }
  for (const key of ["width", "height"] as const) {
    if (item[key] === undefined || item[key] === null) continue;
    const numeric = Number(item[key]);
    if (Number.isFinite(numeric)) item[key] = numeric;
    else delete item[key];
  }
  return item;
}

export function normalizeCanvasIntakeItems(items: CanvasIntakeItem[]): CanvasIntakeItem[] {
  return (Array.isArray(items) ? items : []).map(normalizeItem).filter((item): item is CanvasIntakeItem => Boolean(item));
}

function stableBatchId(createdAt: number, items: CanvasIntakeItem[]): string {
  return `legacy-${hashText(`${Number(createdAt) || 0}|${JSON.stringify(items)}`)}`;
}

function createBatchId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // Fall through to a local unique id.
  }
  return `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeBatch(value: unknown, index = 0): CanvasIntakeBatchV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Batch ${index + 1} is invalid.`);
  const input = value as Partial<CanvasIntakeBatchV1>;
  const createdAt = Number(input.created_at) || 0;
  const items = normalizeCanvasIntakeItems(Array.isArray(input.items) ? input.items : []);
  const id = String(input.id || "").trim() || stableBatchId(createdAt, items);
  return { id, created_at: createdAt, items };
}

export function countCanvasIntakeItems(queue: CanvasIntakeQueueV1): number {
  return (queue?.batches || []).reduce((total, batch) => total + (Array.isArray(batch.items) ? batch.items.length : 0), 0);
}

export function readCanvasIntakeQueue(): CanvasIntakeReadResult {
  let raw = "";
  try {
    raw = localStorage.getItem(CANVAS_INTAKE_STORAGE_KEY) || "";
  } catch (error) {
    return { ok: false, queue: emptyQueue(), raw: "", migrated: false, error: `Unable to read Canvas intake: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!raw) return { ok: true, queue: emptyQueue(), raw: "", migrated: false, error: "" };
  try {
    const parsed = JSON.parse(raw) as Partial<CanvasIntakeQueueV1> & LegacyStoredCanvasIntake;
    let queue: CanvasIntakeQueueV1;
    let migrated = false;
    if (parsed.version === 1 && Array.isArray(parsed.batches)) {
      queue = { version: 1, batches: parsed.batches.map(normalizeBatch) };
    } else if (Array.isArray(parsed.items)) {
      const createdAt = Number(parsed.created_at) || 0;
      const items = normalizeCanvasIntakeItems(parsed.items);
      queue = { version: 1, batches: items.length ? [{ id: stableBatchId(createdAt, items), created_at: createdAt, items }] : [] };
      migrated = true;
    } else {
      throw new Error("stored structure is invalid");
    }
    if (countCanvasIntakeItems(queue) > CANVAS_INTAKE_MAX_ITEMS) throw new Error(`item count exceeds ${CANVAS_INTAKE_MAX_ITEMS}`);
    return { ok: true, queue, raw, migrated, error: "" };
  } catch (error) {
    return {
      ok: false,
      queue: emptyQueue(),
      raw,
      migrated: false,
      error: `Canvas intake is corrupt: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

function saveCanvasIntakeQueue(queue: CanvasIntakeQueueV1): { ok: boolean; queue: CanvasIntakeQueueV1; error: string } {
  const normalized: CanvasIntakeQueueV1 = { version: 1, batches: (queue.batches || []).map(normalizeBatch) };
  if (countCanvasIntakeItems(normalized) > CANVAS_INTAKE_MAX_ITEMS) {
    return { ok: false, queue: normalized, error: `Canvas intake cannot exceed ${CANVAS_INTAKE_MAX_ITEMS} items.` };
  }
  try {
    if (normalized.batches.length) localStorage.setItem(CANVAS_INTAKE_STORAGE_KEY, JSON.stringify(normalized));
    else localStorage.removeItem(CANVAS_INTAKE_STORAGE_KEY);
    return { ok: true, queue: normalized, error: "" };
  } catch (error) {
    return { ok: false, queue: normalized, error: `Unable to save Canvas intake: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function notifyCanvasIntakeStatus(status: CanvasIntakeStatus, batchIds: string[], itemCount: number, detail = ""): void {
  const message = { type: "canvas-intake-status", status, batch_ids: batchIds, item_count: Math.max(0, itemCount), detail };
  window.dispatchEvent(new CustomEvent(CANVAS_INTAKE_STATUS_EVENT, { detail: message }));
}

export function writeCanvasIntakeItems(items: CanvasIntakeItem[]): CanvasIntakeWriteResult {
  const normalized = normalizeCanvasIntakeItems(items);
  if (!normalized.length) return { ok: false, items: [], error: "No valid assets were available for Canvas." };
  const current = readCanvasIntakeQueue();
  if (!current.ok) return { ok: false, items: normalized, queue: current.queue, error: current.error };
  if (countCanvasIntakeItems(current.queue) + normalized.length > CANVAS_INTAKE_MAX_ITEMS) {
    return { ok: false, items: normalized, queue: current.queue, error: `Canvas intake cannot exceed ${CANVAS_INTAKE_MAX_ITEMS} items.` };
  }
  const batch: CanvasIntakeBatchV1 = { id: createBatchId(), created_at: Date.now(), items: normalized };
  const saved = saveCanvasIntakeQueue({ version: 1, batches: [...current.queue.batches, batch] });
  if (!saved.ok) return { ok: false, items: normalized, batch, queue: current.queue, error: saved.error };
  const result: CanvasIntakeWriteResult = { ok: true, items: normalized, batch, queue: saved.queue, error: "" };
  window.dispatchEvent(new CustomEvent(CANVAS_INTAKE_EVENT, { detail: result }));
  notifyCanvasIntakeStatus("queued", [batch.id], normalized.length, "Canvas intake queued");
  return result;
}

export function consumeCanvasIntakeItems(): CanvasIntakeItem[] {
  const result = readCanvasIntakeQueue();
  if (!result.ok) return [];
  const items = result.queue.batches.flatMap((batch) => batch.items);
  try {
    localStorage.removeItem(CANVAS_INTAKE_STORAGE_KEY);
  } catch {
    return [];
  }
  return items;
}

export function galleryAssetToCanvasIntakeItem(asset: GalleryAsset): CanvasIntakeItem | null {
  const url = assetImage(asset);
  if (!url) return null;
  return {
    id: asset.id,
    url,
    title: assetTitle(asset),
    prompt: assetPrompt(asset),
    source: sourceLabel(asset),
    model: asset.model,
    type: asset.artifact_type === "output" ? "output" : "image",
    width: asset.width,
    height: asset.height,
    created_at: asset.created_at
  };
}

export function generateRecordToCanvasIntakeItem(record: GenerateRecord, index = 0): CanvasIntakeItem | null {
  const url = record.images?.[0] || "";
  if (!url) return null;
  return {
    id: record.task_id || record.taskId || `${record.timestamp || Date.now()}-${index}`,
    url,
    title: record.prompt || `Generated output ${index + 1}`,
    prompt: record.prompt,
    source: record.type || "Generated output",
    model: record.model,
    type: "output",
    width: record.width,
    height: record.height,
    created_at: record.timestamp
  };
}
