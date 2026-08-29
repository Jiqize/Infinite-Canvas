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

function intakeQueue(batchId = "batch-consumer") {
  return {
    version: 1,
    batches: [{
      id: batchId,
      created_at: 123,
      items: [
        {
          id: "image-a",
          url: "https://example.test/intake-a.png",
          title: "Intake image",
          prompt: "editorial image",
          source: "gallery",
          model: "image-model",
          type: "image",
          width: 1024,
          height: 768,
          created_at: 120
        },
        {
          id: "output-b",
          url: "https://example.test/intake-b.png",
          title: "Intake output",
          prompt: "generated output",
          source: "generate",
          model: "output-model",
          type: "output",
          width: 768,
          height: 1024,
          created_at: 121
        }
      ]
    }]
  };
}

async function seedIntake(page, queue = intakeQueue()) {
  await page.addInitScript((value) => {
    localStorage.setItem("qcos_canvas_intake_items", JSON.stringify(value));
    window.__intakeStatuses = [];
    window.addEventListener("qcos:canvas-intake-status", (event) => window.__intakeStatuses.push(event.detail));
  }, queue);
}

async function mockCanvasConsumerApis(page, {
  kind = "classic",
  canvasOverride = null,
  putStatuses = [200],
  conflictCanvas = null,
  getStatus = 200
} = {}) {
  const captured = { puts: [], metaCalls: 0 };
  const baseCanvas = canvasOverride || {
    id: "qa-canvas",
    title: "Hybrid Canvas QA",
    kind,
    project: "default",
    nodes: [],
    connections: [],
    viewport: { x: 0, y: 0, scale: 1 },
    settings: {},
    logs: [],
    updated_at: 1
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/config") {
      return route.fulfill({ json: {
        api_providers: [{ id: "openai-main", name: "OpenAI", protocol: "openai", enabled: true, has_key: true }],
        comfy_instances: [], image_models: ["image-model"], video_models: []
      } });
    }
    if (path === "/api/providers") return route.fulfill({ json: { providers: [] } });
    if (path === "/api/workflows") return route.fulfill({ json: { workflows: [] } });
    if (path === "/api/canvases/qa-canvas/touch") {
      return route.fulfill({ json: { canvas: { ...baseCanvas, updated_at: 1 } } });
    }
    if (path === "/api/canvases/qa-canvas/meta") {
      captured.metaCalls += 1;
      return route.fulfill({ json: { id: "qa-canvas", updated_at: 1 } });
    }
    if (path === "/api/canvases/qa-canvas" && request.method() === "GET") {
      if (getStatus >= 400) return route.fulfill({ status: getStatus, json: { detail: `mock load ${getStatus}` } });
      return route.fulfill({ json: { canvas: structuredClone(baseCanvas) } });
    }
    if (path === "/api/canvases/qa-canvas" && request.method() === "PUT") {
      const payload = request.postDataJSON();
      captured.puts.push(payload);
      const status = putStatuses[Math.min(captured.puts.length - 1, putStatuses.length - 1)] ?? 200;
      if (status === 409) {
        return route.fulfill({
          status: 409,
          json: { detail: { canvas: { ...(conflictCanvas || baseCanvas), updated_at: 2 }, updated_at: 2 } }
        });
      }
      if (status >= 400) return route.fulfill({ status, json: { detail: `mock save ${status}` } });
      return route.fulfill({ json: { canvas: { ...baseCanvas, ...payload, updated_at: 3 + captured.puts.length } } });
    }
    if (path === "/api/canvases") return route.fulfill({ json: { canvases: [baseCanvas] } });
    if (path === "/api/assets" || path === "/api/local-assets") return route.fulfill({ json: { categories: [], items: [], tree: null } });
    return route.fulfill({ json: {} });
  });
  return captured;
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

