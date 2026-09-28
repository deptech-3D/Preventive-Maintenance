import { useEffect, useRef } from "react";

interface BackLayer {
  id: string;
  priority: number;
  order: number;
  onBack: () => void;
}

let layerCounter = 0;
const layerStack: BackLayer[] = [];
let browserHistoryDepth = 0;
let ignorePopEvents = 0;
let syncScheduled = false;
let listenerInitialized = false;

function scheduleHistorySync() {
  if (syncScheduled || typeof window === "undefined") return;
  syncScheduled = true;

  queueMicrotask(() => {
    syncScheduled = false;
    const targetDepth = layerStack.length;
    const diff = targetDepth - browserHistoryDepth;

    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        browserHistoryDepth += 1;
        try {
          window.history.pushState(
            { ...(window.history.state || {}), __appBackDepth: browserHistoryDepth },
            ""
          );
        } catch {
          // Ignore pushState errors in restricted environments
        }
      }
    } else if (diff < 0) {
      const stepsBack = -diff;
      browserHistoryDepth = targetDepth;
      ignorePopEvents += 1;
      try {
        window.history.go(-stepsBack);
      } catch {
        ignorePopEvents = Math.max(0, ignorePopEvents - 1);
      }
    }
  });
}

function initGlobalPopStateListener() {
  if (listenerInitialized || typeof window === "undefined") return;
  listenerInitialized = true;

  window.addEventListener("popstate", () => {
    if (ignorePopEvents > 0) {
      ignorePopEvents -= 1;
      return;
    }

    if (browserHistoryDepth > 0) {
      browserHistoryDepth -= 1;
    }

    if (layerStack.length === 0) {
      return;
    }

    // Find the layer with the highest priority (and most recently added if tied)
    let bestIdx = layerStack.length - 1;
    for (let i = layerStack.length - 2; i >= 0; i--) {
      if (layerStack[i].priority > layerStack[bestIdx].priority) {
        bestIdx = i;
      }
    }

    const [topLayer] = layerStack.splice(bestIdx, 1);
    if (topLayer) {
      topLayer.onBack();
      scheduleHistorySync();
    }
  });
}

/**
 * Registers an open modal, popup, or inner menu with the browser/mobile Back button (`popstate`).
 * When the user presses the Android/Browser Back button, the highest-priority open menu closes
 * instead of navigating away from the app.
 *
 * @param isOpen Whether the menu/modal is currently open
 * @param onBack Callback to close the menu/modal when Back is pressed
 * @param priority Higher numbers close first (e.g. 10 = Tab, 15 = Panel, 20 = Modal, 25 = Inner Menu, 30 = Confirm, 40 = Lightbox)
 */
export function useBackHandler(
  isOpen: boolean,
  onBack: () => void,
  priority: number = 20
) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    initGlobalPopStateListener();

    const order = ++layerCounter;
    const id = `back_layer_${order}_${Date.now()}`;
    const layer: BackLayer = {
      id,
      priority,
      order,
      onBack: () => onBackRef.current(),
    };

    layerStack.push(layer);
    scheduleHistorySync();

    return () => {
      const idx = layerStack.findIndex((item) => item.id === id);
      if (idx !== -1) {
        layerStack.splice(idx, 1);
        scheduleHistorySync();
      }
    };
  }, [isOpen, priority]);
}
