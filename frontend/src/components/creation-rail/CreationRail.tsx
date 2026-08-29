import { AlertCircle, CheckCircle2, Image, Loader2, Send, Settings2, X } from "lucide-react";
import type { GalleryAsset, GenerateRecord, QueueStatus } from "../../lib/api";
import type { CreationTaskSummary } from "../../lib/creation-state";
import type { ProviderStatus } from "../../lib/provider-status";
import { generatedResultKey } from "../../lib/result-dedupe";
import { IconButton } from "../controls/IconButton";
import { Button } from "../controls/Button";
import type { EditInputSummary } from "../../features/edit/EditWorkspace";
import type { CanvasIntakeStatus } from "../../lib/canvas-intake";
import type { AngleRailContext } from "../../features/angle/AngleWorkspace";
import type { ApiModelsRailContext } from "../../features/api-models/ApiModelsWorkspace";
import type { ComfyUIRailContext } from "../../features/comfyui/ComfyUIWorkspace";

interface CreationRailProps {
  open: boolean;
  queueStatus: QueueStatus | null;
  onlineCount: number | null;
  providerStatus: ProviderStatus;
  recentAssets: GalleryAsset[];
  activeRouteId: string;
  generateTask: CreationTaskSummary;
  generateOutputs: GenerateRecord[];
  enhanceTask: CreationTaskSummary;
  enhanceOutputs: GenerateRecord[];
  editTask: CreationTaskSummary;
  editOutputs: GenerateRecord[];
  editContext: string;
  editInput: EditInputSummary | null;
  onlineTask: CreationTaskSummary;
  onlineOutputs: GenerateRecord[];
  angleTask: CreationTaskSummary;
  angleOutputs: GenerateRecord[];
  angleContext: AngleRailContext;
  chatTask: CreationTaskSummary;
  chatOutputs: GenerateRecord[];
  chatContext: string;
  galleryTask: CreationTaskSummary;
  gallerySelectedAssets: GalleryAsset[];
  canvasTask: CreationTaskSummary;
  canvasIntakeCount: number;
  canvasIntakeStatus: CanvasIntakeStatus;
  apiModelsTask: CreationTaskSummary;
  apiModelsContext: ApiModelsRailContext;
  comfyUITask: CreationTaskSummary;
  comfyUIContext: ComfyUIRailContext;
  onSendGalleryAssetsToCanvas?: (assets: GalleryAsset[]) => void;
  onSendRecentAssetToCanvas?: (asset: GalleryAsset) => void;
  onSendOutputToCanvas?: (record: GenerateRecord) => void;
  onOpenAdvancedSettings: () => void;
  onClose: () => void;
}

function assetImage(asset: GalleryAsset): string {
  return asset.thumb_url || asset.thumbnail || asset.url || "";
}

function assetTitle(asset: GalleryAsset): string {
  return asset.title || asset.name || asset.filename || "Gallery asset";
}

function assetPrompt(asset: GalleryAsset): string {
  return asset.prompt || asset.phrase || "";
}

function assetSource(asset: GalleryAsset): string {
  return (asset.source_labels?.length ? asset.source_labels : [asset.source_label || asset.source || "Unknown"]).filter(Boolean).join(" + ");
}