test("classic Canvas toolbar fills the row and aligns every control", async ({ page }) => {
  await page.setViewportSize({ width: 1460, height: 810 });
  await mockCanvasConsumerApis(page);
  await page.goto(`${BASE}/static/canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });
  await page.locator("#quickToolbar.collapsed .toolbar-toggle").click();
  await expect(page.locator("#quickToolbar:not(.collapsed)")).toBeVisible();

  const metrics = await page.locator("#quickToolbar").evaluate((toolbar) => {
    const toolbarRect = toolbar.getBoundingClientRect();
    const navRect = document.querySelector(".canvas-nav").getBoundingClientRect();
    const buttons = [...toolbar.querySelectorAll(":scope > .toolbar-toggle, .toolbar-items > .tool-btn, .toolbar-fixed > .tool-btn")]
      .map((button) => button.getBoundingClientRect());
    const heights = buttons.map((rect) => rect.height);
    const tops = buttons.map((rect) => rect.top);
    const items = toolbar.querySelector(".toolbar-items");
    return {
      gapAfterNavigation: toolbarRect.left - navRect.right,
      rightGap: innerWidth - toolbarRect.right,
      heightSpread: Math.max(...heights) - Math.min(...heights),
      topSpread: Math.max(...tops) - Math.min(...tops),
      itemsOverflow: items.scrollWidth > items.clientWidth + 1
    };
  });

  expect(metrics.gapAfterNavigation).toBeLessThanOrEqual(16);
  expect(metrics.rightGap).toBeLessThanOrEqual(26);
  expect(metrics.heightSpread).toBeLessThanOrEqual(0.25);
  expect(metrics.topSpread).toBeLessThanOrEqual(0.25);
  expect(metrics.itemsOverflow).toBe(false);
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

test("legacy advanced settings preserves every unedited provider field", async ({ page }) => {
  const provider = {
    id: "gemini-main",
    name: "Gemini Main",
    base_url: "https://generativelanguage.googleapis.com",
    protocol: "gemini",
    image_request_mode: "openai-responses",
    image_edit_route: "general",
    image_generation_endpoint: "/v1beta/images:generate",
    image_edit_endpoint: "/v1beta/images:edit",
    enabled: true,
    primary: true,
    image_models: ["gemini-image"],
    chat_models: ["gemini-chat"],
    video_models: ["veo-3"],
    model_names: { "gemini-image": "Gemini Image", "future-model": "Future Model" },
    model_protocols: { "gemini-image": "gemini" },
    ms_loras: [{ id: "lora-a", name: "LoRA A", target_model: "gemini-image", strength: 0.8, enabled: true, note: "keep" }],
    ms_defaults_version: 7,
    rh_apps: [{ appId: "app-a", title: "App A" }],
    rh_workflows: [{ workflowId: "flow-a", title: "Flow A" }],
    volcengine_project_name: "project-preserved",
    volcengine_region: "cn-beijing",
    has_key: true,
    key_preview: "saved"
  };
  let savedPayload = null;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/providers" && request.method() === "GET") {
      return route.fulfill({ json: { providers: [structuredClone(provider)] } });
    }
    if (path === "/api/providers" && request.method() === "PUT") {
      savedPayload = request.postDataJSON();
      return route.fulfill({ json: { providers: savedPayload } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto(`${BASE}/static/api-settings.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#nameInput")).toHaveValue("Gemini Main");
  await page.evaluate(() => { window.saveProviders(); });
  await expect.poll(() => savedPayload).not.toBeNull();

  expect(savedPayload[0]).toMatchObject({
    id: "gemini-main",
    protocol: "gemini",
    image_request_mode: "openai-responses",
    image_generation_endpoint: "/v1beta/images:generate",
    image_edit_endpoint: "/v1beta/images:edit",
    primary: true,
    model_names: { "gemini-image": "Gemini Image", "future-model": "Future Model" },
    model_protocols: { "gemini-image": "gemini" },
    ms_loras: [{ id: "lora-a", target_model: "gemini-image", strength: 0.8, note: "keep" }],
    ms_defaults_version: 7,
    volcengine_project_name: "project-preserved",
    volcengine_region: "cn-beijing"
  });
  expect(savedPayload[0].rh_apps[0]).toMatchObject({ appId: "app-a", title: "App A" });
  expect(savedPayload[0].rh_workflows[0]).toMatchObject({ workflowId: "flow-a", title: "Flow A" });
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

test("React intake reader preserves malformed V1 storage", async ({ page }) => {
  await mockReactGalleryApis(page);
  await page.goto(`${VITE_BASE}/app/gallery`, { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async () => {
    const intake = await import("/app/src/lib/canvas-intake.ts");
    const raw = JSON.stringify({
      version: 1,
      batches: [
        { id: "duplicate", created_at: 1, items: [{ url: "https://example.test/a.png" }] },
        { id: "duplicate", created_at: 2, items: [{ url: "https://example.test/b.png" }] }
      ]
    });
    localStorage.setItem(intake.CANVAS_INTAKE_STORAGE_KEY, raw);
    const read = intake.readCanvasIntakeQueue();
    return { ok: read.ok, raw, after: localStorage.getItem(intake.CANVAS_INTAKE_STORAGE_KEY) };
  });
  expect(result.ok).toBe(false);
  expect(result.after).toBe(result.raw);
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

test("shared intake rejects structurally corrupt V1 queues without rewriting them", async ({ page }) => {
  await mockCanvasListApis(page);
  await page.goto(`${BASE}/static/canvas-list.html`, { waitUntil: "domcontentloaded" });
  const malformedQueues = [
    { version: 1, batches: [{ id: "", created_at: 1, items: [{ url: "https://example.test/a.png" }] }] },
    { version: 1, batches: [{ id: "same", created_at: 1, items: [{ url: "https://example.test/a.png" }] }, { id: "same", created_at: 2, items: [{ url: "https://example.test/b.png" }] }] },
    { version: 1, batches: [{ id: "bad-item", created_at: 1, items: [{ title: "missing URL" }] }] }
  ];
  for (const malformed of malformedQueues) {
    const result = await page.evaluate((value) => {
      const raw = JSON.stringify(value);
      localStorage.setItem("qcos_canvas_intake_items", raw);
      const read = window.QCOSCanvasIntake.readQueue();
      return { ok: read.ok, raw, after: localStorage.getItem("qcos_canvas_intake_items") };
    }, malformed);
    expect(result.ok).toBe(false);
    expect(result.after).toBe(result.raw);
  }
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

test("React Gallery defaults to a media-first workspace", async ({ page }) => {
  await mockReactGalleryApis(page);
  await page.goto(`${VITE_BASE}/app/gallery`, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Gallery Intake Asset", { exact: true })).toBeVisible();
  await expect(page.locator(".qc-gallery-filters, .qc-gallery-detail")).toHaveCount(0);
  await expect(page.locator("#gallery-filter-panel")).toHaveCount(0);
  await expect(page.locator(".qc-gallery-inspector")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send to Canvas" })).toHaveCount(0);

  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.locator("#gallery-filter-panel select")).toHaveCount(6);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.locator("#gallery-filter-panel")).toHaveCount(0);

  await page.getByRole("button", { name: "Inspect Gallery Intake Asset" }).click();
  await expect(page.locator(".qc-gallery-inspector")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".qc-gallery-inspector")).toHaveCount(0);

  await page.getByLabel("Select asset").click();
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download selected" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send to Canvas" })).toBeVisible();
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

test("classic Canvas persists intake as image/output nodes before clearing batches", async ({ page }) => {
  await seedIntake(page);
  const captured = await mockCanvasConsumerApis(page, { kind: "classic" });
  await page.goto(`${BASE}/static/canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });

  await expect.poll(() => captured.puts.length).toBe(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("qcos_canvas_intake_items"))).toBeNull();
  const intakeNodes = captured.puts[0].nodes.filter((node) => node.qcos_intake_batch_id === "batch-consumer");
  expect(intakeNodes.map((node) => node.type)).toEqual(["image", "output"]);
  expect(intakeNodes.map((node) => node.qcos_intake_item_id)).toEqual([
    "batch-consumer:image-a:0",
    "batch-consumer:output-b:1"
  ]);
  expect(intakeNodes[0]).toMatchObject({
    url: "https://example.test/intake-a.png", prompt: "editorial image", source: "gallery", model: "image-model", width: 1024, height: 768
  });
  expect(intakeNodes[1].images[0]).toMatchObject({
    url: "https://example.test/intake-b.png", prompt: "generated output", source: "generate", model: "output-model", width: 768, height: 1024
  });
  expect(await page.evaluate(() => window.__intakeStatuses.map((entry) => entry.status))).toEqual(expect.arrayContaining(["saving", "succeeded"]));
});

test("smart Canvas persists both intake kinds as smart-image nodes", async ({ page }) => {
  await seedIntake(page);
  const captured = await mockCanvasConsumerApis(page, { kind: "smart" });
  await page.goto(`${BASE}/static/smart-canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });

  await expect.poll(() => captured.puts.length).toBe(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("qcos_canvas_intake_items"))).toBeNull();
  const intakeNodes = captured.puts[0].nodes.filter((node) => node.qcos_intake_batch_id === "batch-consumer");
  expect(intakeNodes).toHaveLength(2);
  expect(intakeNodes.every((node) => node.type === "smart-image")).toBe(true);
  expect(intakeNodes.map((node) => node.qcos_intake_item_id)).toEqual([
    "batch-consumer:image-a:0",
    "batch-consumer:output-b:1"
  ]);
  expect(intakeNodes[1].images[0]).toMatchObject({
    url: "https://example.test/intake-b.png", prompt: "generated output", source: "generate", model: "output-model"
  });
});

for (const kind of ["classic", "smart"]) {
  test(`${kind} Canvas retains intake and exposes a visible save error`, async ({ page }) => {
    await seedIntake(page);
    const captured = await mockCanvasConsumerApis(page, { kind, putStatuses: [500] });
    const filename = kind === "smart" ? "smart-canvas.html" : "canvas.html";
    await page.goto(`${BASE}/static/${filename}?id=qa-canvas`, { waitUntil: "domcontentloaded" });

    await expect.poll(() => captured.puts.length).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem("qcos_canvas_intake_items"))).not.toBeNull();
    if (kind === "classic") await expect(page.locator("#errorModal.open")).toContainText(/save|保存/i);
    else await expect(page.locator("#toast.show")).toContainText(/save|保存/i);
    expect(await page.evaluate(() => window.__intakeStatuses.at(-1)?.status)).toBe("failed");
  });

  test(`${kind} Canvas retries a 409 without duplicating intake nodes`, async ({ page }) => {
    await seedIntake(page);
    const remoteNode = kind === "smart"
      ? { id: "remote-only", type: "smart-image", x: 800, y: 120, title: "Remote", images: [{ url: "https://example.test/remote.png" }] }
      : { id: "remote-only", type: "image", x: 800, y: 120, title: "Remote", url: "https://example.test/remote.png" };
    const captured = await mockCanvasConsumerApis(page, {
      kind,
      putStatuses: [409, 200],
      conflictCanvas: {
        id: "qa-canvas", title: "Remote Canvas", kind, project: "default",
        nodes: [remoteNode], connections: [], viewport: { x: 0, y: 0, scale: 1 }, settings: {}, logs: [], updated_at: 2
      }
    });
    const filename = kind === "smart" ? "smart-canvas.html" : "canvas.html";
    await page.goto(`${BASE}/static/${filename}?id=qa-canvas`, { waitUntil: "domcontentloaded" });

    await expect.poll(() => captured.puts.length).toBe(2);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("qcos_canvas_intake_items"))).toBeNull();
    const lastNodes = captured.puts.at(-1).nodes.filter((node) => node.qcos_intake_batch_id === "batch-consumer");
    expect(lastNodes).toHaveLength(2);
    expect(new Set(lastNodes.map((node) => node.qcos_intake_item_id)).size).toBe(2);
    expect(captured.puts.at(-1).nodes.some((node) => node.id === "remote-only")).toBe(true);
  });
}

