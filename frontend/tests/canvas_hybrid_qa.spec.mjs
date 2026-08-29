import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";

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
