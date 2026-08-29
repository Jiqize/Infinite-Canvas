import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:5173";

test.setTimeout(30000);

function richProvider(overrides = {}) {
  return {
    id: "gemini-main",
    name: "Gemini Main",
    base_url: "https://generativelanguage.googleapis.com",
    protocol: "gemini",
    image_request_mode: "openai-responses",
    image_generation_endpoint: "/v1beta/images:generate",
    image_edit_endpoint: "/v1beta/images:edit",
    enabled: true,
    primary: true,
    image_models: ["gemini-image"],
    chat_models: ["gemini-2.5-pro"],
    video_models: ["veo-3"],
    model_names: { "gemini-image": "Gemini Image" },
    model_protocols: { "gemini-image": "gemini" },
    ms_loras: [{ model_id: "fashion/lora", weight: 0.75 }],
    ms_defaults_version: 7,
    rh_apps: [{ webappId: "rh-app-1", title: "App One" }],
    rh_workflows: [{ workflowId: "rh-flow-1", title: "Flow One" }],
    volcengine_project_name: "project-preserved",
    volcengine_region: "cn-beijing",
    has_key: true,
    key_preview: "sk-***test",
    key_env: "GEMINI_MAIN_API_KEY",
    ...overrides
  };
}

async function mockShellApis(page, onSave = () => {}, provider = richProvider(), onConfig = () => {}) {
  await page.route("**/static/api-settings.html", (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><html><body><h1>Advanced provider settings</h1></body></html>"
  }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/config") {
      onConfig();
      return route.fulfill({ json: {
        base_url: provider.base_url,
        chat_model: provider.chat_models[0],
        image_model: provider.image_models[0],
        chat_models: provider.chat_models,
        image_models: provider.image_models,
        video_models: provider.video_models,
        has_api_key: true,
        has_ms_key: false,
        api_providers: [provider],
        primary_provider_id: provider.id
      } });
    }
    if (url.pathname === "/api/providers" && request.method() === "GET") {
      return route.fulfill({ json: { providers: [provider], primary_provider_id: provider.id } });
    }
    if (url.pathname === "/api/providers" && request.method() === "PUT") {
      const payload = request.postDataJSON();
      onSave(payload);
      return route.fulfill({ json: {
        providers: payload.map((item) => ({ ...item, has_key: true, key_preview: provider.key_preview, key_env: provider.key_env })),
        primary_provider_id: provider.id
      } });
    }
    if (url.pathname.includes("queue")) return route.fulfill({ json: { total: 0, position: 0, status: "idle" } });
    if (url.pathname.includes("gallery")) return route.fulfill({ json: { assets: [], total: 0 } });
    return route.fulfill({ json: {} });
  });
}

test("React keeps provider protocol and advanced fields on a common-field save", async ({ page }) => {
  let savedPayload = null;
  await mockShellApis(page, (payload) => { savedPayload = payload; });
  await page.goto(`${BASE}/app/api-models`, { waitUntil: "domcontentloaded" });

  await expect(page.getByLabel("Protocol")).toHaveValue("gemini");
  await expect(page.getByLabel("Image request mode")).toHaveValue("openai-responses");
  expect(await page.getByLabel("Protocol").locator("option").evaluateAll((options) => options.map((option) => option.value))).toEqual([
    "openai", "apimart", "gemini", "gemini-cli", "volcengine", "runninghub", "jimeng", "codex"
  ]);
  expect(await page.getByLabel("Image request mode").locator("option").evaluateAll((options) => options.map((option) => option.value))).toEqual([
    "openai", "openai-json", "openai-video-proxy", "openai-responses", "tudou-async"
  ]);
  await page.getByLabel("Name").fill("Gemini Renamed");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByLabel("Provider diagnostics").getByText("Saved", { exact: true })).toBeVisible();

  expect(savedPayload).not.toBeNull();
  expect(savedPayload[0]).toMatchObject({
    name: "Gemini Renamed",
    protocol: "gemini",
    image_request_mode: "openai-responses",
    model_names: { "gemini-image": "Gemini Image" },
    model_protocols: { "gemini-image": "gemini" },
    ms_loras: [{ model_id: "fashion/lora", weight: 0.75 }],
    ms_defaults_version: 7,
    rh_apps: [{ webappId: "rh-app-1", title: "App One" }],
    rh_workflows: [{ workflowId: "rh-flow-1", title: "Flow One" }],
    volcengine_project_name: "project-preserved",
    volcengine_region: "cn-beijing"
  });
});