test("Smart Canvas exposes a load failure and retains queued intake", async ({ page }) => {
  await seedIntake(page, intakeQueue("batch-load-failure"));
  const captured = await mockCanvasConsumerApis(page, { kind: "smart", getStatus: 500 });
  await page.goto(`${BASE}/static/smart-canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });

  await expect(page.locator("#toast.show")).toContainText(/mock load 500|加载|load/i);
  expect(captured.puts).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem("qcos_canvas_intake_items"))).not.toBeNull();
  expect(await page.evaluate(() => window.__intakeStatuses.at(-1)?.status)).toBe("failed");
});

test("saved intake markers clear a replayed batch without inserting or saving again", async ({ page }) => {
  const queue = intakeQueue("batch-replayed");
  const markedNodes = queue.batches[0].items.map((item, index) => ({
    id: `saved-${index}`,
    type: item.type === "output" ? "output" : "image",
    x: 40 + index * 60,
    y: 40 + index * 60,
    url: item.url,
    images: item.type === "output" ? [{ url: item.url }] : undefined,
    qcos_intake_batch_id: "batch-replayed",
    qcos_intake_item_id: `batch-replayed:${item.id}:${index}`
  }));
  await seedIntake(page, queue);
  const captured = await mockCanvasConsumerApis(page, {
    kind: "classic",
    canvasOverride: {
      id: "qa-canvas", title: "Replay QA", kind: "classic", project: "default",
      nodes: markedNodes, connections: [], viewport: { x: 0, y: 0, scale: 1 }, settings: {}, logs: [], updated_at: 5
    }
  });
  await page.goto(`${BASE}/static/canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });

  await expect.poll(() => page.evaluate(() => localStorage.getItem("qcos_canvas_intake_items"))).toBeNull();
  expect(captured.puts).toHaveLength(0);
  expect(await page.locator('[data-id^="saved-"]').count()).toBe(2);
});