function assetDate(value?: string | number): string {
  if (!value) return "No date";
  const numeric = typeof value === "number" ? value : Number(value);
  const time = Number.isFinite(numeric) ? (numeric < 1e12 ? numeric * 1000 : numeric) : Date.parse(String(value));
  if (!Number.isFinite(time)) return "No date";
  return new Date(time).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function outputImage(record: GenerateRecord): string {
  return record.images?.[0] || "";
}

function taskIcon(status: CreationTaskSummary["status"]) {
  if (status === "running" || status === "pending") {
    return <Loader2 className="qc-spin" size={16} strokeWidth={2} aria-hidden="true" />;
  }
  if (status === "failed") {
    return <AlertCircle size={16} strokeWidth={2} aria-hidden="true" />;
  }
  return <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />;
}

export function CreationRail({
  open,
  queueStatus,
  onlineCount,
  providerStatus,
  recentAssets,
  activeRouteId,
  generateTask,
  generateOutputs,
  enhanceTask,
  enhanceOutputs,
  editTask,
  editOutputs,
  editContext,
  editInput,
  onlineTask,
  onlineOutputs,
  angleTask,
  angleOutputs,
  angleContext,
  chatTask,
  chatOutputs,
  chatContext,
  galleryTask,
  gallerySelectedAssets,
  canvasTask,
  canvasIntakeCount,
  canvasIntakeStatus,
  apiModelsTask,
  apiModelsContext,
  comfyUITask,
  comfyUIContext,
  onSendGalleryAssetsToCanvas,
  onSendRecentAssetToCanvas,
  onSendOutputToCanvas,
  onOpenAdvancedSettings,
  onClose
}: CreationRailProps) {
  const busy = Boolean(queueStatus?.total);
  const activeContext = activeRouteId === "enhance"
    ? { label: "Enhance", task: enhanceTask, outputs: enhanceOutputs }
    : activeRouteId === "klein"
      ? { label: "Edit", task: editTask, outputs: editOutputs }
    : activeRouteId === "online"
      ? { label: "Online", task: onlineTask, outputs: onlineOutputs }
      : activeRouteId === "angle"
      ? { label: "Angle", task: angleTask, outputs: angleOutputs }
      : activeRouteId === "gpt-chat"
        ? { label: "Chat", task: chatTask, outputs: chatOutputs }
        : activeRouteId === "gallery"
          ? { label: "Gallery", task: galleryTask, outputs: [] }
          : activeRouteId === "canvas"
            ? { label: "Canvas", task: canvasTask, outputs: [] }
            : activeRouteId === "api-config" || activeRouteId === "provider-settings"
              ? { label: "API / Models", task: apiModelsTask, outputs: [] }
              : activeRouteId === "comfyui-settings"
                ? { label: "ComfyUI", task: comfyUITask, outputs: [] }
          : { label: "Generate", task: generateTask, outputs: generateOutputs };
  const activeTask = activeContext.task;
  const activeOutputs = activeContext.outputs;
  const activeLabel = activeContext.label;
  const latestOutput = activeOutputs[0];
  const galleryActive = activeLabel === "Gallery";
  const editActive = activeLabel === "Edit";
  const canvasActive = activeLabel === "Canvas";
  const angleActive = activeLabel === "Angle";
  const apiModelsActive = activeLabel === "API / Models";
  const comfyUIActive = activeLabel === "ComfyUI";
  const selectedGalleryAsset = gallerySelectedAssets[0];
  const sendCanvasLabel = canvasActive
    ? ""
    : galleryActive && gallerySelectedAssets.length
    ? `Send ${gallerySelectedAssets.length} to Canvas`
    : latestOutput && outputImage(latestOutput)
    ? "Send output to Canvas"
    : recentAssets[0]
    ? "Send recent to Canvas"
    : "";
  const sendToCanvas = () => {
    if (galleryActive && gallerySelectedAssets.length) {
      onSendGalleryAssetsToCanvas?.(gallerySelectedAssets);
    } else if (latestOutput && outputImage(latestOutput)) {
      onSendOutputToCanvas?.(latestOutput);
    } else if (recentAssets[0]) {
      onSendRecentAssetToCanvas?.(recentAssets[0]);
    }
  };
  const selectedContext = galleryActive
    ? selectedGalleryAsset
      ? assetPrompt(selectedGalleryAsset) || assetTitle(selectedGalleryAsset)
      : "Select a Gallery asset to inspect metadata here."
    : canvasActive
    ? canvasTask.detail || "Choose a Classic or Smart Canvas target for queued assets."
    : angleActive
    ? angleContext.detail || "Upload a source image to show Angle context here."
    : apiModelsActive
    ? apiModelsContext.detail || "Select a provider to inspect API / Models context here."
    : comfyUIActive
    ? comfyUIContext.detail || "Select a workflow to inspect ComfyUI context here."
    : editActive
    ? editContext
    : activeLabel === "Chat"
    ? chatContext
    : latestOutput?.prompt || `${activeLabel} outputs will attach prompt context here.`;
  const editAssets = editActive
    ? [
        editInput ? { key: "edit-input", src: editInput.url, label: editInput.name || "Main input" } : null,
        ...editOutputs.slice(0, 5).map((record, index) => ({
          key: generatedResultKey(record, index),
          src: outputImage(record),
          label: record.prompt || `Edit output ${index + 1}`
        }))
      ].filter((item): item is { key: string; src: string; label: string } => Boolean(item))
    : [];

  return (
    <aside className={`qc-creation-rail${open ? " is-open" : ""}`} aria-label="Creation Rail">
      <div className="qc-rail-header">
        <div>
          <h2>Creation Rail</h2>
          <p>Tasks, outputs, and context</p>
        </div>
        <div className="qc-rail-actions">
          <IconButton label="Close Creation Rail" className="qc-rail-close" onClick={onClose}>
            <X size={17} strokeWidth={2} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <section className="qc-rail-section" aria-labelledby="rail-status-title">
        <h3 id="rail-status-title">Status</h3>
        <div className="qc-rail-status-list">
          <div className="qc-rail-status-row" data-state={activeTask.status}>
            {taskIcon(activeTask.status)}
            <div>
              <strong>{activeTask.label}</strong>
              <span>{activeTask.error || activeTask.detail}</span>
            </div>
          </div>
          <div className="qc-rail-status-row">
            {providerStatus.configured ? (
              <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <AlertCircle size={16} strokeWidth={2} aria-hidden="true" />
            )}
            <div>
              <strong>{providerStatus.label}</strong>
              <span>{providerStatus.detail}</span>
            </div>
          </div>
          <div className="qc-rail-status-row">
            {busy ? (
              <Loader2 className="qc-spin" size={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />
            )}
            <div>
              <strong>{busy ? "Queue active" : "Queue clear"}</strong>
              <span>{queueStatus?.position ? `Position ${queueStatus.position} of ${queueStatus.total}` : `${queueStatus?.total ?? 0} tasks`}</span>
            </div>
          </div>
          <div className="qc-rail-status-row">
            <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />
            <div>
              <strong>{onlineCount ?? 0} online</strong>
              <span>Workspace websocket</span>
            </div>
          </div>
        </div>
      </section>

      <section className="qc-rail-section" aria-labelledby="rail-assets-title">
        <h3 id="rail-assets-title">{galleryActive && gallerySelectedAssets.length ? "Selected Gallery" : canvasActive ? "Canvas board" : angleActive ? "Angle source" : apiModelsActive ? "Provider setup" : comfyUIActive ? "ComfyUI setup" : editActive ? "Edit assets" : `Recent ${activeLabel}`}</h3>
        {galleryActive && gallerySelectedAssets.length ? (
          <div className="qc-asset-strip">
            {gallerySelectedAssets.slice(0, 6).map((asset, index) => {
              const src = assetImage(asset);
              const label = assetTitle(asset);
              return (
                <div className="qc-asset-thumb" key={asset.id || `${src}-${index}`}>
                  {src ? <img src={src} alt={label} /> : <Image size={18} strokeWidth={1.8} aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        ) : canvasActive ? (
          <div className="qc-gallery-rail-detail">
            <strong>{canvasIntakeCount} pending Canvas item{canvasIntakeCount === 1 ? "" : "s"}</strong>
            <span>{canvasTask.detail || "Choose a Classic or Smart Canvas target."}</span>
            <dl>
              <div><dt>Pending</dt><dd>{canvasIntakeCount}</dd></div>
              <div><dt>Save</dt><dd>{canvasIntakeStatus}</dd></div>
            </dl>
            <Button variant="secondary" icon={<Settings2 size={15} strokeWidth={2} aria-hidden="true" />} onClick={onOpenAdvancedSettings}>
              Advanced settings
            </Button>
          </div>
        ) : angleActive ? (
          <div className="qc-gallery-rail-detail">
            <strong>{angleContext.sourceName || "No source selected"}</strong>
            <span>{angleContext.detail}</span>
            {angleContext.sourcePreviewUrl || angleContext.lastOutputUrl ? (
              <div className="qc-asset-strip">
                {angleContext.sourcePreviewUrl ? (
                  <div className="qc-asset-thumb">
                    <img src={angleContext.sourcePreviewUrl} alt={angleContext.sourceName || "Angle source"} />
                  </div>
                ) : null}
                {angleContext.lastOutputUrl ? (
                  <div className="qc-asset-thumb">
                    <img src={angleContext.lastOutputUrl} alt="Last Angle output" />
                  </div>
                ) : null}
              </div>
            ) : null}
            <dl>
              <div><dt>Engine</dt><dd>{angleContext.engine}</dd></div>
              <div><dt>Rotation</dt><dd>{angleContext.rotation} deg</dd></div>
              <div><dt>Pitch</dt><dd>{angleContext.pitch} deg</dd></div>
              <div><dt>Distance</dt><dd>{angleContext.distance}</dd></div>
              <div><dt>Status</dt><dd>{angleContext.status}</dd></div>
            </dl>
          </div>
        ) : apiModelsActive ? (
          <div className="qc-gallery-rail-detail">
            <strong>{apiModelsContext.providerName || "No provider selected"}</strong>
            <span>API / Models · {apiModelsContext.detail}</span>
            <dl>
              <div><dt>Workspace</dt><dd>API / Models</dd></div>
              <div><dt>Provider</dt><dd>{apiModelsContext.providerId || "None"}</dd></div>
              <div><dt>Enabled</dt><dd>{apiModelsContext.enabled ? "Yes" : "No"}</dd></div>
              <div><dt>Primary</dt><dd>{apiModelsContext.primary ? "Yes" : "No"}</dd></div>
              <div><dt>Key</dt><dd>{apiModelsContext.keyPreview || (apiModelsContext.hasKey ? "key set" : "no key")}</dd></div>
              <div><dt>Models</dt><dd>{apiModelsContext.imageModelCount + apiModelsContext.chatModelCount + apiModelsContext.videoModelCount}</dd></div>
            </dl>
          </div>
        ) : comfyUIActive ? (
          <div className="qc-gallery-rail-detail">
            <strong>{comfyUIContext.workflowTitle || "No workflow selected"}</strong>
            <span>ComfyUI · {comfyUIContext.detail}</span>
            <dl>
              <div><dt>Workspace</dt><dd>ComfyUI</dd></div>
              <div><dt>Instances</dt><dd>{comfyUIContext.instanceCount}</dd></div>
              <div><dt>Primary</dt><dd>{comfyUIContext.primaryInstance || "None"}</dd></div>
              <div><dt>Workflow</dt><dd>{comfyUIContext.selectedWorkflow || "None"}</dd></div>
              <div><dt>Mode</dt><dd>{comfyUIContext.builtin ? "Builtin" : "Custom"}</dd></div>
            </dl>
          </div>
        ) : editAssets.length ? (
          <div className="qc-asset-strip">
            {editAssets.map((asset) => (
              <div className="qc-asset-thumb" key={asset.key}>
                {asset.src ? <img src={asset.src} alt={asset.label} /> : <Image size={18} strokeWidth={1.8} aria-hidden="true" />}
              </div>
            ))}
          </div>
        ) : activeOutputs.length ? (
          <div className="qc-asset-strip">
            {activeOutputs.slice(0, 6).map((record, index) => {
              const src = outputImage(record);
              const label = record.prompt || `${activeLabel} output ${index + 1}`;
              return (
                <div className="qc-asset-thumb" key={generatedResultKey(record, index)}>
                  {src ? <img src={src} alt={label} /> : <Image size={18} strokeWidth={1.8} aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        ) : recentAssets.length ? (
          <div className="qc-asset-strip">
            {recentAssets.slice(0, 6).map((asset, index) => {
              const src = assetImage(asset);
              const label = asset.name || asset.prompt || `Output ${index + 1}`;
              return (
                <div className="qc-asset-thumb" key={asset.id || `${src}-${index}`}>
                  {src ? <img src={src} alt={label} /> : <Image size={18} strokeWidth={1.8} aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="qc-empty-rail">
            <Image size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>No {activeLabel} outputs yet</span>
          </div>
        )}
        {sendCanvasLabel ? (
          <Button variant="secondary" className="qc-rail-send-canvas" icon={<Send size={15} strokeWidth={2} aria-hidden="true" />} onClick={sendToCanvas}>
            {sendCanvasLabel}
          </Button>
        ) : null}
      </section>

      <section className="qc-rail-section" aria-labelledby="rail-context-title">
        <h3 id="rail-context-title">Selected context</h3>
        {canvasActive ? (
          <div className="qc-gallery-rail-detail">
            <strong>Canvas intake</strong>
            <span>{selectedContext}</span>
            <dl>
              <div><dt>Pending</dt><dd>{canvasIntakeCount}</dd></div>
              <div><dt>Save</dt><dd>{canvasIntakeStatus}</dd></div>
            </dl>
          </div>
        ) : angleActive ? (
          <div className="qc-gallery-rail-detail">
            <strong>{angleContext.engine}</strong>
            <span>{selectedContext}</span>
            <dl>
              <div><dt>Source</dt><dd>{angleContext.sourceName || "None"}</dd></div>
              <div><dt>Rotation</dt><dd>{angleContext.rotation} deg</dd></div>
              <div><dt>Pitch</dt><dd>{angleContext.pitch} deg</dd></div>
              <div><dt>Distance</dt><dd>{angleContext.distance}</dd></div>
              <div><dt>Task</dt><dd>{angleContext.taskId || "None"}</dd></div>
              {angleContext.error ? <div><dt>Error</dt><dd>{angleContext.error}</dd></div> : null}
              <div><dt>Status</dt><dd>{activeTask.status}</dd></div>
            </dl>
          </div>
        ) : apiModelsActive ? (
          <div className="qc-gallery-rail-detail">
            <strong>{apiModelsContext.providerName || "API / Models"}</strong>
            <span>{selectedContext}</span>
            <dl>
              <div><dt>Workspace</dt><dd>API / Models</dd></div>
              <div><dt>Protocol</dt><dd>{apiModelsContext.protocol || "openai"}</dd></div>
              <div><dt>Base URL</dt><dd>{apiModelsContext.baseUrl || "Not set"}</dd></div>
              <div><dt>Image</dt><dd>{apiModelsContext.imageModelCount}</dd></div>
              <div><dt>Chat</dt><dd>{apiModelsContext.chatModelCount}</dd></div>
              <div><dt>Video</dt><dd>{apiModelsContext.videoModelCount}</dd></div>
              <div><dt>LoRA</dt><dd>{apiModelsContext.loraCount}</dd></div>
              <div><dt>Action</dt><dd>{apiModelsContext.lastAction}</dd></div>
              <div><dt>Status</dt><dd>{apiModelsContext.error || apiModelsContext.lastStatus}</dd></div>
            </dl>
          </div>
        ) : comfyUIActive ? (
          <div className="qc-gallery-rail-detail">
            <strong>{comfyUIContext.workflowTitle || "ComfyUI"}</strong>
            <span>{selectedContext}</span>
            <dl>
              <div><dt>Workflow</dt><dd>{comfyUIContext.selectedWorkflow || "None"}</dd></div>
              <div><dt>Fields</dt><dd>{comfyUIContext.fieldCount}</dd></div>
              <div><dt>Nodes</dt><dd>{comfyUIContext.nodeCount}</dd></div>
              <div><dt>Action</dt><dd>{comfyUIContext.lastAction}</dd></div>
              <div><dt>Test</dt><dd>{comfyUIContext.testStatus}</dd></div>
              <div><dt>Outputs</dt><dd>{comfyUIContext.lastOutputCount}</dd></div>
              <div><dt>Status</dt><dd>{comfyUIContext.error || comfyUIContext.lastStatus}</dd></div>
            </dl>
          </div>
        ) : galleryActive && selectedGalleryAsset ? (
          <div className="qc-gallery-rail-detail">
            <strong>{assetTitle(selectedGalleryAsset)}</strong>
            <span>{selectedContext}</span>
            <dl>
              <div><dt>Source</dt><dd>{assetSource(selectedGalleryAsset)}</dd></div>
              <div><dt>Artifact</dt><dd>{selectedGalleryAsset.artifact_label || selectedGalleryAsset.artifact_type || "Image"}</dd></div>
              <div><dt>Model</dt><dd>{selectedGalleryAsset.model || "Unknown"}</dd></div>
              <div><dt>Date</dt><dd>{assetDate(selectedGalleryAsset.created_at)}</dd></div>
              <div><dt>Status</dt><dd>{selectedGalleryAsset.status || "Unknown"}</dd></div>
            </dl>
          </div>
        ) : editActive && editInput ? (
          <div className="qc-gallery-rail-detail">
            <strong>{editInput.name || "Main input"}</strong>
            <span>{selectedContext}</span>
            <dl>
              <div><dt>Source</dt><dd>{editInput.comfyName || "Local preview"}</dd></div>
              <div><dt>Mode</dt><dd>Edit / Klein</dd></div>
              <div><dt>Status</dt><dd>{activeTask.status}</dd></div>
            </dl>
          </div>
        ) : (
          <div className="qc-context-placeholder">
            <span>{selectedContext}</span>
          </div>
        )}
      </section>
    </aside>
  );
}
