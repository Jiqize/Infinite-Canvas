import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";
const VITE_BASE = "http://127.0.0.1:5173";

test.setTimeout(30000);

async function mockLegacyApis(page, kind = "classic", canvasOverride = null) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/config") {
      return route.fulfill({ json: {
        api_providers: [{ id: "apimart", name: "APIMart", protocol: "apimart", enabled: true, has_key: true }],
        comfy_instances: ["127.0.0.1:8188"],
        image_models: ["gpt-image-2"],
        video_models: ["minimax-video"]
      } });
    }
    if (path === "/api/providers") {
      return route.fulfill({ json: { providers: [{ id: "apimart", name: "APIMart", protocol: "apimart", enabled: true, has_key: true }] } });
    }
    if (path === "/api/workflows") {
      return route.fulfill({ json: { workflows: [{ name: "MiniMax_H3.json", title: "MiniMax H3", field_count: 5 }] } });
    }
    if (path === "/api/midjourney/submit") {
      return route.fulfill({ json: { task_id: "mj-task-qa", status: "queued" } });
    }
    if (path === "/api/midjourney/tasks/mj-task-qa") {
      return route.fulfill({ json: {
        task_id: "mj-task-qa",
        status: "succeeded",
        image_items: [{ url: "https://example.test/midjourney-qa.png", name: "midjourney-qa.png" }]
      } });
    }
    if (path === "/api/canvases/qa-canvas") {
      return route.fulfill({ json: { canvas: canvasOverride || {
        id: "qa-canvas",
        title: "Hybrid Canvas QA",
        kind,
        nodes: [],
        connections: [],
        viewport: { x: 0, y: 0, scale: 1 },
        settings: {},
        logs: [],
        updated_at: 1
      } } });
    }
    return route.fulfill({ json: {} });
  });
}

async function mockCanvasListApis(page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/projects") {
      return route.fulfill({ json: { projects: [{ id: "default", name: "Default", order: 0, canvas_count: 1 }] } });
    }
    if (path === "/api/canvases" && request.method() === "GET") {
      return route.fulfill({ json: { canvases: [{
        id: "canvas-target", title: "Target Canvas", kind: "classic", project: "default",
        node_count: 0, board_x: 40, board_y: 40, updated_at: 1
      }] } });
    }
    if (path === "/api/canvases" && request.method() === "POST") {
      const payload = request.postDataJSON();
      return route.fulfill({ json: { canvas: {
        id: "created-target", title: payload.title, kind: payload.kind, project: payload.project,
        node_count: 0, board_x: payload.board_x, board_y: payload.board_y, updated_at: 2
      } } });
    }
    if (path === "/api/canvases/trash") return route.fulfill({ json: { canvases: [] } });
    if (path === "/api/canvases/canvas-target") {
      return route.fulfill({ json: { canvas: {
        id: "canvas-target", title: "Target Canvas", kind: "classic", project: "default",
        nodes: [], connections: [], viewport: { x: 0, y: 0, scale: 1 }, settings: {}, logs: [], updated_at: 1
      } } });
    }
    return route.fulfill({ json: {} });
  });
}

async function mockReactGalleryApis(page) {
  const asset = {
    id: "gallery-asset-1",
    url: "https://example.test/gallery-asset-1.png",
    title: "Gallery Intake Asset",
    prompt: "editorial product image",
    source: "gallery",
    artifact_type: "image",
    width: 1024,
    height: 1024,
    created_at: 1
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/config") {
      return route.fulfill({ json: {
        base_url: "https://api.example.test",
        chat_model: "chat-model",
        image_model: "image-model",
        chat_models: ["chat-model"],
        image_models: ["image-model"],
        video_models: [],
        has_api_key: true,
        has_ms_key: false,
        api_providers: [{ id: "openai-main", name: "OpenAI", protocol: "openai", enabled: true, has_key: true }]
      } });
    }
    if (path === "/api/gallery/assets") return route.fulfill({ json: { assets: [asset], total: 1, page: 1, page_size: 36, pages: 1, facets: {} } });
    if (path === "/api/queue_status") return route.fulfill({ json: { total: 0, position: 0, status: "idle" } });
    return route.fulfill({ json: {} });
  });
}