test("Smart Canvas clears a replayed marked batch without duplicate insertion", async ({ page }) => {
  const queue = intakeQueue("batch-smart-replayed");
  const markedNodes = queue.batches[0].items.map((item, index) => ({
    id: `smart-saved-${index}`,
    type: "smart-image",
    x: 40 + index * 60,
    y: 40 + index * 60,
    title: item.title,
    images: [{ url: item.url, name: item.title }],
    qcos_intake_batch_id: "batch-smart-replayed",
    qcos_intake_item_id: `batch-smart-replayed:${item.id}:${index}`
  }));
  await seedIntake(page, queue);
  const captured = await mockCanvasConsumerApis(page, {
    kind: "smart",
    canvasOverride: {
      id: "qa-canvas", title: "Smart Replay QA", kind: "smart", project: "default",
      nodes: markedNodes, connections: [], viewport: { x: 0, y: 0, scale: 1 }, settings: {}, logs: [], updated_at: 5
    }
  });
  await page.goto(`${BASE}/static/smart-canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });

  await expect.poll(() => page.evaluate(() => localStorage.getItem("qcos_canvas_intake_items"))).toBeNull();
  expect(captured.puts).toHaveLength(0);
  expect(await page.locator('[data-id^="smart-saved-"]').count()).toBe(2);
});

test("canvas-active pauses classic metadata polling, ignores forged messages, and resumes immediately", async ({ page }) => {
  const captured = await mockCanvasConsumerApis(page, { kind: "classic" });
  await page.goto(`${BASE}/static/canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2700);
  expect(captured.metaCalls).toBeGreaterThan(0);

  await page.evaluate(() => window.postMessage({ type: "canvas-active", active: false }, window.location.origin));
  const pausedAt = captured.metaCalls;
  await page.waitForTimeout(2800);
  expect(captured.metaCalls).toBe(pausedAt);

  await page.evaluate(() => window.dispatchEvent(new MessageEvent("message", {
    data: { type: "canvas-active", active: true },
    origin: "https://forged.example.test",
    source: window
  })));
  await page.waitForTimeout(300);
  expect(captured.metaCalls).toBe(pausedAt);

  await page.evaluate(() => {
    const unknownFrame = document.createElement("iframe");
    unknownFrame.name = "unknown-message-source";
    unknownFrame.src = "about:blank";
    document.body.appendChild(unknownFrame);
  });
  const unknownFrame = page.frames().find((frame) => frame.name() === "unknown-message-source");
  await unknownFrame.evaluate((origin) => window.parent.postMessage({ type: "canvas-active", active: true }, origin), BASE);
  await page.waitForTimeout(300);
  expect(captured.metaCalls).toBe(pausedAt);

  await page.evaluate(() => window.postMessage({ type: "canvas-active", active: true }, window.location.origin));
  await expect.poll(() => captured.metaCalls).toBeGreaterThan(pausedAt);
});

