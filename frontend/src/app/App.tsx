import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_ROUTES, appPathForRoute, normalizedAppPathForLocation, routeFromLocation, type AppRoute } from "./routes";
import { CreationRail } from "../components/creation-rail/CreationRail";
import { MobileNav } from "../components/shell/MobileNav";
import { Sidebar } from "../components/shell/Sidebar";
import { TopBar } from "../components/shell/TopBar";
import { GenerateWorkspace, type GenerateTaskSummary } from "../features/generate/GenerateWorkspace";
import { EnhanceWorkspace, type EnhanceTaskSummary } from "../features/enhance/EnhanceWorkspace";
import { EditWorkspace, type EditInputSummary, type EditTaskSummary } from "../features/edit/EditWorkspace";
import { OnlineWorkspace, type OnlineTaskSummary } from "../features/online/OnlineWorkspace";
import { AngleWorkspace, type AngleRailContext, type AngleTaskSummary } from "../features/angle/AngleWorkspace";
import { ChatWorkspace, type ChatTaskSummary } from "../features/chat/ChatWorkspace";
import { GalleryWorkspace, type GalleryTaskSummary } from "../features/gallery/GalleryWorkspace";
import { ApiModelsWorkspace, type ApiModelsRailContext, type ApiModelsTaskSummary } from "../features/api-models/ApiModelsWorkspace";
import { ComfyUIWorkspace, type ComfyUIRailContext, type ComfyUITaskSummary } from "../features/comfyui/ComfyUIWorkspace";
import { EmbeddedWorkbench } from "../features/embedded/EmbeddedWorkbench";
import {
  getApiConfig,
  getQueueStatus,
  getRecentAssets,
  type ApiConfig,
  type GalleryAsset,
  type GenerateRecord,
  type QueueStatus
} from "../lib/api";
import { providerStatusFromConfig } from "../lib/provider-status";
import { getOrCreateClientId } from "../lib/storage";
import { connectTaskStream } from "../lib/task-stream";
import type { CreationTaskSummary } from "../lib/creation-state";
import { applyTheme, readStoredTheme, type ThemeName } from "../lib/theme";
import {
  CANVAS_INTAKE_EVENT,
  CANVAS_INTAKE_STATUS_EVENT,
  CANVAS_INTAKE_STORAGE_KEY,
  countCanvasIntakeItems,
  galleryAssetToCanvasIntakeItem,
  generateRecordToCanvasIntakeItem,
  readCanvasIntakeQueue,
  writeCanvasIntakeItems,
  type CanvasIntakeItem,
  type CanvasIntakeStatus
} from "../lib/canvas-intake";

interface CanvasIntakeStatusMessage {
  type: "canvas-intake-status";
  status: CanvasIntakeStatus;
  batch_ids: string[];
  item_count: number;
  detail: string;
}