test("classic Canvas exposes Midjourney and MiniMax nodes without DX-OS", async ({ page }) => {
  await mockLegacyApis(page, "classic");
  await page.goto(`${BASE}/static/canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });

  await expect(page.locator('button[onclick="addMiniMaxNode()"]')).toHaveCount(1);
  await expect(page.locator('button[onclick="menuAdd(\'midjourney\')"]')).toHaveCount(1);
  await expect(page.locator('button[onclick="menuAdd(\'minimax\')"]')).toHaveCount(1);
  expect(await page.evaluate(() => ({
    addMiniMaxNode: typeof window.addMiniMaxNode,
    runMiniMaxNode: typeof window.runMiniMaxNode,
    addMidjourneyNode: typeof window.addMidjourneyNode,
    runMidjourneyNode: typeof window.runMidjourneyNode
  }))).toEqual({
    addMiniMaxNode: "function",
    runMiniMaxNode: "function",
    addMidjourneyNode: "function",
    runMidjourneyNode: "function"
  });
  expect((await page.locator("body").innerText()).toLowerCase()).not.toContain("dx-os");
});

function classicMidjourneyCanvas() {
  return {
    id: "qa-canvas",
    title: "Hybrid Canvas QA",
    kind: "classic",
    nodes: [
      { id: "prompt-qa", type: "prompt", x: 40, y: 40, text: "editorial fashion portrait" },
      {
        id: "mj-qa", type: "midjourney", x: 420, y: 40, apiProvider: "apimart",
        mode: "imagine", size: "1:1", version: "6.1", speed: "relax", inputs: []
      }
    ],
    connections: [{ id: "connection-qa", from: "prompt-qa", to: "mj-qa" }],
    viewport: { x: 0, y: 0, scale: 1 },
    settings: {},
    logs: [],
    updated_at: 1
  };
}

test("classic Midjourney run exposes a successful result", async ({ page }) => {
  await mockLegacyApis(page, "classic", classicMidjourneyCanvas());
  await page.goto(`${BASE}/static/canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('.node[data-id="mj-qa"]')).toHaveCount(1);

  await page.evaluate(() => window.runMidjourneyNode("mj-qa"));
  await expect(page.locator('.node[data-id="mj-qa"] .node-run-status.done')).toHaveCount(1);
  await expect(page.locator('.output-node img[src*="midjourney-qa.png"]')).toHaveCount(1);
});

test("classic Midjourney run exposes an upstream failure", async ({ page }) => {
  await mockLegacyApis(page, "classic", classicMidjourneyCanvas());
  await page.route("**/api/midjourney/submit", (route) => route.fulfill({
    status: 502,
    json: { detail: "mock upstream unavailable" }
  }));
  await page.goto(`${BASE}/static/canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('.node[data-id="mj-qa"]')).toHaveCount(1);
  await page.evaluate(() => window.runMidjourneyNode("mj-qa"));
  await expect(page.locator("#errorModal.open")).toHaveCount(1);
  await expect(page.locator("#errorMessage")).toContainText("mock upstream unavailable");
});

test("smart Canvas exposes the MiniMax timeline entry without DX-OS", async ({ page }) => {
  await mockLegacyApis(page, "smart");
  await page.goto(`${BASE}/static/smart-canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });

  await expect(page.locator('[data-create-type="minimax"]')).toHaveCount(1);
  expect(await page.evaluate(() => ({
    createMinimaxNode: typeof window.createMinimaxNode,
    runMinimaxNode: typeof window.runMinimaxNode,
    exportMinimaxTimeline: typeof window.exportMinimaxTimeline
  }))).toEqual({
    createMinimaxNode: "function",
    runMinimaxNode: "function",
    exportMinimaxTimeline: "function"
  });
  expect((await page.locator("body").innerText()).toLowerCase()).not.toContain("dx-os");
});