test("canvas-active pauses and immediately resumes Smart Canvas metadata polling", async ({ page }) => {
  const captured = await mockCanvasConsumerApis(page, { kind: "smart" });
  await page.goto(`${BASE}/static/smart-canvas.html?id=qa-canvas`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.postMessage({ type: "canvas-active", active: false }, window.location.origin));
  const pausedAt = captured.metaCalls;
  await page.waitForTimeout(400);
  expect(captured.metaCalls).toBe(pausedAt);

  await page.evaluate(() => window.postMessage({ type: "canvas-active", active: true }, window.location.origin));
  await expect.poll(() => captured.metaCalls).toBeGreaterThan(pausedAt);
});

test("React Canvas route loads only the embedded legacy workspace and a compact intake rail", async ({ page }) => {
  await seedIntake(page, intakeQueue("batch-react-shell"));
  await mockCanvasListApis(page);
  await page.goto(`${VITE_BASE}/app/canvas`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('iframe[data-route="canvas"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Open Creation Rail" }).click();
  await expect(page.getByRole("complementary", { name: "Creation Rail" })).toContainText(/2 pending|2 待处理/i);
  await expect(page.getByRole("button", { name: /Advanced settings|高级设置/i })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Creation Rail" })).not.toContainText(/Nodes|Links|Run mode|Exec kind/i);
  expect(await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name).some((name) => name.includes("CanvasWorkspace")))).toBe(false);

  const canvasFrame = page.frames().find((frame) => frame.url().includes("/static/canvas-list.html"));
  expect(canvasFrame).toBeTruthy();
  await canvasFrame.evaluate(() => window.parent.postMessage({
    type: "canvas-intake-status", status: "saving", batch_ids: ["batch-react-shell"], item_count: 2, detail: "Saving Canvas intake"
  }, window.location.origin));
  await expect(page.getByRole("complementary", { name: "Creation Rail" })).toContainText("saving");

  await page.evaluate(() => window.postMessage({
    type: "canvas-intake-status", status: "failed", batch_ids: [], item_count: 0, detail: "forged source"
  }, window.location.origin));
  await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-route="canvas"]');
    window.dispatchEvent(new MessageEvent("message", {
      data: { type: "canvas-intake-status", status: "failed", batch_ids: [], item_count: 0, detail: "forged origin" },
      origin: "https://forged.example.test",
      source: frame.contentWindow
    }));
  });
  await expect(page.getByRole("complementary", { name: "Creation Rail" })).toContainText("saving");
});