export function App() {
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => routeFromLocation());
  const [theme, setTheme] = useState<ThemeName>(() => readStoredTheme());
  const [clientId] = useState(() => getOrCreateClientId());
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [wsState, setWsState] = useState<"connecting" | "open" | "closed" | "error">("closed");
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [apiConfigFailed, setApiConfigFailed] = useState(false);
  const [recentAssets, setRecentAssets] = useState<GalleryAsset[]>([]);
  const [railOpen, setRailOpen] = useState(false);
  const [taskMessage, setTaskMessage] = useState<unknown>(null);
  const [generateTask, setGenerateTask] = useState<GenerateTaskSummary>({
    status: "idle",
    label: "Generate ready",
    detail: "No active Generate task"
  });
  const [generateOutputs, setGenerateOutputs] = useState<GenerateRecord[]>([]);
  const [enhanceTask, setEnhanceTask] = useState<EnhanceTaskSummary>({
    status: "idle",
    label: "Enhance ready",
    detail: "No active Enhance task"
  });
  const [enhanceOutputs, setEnhanceOutputs] = useState<GenerateRecord[]>([]);
  const [editTask, setEditTask] = useState<EditTaskSummary>({
    status: "idle",
    label: "Edit ready",
    detail: "No active Edit task"
  });
  const [editOutputs, setEditOutputs] = useState<GenerateRecord[]>([]);
  const [editContext, setEditContext] = useState("Select an input image and prompt to show Edit context.");
  const [editInput, setEditInput] = useState<EditInputSummary | null>(null);
  const [onlineTask, setOnlineTask] = useState<OnlineTaskSummary>({
    status: "idle",
    label: "Online ready",
    detail: "No active Online task"
  });
  const [onlineOutputs, setOnlineOutputs] = useState<GenerateRecord[]>([]);
  const [angleTask, setAngleTask] = useState<AngleTaskSummary>({
    status: "idle",
    label: "Angle ready",
    detail: "No active Angle task"
  });
  const [angleOutputs, setAngleOutputs] = useState<GenerateRecord[]>([]);
  const [angleContext, setAngleContext] = useState<AngleRailContext>({
    engine: "Local ComfyUI",
    rotation: 0,
    pitch: 0,
    distance: 4,
    prompt: "",
    status: "idle",
    detail: "Upload a source image to run Angle."
  });
  const [chatTask, setChatTask] = useState<ChatTaskSummary>({
    status: "idle",
    label: "Chat ready",
    detail: "No active Chat request"
  });
  const [chatOutputs, setChatOutputs] = useState<GenerateRecord[]>([]);
  const [chatContext, setChatContext] = useState("Select a conversation to show Chat context.");
  const [galleryTask, setGalleryTask] = useState<GalleryTaskSummary>({
    status: "idle",
    label: "Gallery ready",
    detail: "No asset selected"
  });
  const [gallerySelectedAssets, setGallerySelectedAssets] = useState<GalleryAsset[]>([]);
  const [canvasTask, setCanvasTask] = useState<CreationTaskSummary>({
    status: "idle",
    label: "Canvas ready",
    detail: "No canvas selected"
  });
  const [canvasIntakeError, setCanvasIntakeError] = useState("");
  const [canvasIntakeCount, setCanvasIntakeCount] = useState(() => {
    const intake = readCanvasIntakeQueue();
    return intake.ok ? countCanvasIntakeItems(intake.queue) : 0;
  });
  const [canvasIntakeStatus, setCanvasIntakeStatus] = useState<CanvasIntakeStatus>(() => canvasIntakeCount ? "queued" : "succeeded");
  const [apiModelsTask, setApiModelsTask] = useState<ApiModelsTaskSummary>({
    status: "idle",
    label: "API providers ready",
    detail: "No provider selected"
  });
  const [apiModelsContext, setApiModelsContext] = useState<ApiModelsRailContext>({
    providerName: "No provider",
    providerId: "",
    enabled: false,
    primary: false,
    hasKey: false,
    keyPreview: "no key",
    protocol: "",
    baseUrl: "",
    imageModelCount: 0,
    chatModelCount: 0,
    videoModelCount: 0,
    loraCount: 0,
    lastAction: "Load providers",
    lastStatus: "Idle",
    detail: "Open API / Models to inspect provider configuration."
  });
  const [comfyUITask, setComfyUITask] = useState<ComfyUITaskSummary>({
    status: "idle",
    label: "ComfyUI ready",
    detail: "No workflow selected"
  });
  const [comfyUIContext, setComfyUIContext] = useState<ComfyUIRailContext>({
    instanceCount: 0,
    primaryInstance: "",
    selectedWorkflow: "",
    workflowTitle: "No workflow",
    builtin: false,
    fieldCount: 0,
    nodeCount: 0,
    lastAction: "Load settings",
    lastStatus: "Idle",
    testStatus: "idle",
    lastOutputCount: 0,
    detail: "Open ComfyUI to inspect workflow settings."
  });

  const providerStatus = useMemo(
    () => providerStatusFromConfig(apiConfig, apiConfigFailed),
    [apiConfig, apiConfigFailed]
  );
  const embeddedRoutes = useMemo(() => APP_ROUTES.filter((route) => route.kind === "embedded"), []);
  const canvasRoute = useMemo(() => APP_ROUTES.find((route) => route.id === "canvas"), []);
  const advancedProviderRoute = useMemo(() => APP_ROUTES.find((route) => route.id === "provider-settings"), []);

  const refreshApiConfig = useCallback((signal?: AbortSignal) => {
    getApiConfig(signal)
      .then((config) => {
        setApiConfig(config);
        setApiConfigFailed(false);
      })
      .catch(() => {
        if (!signal?.aborted) setApiConfigFailed(true);
      });
  }, []);

  const refreshQueue = useCallback((signal?: AbortSignal) => {
    getQueueStatus(clientId, signal)
      .then(setQueueStatus)
      .catch(() => {
        if (!signal?.aborted) {
          setQueueStatus({ total: 0, position: 0, status: "offline" });
        }
      });
  }, [clientId]);

  const refreshAssets = useCallback((signal?: AbortSignal) => {
    getRecentAssets(signal)
      .then((response) => setRecentAssets(response.assets || []))
      .catch(() => {
        if (!signal?.aborted) setRecentAssets([]);
      });
  }, []);

  useEffect(() => {
    applyTheme(theme, true);
  }, [theme]);

  useEffect(() => {
    const abort = new AbortController();
    refreshApiConfig(abort.signal);
    refreshQueue(abort.signal);
    refreshAssets(abort.signal);
    const queueTimer = window.setInterval(() => refreshQueue(), 2000);
    const configTimer = window.setInterval(() => refreshApiConfig(), 15000);
    const assetTimer = window.setInterval(() => refreshAssets(), 20000);
    return () => {
      abort.abort();
      window.clearInterval(queueTimer);
      window.clearInterval(configTimer);
      window.clearInterval(assetTimer);
    };
  }, [refreshApiConfig, refreshAssets, refreshQueue]);

  useEffect(() => {
    return connectTaskStream(clientId, {
      onOnlineCount: setOnlineCount,
      onTaskMessage: (message) => {
        setTaskMessage(message);
        refreshQueue();
        refreshAssets();
      },
      onStateChange: setWsState
    });
  }, [clientId, refreshAssets, refreshQueue]);

  useEffect(() => {
    const syncRouteFromLocation = () => {
      const normalizedPath = normalizedAppPathForLocation();
      const nextRoute = routeFromLocation();
      setActiveRoute(nextRoute);
      if (normalizedPath && window.location.pathname !== normalizedPath) {
        window.history.replaceState({}, "", normalizedPath);
      }
    };
    syncRouteFromLocation();
    const onPopState = syncRouteFromLocation;
    const onStorage = (event: StorageEvent) => {
      if (event.key === "studio_theme" || event.key === "canvas_theme") {
        setTheme(readStoredTheme());
      }
      if (event.key?.includes("token") || event.key === "provider_model_keys") {
        refreshApiConfig();
      }
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window) return;
      if (event.data?.type === "api-config-updated" || event.data?.type === "providers-changed") {
        refreshApiConfig();
      }
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
    };
  }, [refreshApiConfig]);

  const navigate = useCallback((route: AppRoute) => {
    setActiveRoute(route);
    const nextPath = appPathForRoute(route);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const refreshCanvasIntake = useCallback(() => {
    const intake = readCanvasIntakeQueue();
    if (!intake.ok) {
      setCanvasIntakeCount(0);
      setCanvasIntakeError(intake.error);
      setCanvasIntakeStatus("failed");
      setCanvasTask({ status: "failed", label: "Canvas intake failed", detail: intake.error, error: intake.error });
      return;
    }
    setCanvasIntakeCount(countCanvasIntakeItems(intake.queue));
  }, []);

  const handleCanvasIntakeStatus = useCallback((message: CanvasIntakeStatusMessage) => {
    setCanvasIntakeStatus(message.status);
    refreshCanvasIntake();
    const detail = message.detail || `${message.item_count || 0} Canvas item${message.item_count === 1 ? "" : "s"}`;
    if (message.status === "failed") {
      setCanvasIntakeError(detail);
      setCanvasTask({ status: "failed", label: "Canvas intake failed", detail, error: detail });
      return;
    }
    setCanvasIntakeError("");
    if (message.status === "saving") {
      setCanvasTask({ status: "running", label: "Saving Canvas intake", detail });
    } else if (message.status === "queued") {
      setCanvasTask({ status: "pending", label: "Canvas intake queued", detail });
    } else if (message.status === "succeeded") {
      setCanvasTask({ status: "succeeded", label: "Canvas intake saved", detail });
    } else {
      setCanvasTask({ status: "idle", label: "Canvas intake cancelled", detail });
    }
  }, [refreshCanvasIntake]);

  useEffect(() => {
    const onQueue = () => refreshCanvasIntake();
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<CanvasIntakeStatusMessage>).detail;
      if (detail?.type === "canvas-intake-status") handleCanvasIntakeStatus(detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === CANVAS_INTAKE_STORAGE_KEY) refreshCanvasIntake();
    };
    window.addEventListener(CANVAS_INTAKE_EVENT, onQueue);
    window.addEventListener(CANVAS_INTAKE_STATUS_EVENT, onStatus);
    window.addEventListener("storage", onStorage);
    refreshCanvasIntake();
    return () => {
      window.removeEventListener(CANVAS_INTAKE_EVENT, onQueue);
      window.removeEventListener(CANVAS_INTAKE_STATUS_EVENT, onStatus);
      window.removeEventListener("storage", onStorage);
    };
  }, [handleCanvasIntakeStatus, refreshCanvasIntake]);

  const sendCanvasIntake = useCallback((items: CanvasIntakeItem[], detail: string) => {
    if (!canvasRoute) return;
    const queued = writeCanvasIntakeItems(items);
    if (!queued.ok) {
      const message = queued.error || "Canvas intake failed.";
      setCanvasIntakeError(message);
      setCanvasTask({ status: "failed", label: "Canvas intake failed", detail: message, error: message });
      return;
    }
    setCanvasIntakeError("");
    setCanvasIntakeCount(queued.queue ? countCanvasIntakeItems(queued.queue) : items.length);
    setCanvasIntakeStatus("queued");
    setCanvasTask({
      status: "pending",
      label: "Canvas intake queued",
      detail
    });
    setRailOpen(false);
    navigate(canvasRoute);
  }, [canvasRoute, navigate]);

  const sendGalleryAssetsToCanvas = useCallback((assets: GalleryAsset[]) => {
    const items = assets.map(galleryAssetToCanvasIntakeItem).filter((item): item is CanvasIntakeItem => Boolean(item));
    sendCanvasIntake(items, `${items.length} Gallery asset${items.length === 1 ? "" : "s"} queued`);
  }, [sendCanvasIntake]);

  const sendRecentAssetToCanvas = useCallback((asset: GalleryAsset) => {
    const item = galleryAssetToCanvasIntakeItem(asset);
    if (item) sendCanvasIntake([item], "Recent asset queued for Canvas");
  }, [sendCanvasIntake]);

  const sendOutputToCanvas = useCallback((record: GenerateRecord) => {
    const item = generateRecordToCanvasIntakeItem(record);
    if (item) sendCanvasIntake([item], "Generated output queued for Canvas");
  }, [sendCanvasIntake]);

  return (
    <div className="qc-app-shell">
      <Sidebar
        routes={APP_ROUTES}
        activeRoute={activeRoute}
        apiReady={providerStatus.configured}
        onNavigate={navigate}
      />
      <div className="qc-main">
        <TopBar
          activeRoute={activeRoute}
          queueStatus={queueStatus}
          onlineCount={onlineCount}
          wsState={wsState}
          apiConfig={apiConfig}
          providerStatus={providerStatus}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenRail={() => setRailOpen(true)}
        />
        {canvasIntakeError ? (
          <div className="qc-canvas-intake-alert" role="alert">
            <span>{canvasIntakeError}</span>
            <button type="button" aria-label="Dismiss Canvas intake error" onClick={() => setCanvasIntakeError("")}>×</button>
          </div>
        ) : null}
        {activeRoute.kind === "native-generate" ? (
          <div className="qc-workbench qc-workbench--native">
            <GenerateWorkspace
              clientId={clientId}
              apiConfig={apiConfig}
              providerStatus={providerStatus}
              queueStatus={queueStatus}
              taskMessage={taskMessage}
              onTaskChange={setGenerateTask}
              onOutputsChange={setGenerateOutputs}
            />
          </div>
        ) : activeRoute.kind === "native-enhance" ? (
          <div className="qc-workbench qc-workbench--native">
            <EnhanceWorkspace
              clientId={clientId}
              apiConfig={apiConfig}
              providerStatus={providerStatus}
              queueStatus={queueStatus}
              taskMessage={taskMessage}
              onTaskChange={setEnhanceTask}
              onOutputsChange={setEnhanceOutputs}
            />
          </div>
        ) : activeRoute.kind === "native-edit" ? (
          <div className="qc-workbench qc-workbench--native">
            <EditWorkspace
              clientId={clientId}
              apiConfig={apiConfig}
              providerStatus={providerStatus}
              queueStatus={queueStatus}
              taskMessage={taskMessage}
              onTaskChange={setEditTask}
              onOutputsChange={setEditOutputs}
              onContextChange={setEditContext}
              onInputChange={setEditInput}
            />
          </div>
        ) : activeRoute.kind === "native-online" ? (
          <div className="qc-workbench qc-workbench--native">
            <OnlineWorkspace
              clientId={clientId}
              apiConfig={apiConfig}
              providerStatus={providerStatus}
              queueStatus={queueStatus}
              taskMessage={taskMessage}
              onTaskChange={setOnlineTask}
              onOutputsChange={setOnlineOutputs}
            />
          </div>
        ) : activeRoute.kind === "native-angle" ? (
          <div className="qc-workbench qc-workbench--native">
            <AngleWorkspace
              clientId={clientId}
              apiConfig={apiConfig}
              providerStatus={providerStatus}
              queueStatus={queueStatus}
              taskMessage={taskMessage}
              onTaskChange={setAngleTask}
              onOutputsChange={setAngleOutputs}
              onContextChange={setAngleContext}
            />
          </div>
        ) : activeRoute.kind === "native-chat" ? (
          <div className="qc-workbench qc-workbench--native">
            <ChatWorkspace
              clientId={clientId}
              apiConfig={apiConfig}
              providerStatus={providerStatus}
              queueStatus={queueStatus}
              onTaskChange={setChatTask}
              onOutputsChange={setChatOutputs}
              onContextChange={setChatContext}
            />
          </div>
        ) : activeRoute.kind === "native-gallery" ? (
          <div className="qc-workbench qc-workbench--native">
            <GalleryWorkspace
              queueStatus={queueStatus}
              taskMessage={taskMessage}
              onTaskChange={setGalleryTask}
              onSelectedAssetsChange={setGallerySelectedAssets}
              onSendAssetsToCanvas={sendGalleryAssetsToCanvas}
            />
          </div>
        ) : activeRoute.kind === "native-api-models" ? (
          <div className="qc-workbench qc-workbench--native">
            <ApiModelsWorkspace
              apiConfig={apiConfig}
              providerStatus={providerStatus}
              onTaskChange={setApiModelsTask}
              onContextChange={setApiModelsContext}
              onSaved={() => refreshApiConfig()}
              onOpenAdvancedSettings={() => {
                if (advancedProviderRoute) navigate(advancedProviderRoute);
              }}
            />
          </div>
        ) : activeRoute.kind === "native-comfyui" ? (
          <div className="qc-workbench qc-workbench--native">
            <ComfyUIWorkspace
              clientId={clientId}
              onTaskChange={setComfyUITask}
              onContextChange={setComfyUIContext}
            />
          </div>
        ) : (
          <EmbeddedWorkbench
            routes={embeddedRoutes}
            activeRoute={activeRoute}
            theme={theme}
            taskMessage={taskMessage}
            onProvidersChanged={() => refreshApiConfig()}
            onCanvasIntakeStatus={handleCanvasIntakeStatus}
          />
        )}
      </div>
      <CreationRail
        open={railOpen}
        queueStatus={queueStatus}
        onlineCount={onlineCount}
        providerStatus={providerStatus}
        recentAssets={recentAssets}
        activeRouteId={activeRoute.id}
        generateTask={generateTask}
        generateOutputs={generateOutputs}
        enhanceTask={enhanceTask}
        enhanceOutputs={enhanceOutputs}
        editTask={editTask}
        editOutputs={editOutputs}
        editContext={editContext}
        editInput={editInput}
        onlineTask={onlineTask}
        onlineOutputs={onlineOutputs}
        angleTask={angleTask}
        angleOutputs={angleOutputs}
        angleContext={angleContext}
        chatTask={chatTask}
        chatOutputs={chatOutputs}
        chatContext={chatContext}
        galleryTask={galleryTask}
        gallerySelectedAssets={gallerySelectedAssets}
        canvasTask={canvasTask}
        canvasIntakeCount={canvasIntakeCount}
        canvasIntakeStatus={canvasIntakeStatus}
        apiModelsTask={apiModelsTask}
        apiModelsContext={apiModelsContext}
        comfyUITask={comfyUITask}
        comfyUIContext={comfyUIContext}
        onSendGalleryAssetsToCanvas={sendGalleryAssetsToCanvas}
        onSendRecentAssetToCanvas={sendRecentAssetToCanvas}
        onSendOutputToCanvas={sendOutputToCanvas}
        onOpenAdvancedSettings={() => {
          if (advancedProviderRoute) navigate(advancedProviderRoute);
        }}
        onClose={() => setRailOpen(false)}
      />
      <MobileNav routes={APP_ROUTES} activeRoute={activeRoute} onNavigate={navigate} />
    </div>
  );
}