test("legacy Tudou protocol remains visible and round-trips without becoming selectable", async ({ page }) => {
  let savedPayload = null;
  const provider = richProvider({ protocol: "tudou", image_request_mode: "tudou-async" });
  await mockShellApis(page, (payload) => { savedPayload = payload; }, provider);
  await page.goto(`${BASE}/app/api-models`, { waitUntil: "domcontentloaded" });

  await expect(page.getByLabel("Protocol")).toHaveValue("tudou");
  expect(await page.getByLabel("Protocol").locator('option[value="tudou"]').evaluate((option) => option.disabled)).toBe(true);
  await page.getByLabel("Name").fill("Legacy Tudou Renamed");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => savedPayload).not.toBeNull();
  expect(savedPayload[0].protocol).toBe("tudou");
  expect(savedPayload[0].image_request_mode).toBe("tudou-async");
});

test("invalid advanced field types fail visibly instead of being rewritten", async ({ page }) => {
  await mockShellApis(page, () => {}, richProvider({ ms_loras: { invalid: true } }));
  await page.goto(`${BASE}/app/api-models`, { waitUntil: "domcontentloaded" });

  await expect(page.getByLabel("Provider diagnostics")).toContainText("ms_loras must be an array of objects");
  await expect(page.getByText("No providers configured", { exact: true })).toBeVisible();
});

test("advanced provider settings is hidden, highlights API, and is not kept alive", async ({ page }) => {
  await mockShellApis(page);
  await page.goto(`${BASE}/app/provider-settings`, { waitUntil: "domcontentloaded" });

  const advancedFrame = page.locator('iframe[data-route="provider-settings"]');
  await expect(advancedFrame).toBeVisible();
  await expect(page.locator('.qc-sidebar .qc-nav-item.is-active')).toContainText("API / Models");
  await expect(page.locator('.qc-sidebar')).not.toContainText("Advanced Provider Settings");

  await page.getByRole("button", { name: "API / Models" }).click();
  await expect(page).toHaveURL(`${BASE}/app/api-models`);
  await expect(page.locator('iframe[data-route="provider-settings"]')).toHaveCount(0);
});

test("provider change messages require the same origin and a known embedded frame", async ({ page }) => {
  let configReads = 0;
  await mockShellApis(page, () => {}, richProvider(), () => { configReads += 1; });
  await page.goto(`${BASE}/app/provider-settings`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('iframe[data-route="provider-settings"]')).toBeVisible();
  await expect.poll(() => configReads).toBeGreaterThan(0);
  await page.waitForTimeout(100);
  const initialReads = configReads;

  await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-route="provider-settings"]');
    const rogueFrame = document.createElement("iframe");
    rogueFrame.dataset.testRogueFrame = "true";
    document.body.appendChild(rogueFrame);
    window.dispatchEvent(new MessageEvent("message", {
      data: { type: "providers-changed" },
      origin: "https://evil.example",
      source: frame.contentWindow
    }));
    window.dispatchEvent(new MessageEvent("message", {
      data: { type: "providers-changed" },
      origin: window.location.origin,
      source: rogueFrame.contentWindow
    }));
  });
  await page.waitForTimeout(100);
  expect(configReads).toBe(initialReads);

  await page.frameLocator('iframe[data-route="provider-settings"]').locator("body").evaluate(() => {
    window.parent.postMessage({ type: "providers-changed" }, window.location.origin);
  });
  await expect.poll(() => configReads).toBeGreaterThan(initialReads);
});