test("advanced settings and legacy Chat expose the new request fields", async ({ page }) => {
  await mockLegacyApis(page);
  await page.goto(`${BASE}/static/api-settings.html`, { waitUntil: "domcontentloaded" });

  await expect(page.locator('#protocolInput option[value="tudou"]')).toHaveCount(0);
  await expect(page.locator('#imageRequestModeInput option[value="tudou-async"]')).toHaveCount(1);

  await page.goto(`${BASE}/static/gpt-chat.html`, { waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => ({
    aspectRatio: typeof window.currentChatAspectRatio,
    resolution: typeof window.chatResolutionForRequest
  }))).toEqual({ aspectRatio: "function", resolution: "function" });
});

test("shared intake appends batches, rejects overflow atomically, and migrates legacy data stably", async ({ page }) => {
  await mockCanvasListApis(page);
  await page.goto(`${BASE}/static/canvas-list.html`, { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(() => {
    localStorage.removeItem("qcos_canvas_intake_items");
    const intake = window.QCOSCanvasIntake;
    const first = intake.appendBatch([
      { url: "https://example.test/one.png", type: "image" },
      { url: "https://example.test/two.png", type: "output" }
    ]);
    const second = intake.appendBatch([
      { url: "https://example.test/three.png" },
      { url: "https://example.test/four.png" },
      { url: "https://example.test/five.png" }
    ]);
    const queue = intake.readQueue();
    return { first, second, queue, count: intake.countItems(queue.queue) };
  });
  expect(result.first.ok).toBe(true);
  expect(result.second.ok).toBe(true);
  expect(result.queue.queue.batches).toHaveLength(2);
  expect(result.count).toBe(5);

  const overflow = await page.evaluate(() => {
    const intake = window.QCOSCanvasIntake;
    localStorage.removeItem("qcos_canvas_intake_items");
    intake.appendBatch(Array.from({ length: 99 }, (_, index) => ({ url: `https://example.test/${index}.png` })));
    const before = localStorage.getItem("qcos_canvas_intake_items");
    const rejected = intake.appendBatch([
      { url: "https://example.test/overflow-a.png" },
      { url: "https://example.test/overflow-b.png" }
    ]);
    return { rejected, before, after: localStorage.getItem("qcos_canvas_intake_items") };
  });
  expect(overflow.rejected.ok).toBe(false);
  expect(overflow.rejected.error).toContain("100");
  expect(overflow.after).toBe(overflow.before);

  const legacy = await page.evaluate(() => {
    const intake = window.QCOSCanvasIntake;
    localStorage.setItem("qcos_canvas_intake_items", JSON.stringify({
      created_at: 123456,
      items: [{ url: "https://example.test/legacy.png", title: "Legacy" }]
    }));
    const before = localStorage.getItem("qcos_canvas_intake_items");
    const first = intake.readQueue();
    const second = intake.readQueue();
    return {
      firstId: first.queue.batches[0].id,
      secondId: second.queue.batches[0].id,
      after: localStorage.getItem("qcos_canvas_intake_items"),
      before
    };
  });
  expect(legacy.firstId).toBe(legacy.secondId);
  expect(legacy.after).toBe(legacy.before);
});

test("React intake writer uses the same append-only queue contract", async ({ page }) => {
  await mockReactGalleryApis(page);
  await page.goto(`${VITE_BASE}/app/gallery`, { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const intake = await import("/app/src/lib/canvas-intake.ts");
    localStorage.removeItem(intake.CANVAS_INTAKE_STORAGE_KEY);
    const first = intake.writeCanvasIntakeItems([
      { url: "https://example.test/react-a.png", type: "image" },
      { url: "https://example.test/react-b.png", type: "output" }
    ]);
    const second = intake.writeCanvasIntakeItems([
      { url: "https://example.test/react-c.png", type: "image" }
    ]);
    const queue = intake.readCanvasIntakeQueue();
    return {
      firstOk: first.ok,
      secondOk: second.ok,
      batchCount: queue.queue.batches.length,
      itemCount: intake.countCanvasIntakeItems(queue.queue)
    };
  });
  expect(result).toEqual({ firstOk: true, secondOk: true, batchCount: 2, itemCount: 3 });
});

test("Canvas List preserves corrupt intake until explicit cancel", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("qcos_canvas_intake_items", "{broken-json");
    window.__intakeStatuses = [];
    window.addEventListener("qcos:canvas-intake-status", (event) => window.__intakeStatuses.push(event.detail));
  });
  await mockCanvasListApis(page);
  await page.goto(`${BASE}/static/canvas-list.html`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("alert")).toContainText(/损坏|corrupt|invalid/i);
  expect(await page.evaluate(() => localStorage.getItem("qcos_canvas_intake_items"))).toBe("{broken-json");
  await page.getByRole("button", { name: /清空待放置素材|Clear pending assets/i }).click();
  expect(await page.evaluate(() => localStorage.getItem("qcos_canvas_intake_items"))).toBeNull();
  expect(await page.evaluate(() => window.__intakeStatuses.at(-1)?.status)).toBe("cancelled");
});

