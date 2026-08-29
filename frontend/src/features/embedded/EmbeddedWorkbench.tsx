import { useEffect, useRef, useState } from "react";
import type { AppRoute } from "../../app/routes";
import { postThemeToFrame, type ThemeName } from "../../lib/theme";

// 上游暗色的藏青字面量 → 壳的中性灰。数字三元组匹配 rgb()/rgba() 序列化形式，
// hex 匹配自定义属性等保留原文的场景。
const NAVY_TO_NEUTRAL: Array<[RegExp, string]> = [
  [/\b15, 20, 29\b/g, "16, 17, 18"],
  [/\b16, 20, 29\b/g, "16, 17, 18"],
  [/\b11, 16, 32\b/g, "14, 15, 16"],
  [/\b20, 26, 36\b/g, "24, 26, 27"],
  [/\b21, 27, 38\b/g, "24, 26, 27"],
  [/\b23, 29, 41\b/g, "24, 26, 27"],
  [/\b17, 23, 34\b/g, "22, 23, 24"],
  [/\b17, 24, 39\b/g, "24, 26, 27"],
  [/\b29, 37, 51\b/g, "32, 35, 38"],
  [/\b30, 41, 59\b/g, "32, 35, 38"],
  [/\b42, 52, 68\b/g, "42, 46, 49"],
  [/\b45, 57, 76\b/g, "48, 51, 53"],
  [/\b51, 65, 85\b/g, "48, 51, 53"],
  [/#0f141d\b/gi, "#101112"],
  [/#10141d\b/gi, "#101112"],
  [/#0b1020\b/gi, "#0e0f10"],
  [/#141a24\b/gi, "#181a1b"],
  [/#151b26\b/gi, "#181a1b"],
  [/#171d29\b/gi, "#181a1b"],
  [/#111722\b/gi, "#161718"],
  [/#111827\b/gi, "#181a1b"],
  [/#1d2533\b/gi, "#202326"],
  [/#1e293b\b/gi, "#202326"],
  [/#2a3444\b/gi, "#2a2e31"],
  [/#2d394c\b/gi, "#303335"],
  [/#334155\b/gi, "#303335"]
];

// 同源注入主题桥：变量层用 link 覆盖，硬编码 !important 规则层扫描全部
// CSS 规则、复制含藏青字面量的规则并换色后追加到最后（同特异性靠后必胜）。
// 不修改任何上游文件；iframe 内部每次导航都会触发 onLoad，需要重复注入。
function injectThemeBridge(frame: HTMLIFrameElement | null | undefined): void {
  try {
    const doc = frame?.contentDocument;
    if (!doc) return;
    if (!doc.getElementById("qcos-theme-bridge")) {
      const link = doc.createElement("link");
      link.id = "qcos-theme-bridge";
      link.rel = "stylesheet";
      link.href = "/static/qcos-theme-bridge.css";
      (doc.head || doc.documentElement).appendChild(link);
    }
    if (!doc.getElementById("qcos-theme-bridge-patch")) {
      const patched: string[] = [];
      for (const sheet of Array.from(doc.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          let text = rule.cssText;
          if (!text) continue;
          let matched = false;
          for (const [re, sub] of NAVY_TO_NEUTRAL) {
            const next = text.replace(re, sub);
            if (next !== text) {
              matched = true;
              text = next;
            }
          }
          if (matched) patched.push(text);
        }
      }
      if (patched.length) {
        const style = doc.createElement("style");
        style.id = "qcos-theme-bridge-patch";
        style.textContent = patched.join("\n");
        (doc.head || doc.documentElement).appendChild(style);
      }
    }
  } catch {
    // 跨源或 iframe 销毁竞态时静默跳过。
  }
}

interface EmbeddedWorkbenchProps {
  routes: AppRoute[];
  activeRoute: AppRoute;
  theme: ThemeName;
  taskMessage: unknown;
  onProvidersChanged: () => void;
}

export function EmbeddedWorkbench({ routes, activeRoute, theme, taskMessage, onProvidersChanged }: EmbeddedWorkbenchProps) {
  const [loadedIds, setLoadedIds] = useState<Set<string>>(() => new Set([activeRoute.id]));
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const pendingProviderEvent = useRef<unknown>(null);

  useEffect(() => {
    setLoadedIds((current) => {
      if (current.has(activeRoute.id)) return current;
      const next = new Set(current);
      next.add(activeRoute.id);
      return next;
    });
  }, [activeRoute.id]);

  useEffect(() => {
    frames.current.forEach((frame) => postThemeToFrame(frame, theme));
  }, [theme, loadedIds]);

  useEffect(() => {
    if (!taskMessage) return;
    const frame = frames.current.get(activeRoute.id);
    try {
      frame?.contentWindow?.postMessage(taskMessage, window.location.origin);
    } catch {
      // Ignore iframe teardown races.
    }
  }, [activeRoute.id, taskMessage]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const knownSource = Array.from(frames.current.values()).some((frame) => frame.contentWindow === event.source);
      if (!knownSource) return;
      if (event.data?.type !== "providers-changed") return;
      pendingProviderEvent.current = event.data;
      onProvidersChanged();
      const canvas = frames.current.get("canvas");
      try {
        if (canvas?.contentWindow !== event.source) {
          canvas?.contentWindow?.postMessage(event.data, window.location.origin);
        }
      } catch {
        // Canvas may not be loaded yet.
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [onProvidersChanged]);

  return (
    <div className="qc-workbench" aria-label="Embedded workspace frame">
      {routes.filter((route) => route.kind === "embedded").map((route) => {
        const active = route.id === activeRoute.id;
        const loaded = loadedIds.has(route.id);
        if (!loaded || (route.keepAlive === false && !active)) return null;
        return (
          <iframe
            key={route.id}
            ref={(node) => {
              if (node) {
                frames.current.set(route.id, node);
              } else {
                frames.current.delete(route.id);
              }
            }}
            className={`qc-embedded-frame${active ? " is-active" : ""}`}
            title={route.label}
            src={route.src}
            data-route={route.id}
            aria-hidden={active ? undefined : true}
            onLoad={(event) => {
              injectThemeBridge(event.currentTarget);
              postThemeToFrame(event.currentTarget, theme);
              if (route.id === "canvas" && pendingProviderEvent.current) {
                try {
                  event.currentTarget.contentWindow?.postMessage(pendingProviderEvent.current, window.location.origin);
                } catch {
                  // Ignore.
                }
              }
            }}
          />
        );
      })}
    </div>
  );
}