test("Canvas List keeps intake through refresh and target selection", async ({ page }) => {
  await mockCanvasListApis(page);
  await page.goto(`${BASE}/static/canvas-list.html`, { waitUntil: "domcontentloaded" });
  const raw = JSON.stringify({
    version: 1,
    batches: [{
      id: "batch-target",
      created_at: 123,
      items: [
        { id: "item-a", url: "https://example.test/a.png", type: "image" },
        { id: "item-b", url: "https://example.test/b.png", type: "output" }
      ]
    }]
  });
  await page.evaluate((value) => localStorage.setItem("qcos_canvas_intake_items", value), raw);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#canvasIntakeBar")).toContainText("2");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#canvasIntakeBar")).toContainText("2");

  await page.locator('.ws-card[data-canvas-id="canvas-target"]').click();
  await expect(page).toHaveURL(/\/static\/canvas\.html\?id=canvas-target/);
  expect(await page.evaluate(() => localStorage.getItem("qcos_canvas_intake_items"))).toBe(raw);
});

test("Canvas List can create a Smart target without consuming intake", async ({ page }) => {
  await mockCanvasListApis(page);
  await page.goto(`${BASE}/static/canvas-list.html`, { waitUntil: "domcontentloaded" });
  const raw = JSON.stringify({
    version: 1,
    batches: [{ id: "batch-create", created_at: 123, items: [{ url: "https://example.test/create.png", type: "image" }] }]
  });
  await page.evaluate((value) => localStorage.setItem("qcos_canvas_intake_items", value), raw);
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.locator("#newCanvasBtn").click();
  await page.locator('.ws-create-toggle-btn[data-kind="smart"]').click();
  await page.locator(".ws-create-input").fill("Smart Intake Target");
  await page.getByRole("button", { name: /创建并放置|Create target/i }).click();
  await expect(page).toHaveURL(/\/static\/smart-canvas\.html\?id=created-target/);
  expect(await page.evaluate(() => localStorage.getItem("qcos_canvas_intake_items"))).toBe(raw);
});

test("React reports localStorage failure and does not leave Gallery", async ({ page }) => {
  await mockReactGalleryApis(page);
  await page.goto(`${VITE_BASE}/app/gallery`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Gallery Intake Asset", { exact: true })).toBeVisible();
  await page.getByLabel("Select asset").click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "qcos_canvas_intake_items") throw new DOMException("storage denied", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const before = page.url();
  await page.getByRole("button", { name: "Send to Canvas" }).click();
  await expect(page.getByRole("alert")).toContainText(/storage|保存|写入|failed/i);
  expect(page.url()).toBe(before);
});
