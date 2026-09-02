const APP_SOURCE = "moodle-analyzer-web";
const EXTENSION_SOURCE = "proxy-extension";
const PROTOCOL_NAME = "proxy-extension-bridge";
const PROTOCOL_VERSION = 1;

type BridgeRequestPayload = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  redirect?: "error";
};

type BridgeResponseMessage = {
  source: typeof EXTENSION_SOURCE;
  protocol: typeof PROTOCOL_NAME;
  version: typeof PROTOCOL_VERSION;
  type: "bridge-response";
  requestId: string;
  ok: boolean;
  result?: {
    ok: boolean;
    status: number;
    statusText: string;
    headers?: Record<string, string>;
    bodyText?: string;
    finalUrl?: string;
  };
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    status?: number | null;
  };
};

type AvailabilityMessage = {
  source: typeof EXTENSION_SOURCE;
  protocol: typeof PROTOCOL_NAME;
  version: typeof PROTOCOL_VERSION;
  type: "bridge-available";
};

type PendingRequest = {
  resolve: (value: BridgeHttpResponse) => void;
  reject: (reason?: unknown) => void;
  timeoutId: number;
};

export type BridgeHttpResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
};

const listeners = new Set<(available: boolean) => void>();
const pendingRequests = new Map<string, PendingRequest>();
let initialized = false;
let bridgeAvailable = false;
let handshakeIntervalId: number | null = null;
let handshakeDeadlineMs = 0;

function postBridgePing(): void {
  window.postMessage(
    {
      source: APP_SOURCE,
      protocol: PROTOCOL_NAME,
      version: PROTOCOL_VERSION,
      type: "bridge-ping",
    },
    window.location.origin,
  );
}

function stopBridgeHandshake(): void {
  if (handshakeIntervalId !== null) {
    window.clearInterval(handshakeIntervalId);
    handshakeIntervalId = null;
  }
}

function startBridgeHandshake(durationMs = 10000, intervalMs = 1000): void {
  if (typeof window === "undefined" || bridgeAvailable) {
    return;
  }

  const nextDeadlineMs = Date.now() + durationMs;
  handshakeDeadlineMs = Math.max(handshakeDeadlineMs, nextDeadlineMs);

  postBridgePing();

  if (handshakeIntervalId !== null) {
    return;
  }

  handshakeIntervalId = window.setInterval(() => {
    if (bridgeAvailable || Date.now() >= handshakeDeadlineMs) {
      stopBridgeHandshake();
      return;
    }

    postBridgePing();
  }, intervalMs);
}

function notifyAvailability(): void {
  listeners.forEach((listener) => listener(bridgeAvailable));
}

function setBridgeAvailable(nextValue: boolean): void {
  if (bridgeAvailable === nextValue) {
    return;
  }
  bridgeAvailable = nextValue;
  if (bridgeAvailable) {
    stopBridgeHandshake();
  }
  notifyAvailability();
}

function handleWindowMessage(event: MessageEvent<BridgeResponseMessage | AvailabilityMessage>): void {
  if (
    event.source !== window ||
    !event.data ||
    event.data.source !== EXTENSION_SOURCE ||
    event.data.protocol !== PROTOCOL_NAME ||
    event.data.version !== PROTOCOL_VERSION
  ) {
    return;
  }

  if (event.data.type === "bridge-available") {
    setBridgeAvailable(true);
    return;
  }

  if (event.data.type !== "bridge-response") {
    return;
  }

  const pending = pendingRequests.get(event.data.requestId);
  if (!pending) {
    return;
  }

  window.clearTimeout(pending.timeoutId);
  pendingRequests.delete(event.data.requestId);

  if (!event.data.ok) {
    pending.reject(new Error(event.data.error?.message || "Extension bridge request failed."));
    return;
  }

  pending.resolve({
    ok: event.data.result?.ok ?? event.data.ok,
    status: event.data.result?.status ?? 0,
    statusText: event.data.result?.statusText ?? "",
    headers: event.data.result?.headers ?? {},
    bodyText: event.data.result?.bodyText ?? "",
  });
}

export function initializeExtensionBridge(): void {
  if (initialized || typeof window === "undefined") {
    return;
  }

  initialized = true;
  window.addEventListener("message", handleWindowMessage);
  window.addEventListener("focus", () => startBridgeHandshake(4000, 800));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      startBridgeHandshake(4000, 800);
    }
  });
  startBridgeHandshake();
}

export function isExtensionBridgeAvailable(): boolean {
  return bridgeAvailable;
}

export function probeExtensionBridge(): void {
  initializeExtensionBridge();
  startBridgeHandshake();
}

export function subscribeExtensionBridgeAvailability(
  listener: (available: boolean) => void,
): () => void {
  listeners.add(listener);
  listener(bridgeAvailable);
  return () => {
    listeners.delete(listener);
  };
}

export function requestThroughExtension(
  payload: BridgeRequestPayload,
  timeoutMs = 15000,
): Promise<BridgeHttpResponse> {
  initializeExtensionBridge();
  startBridgeHandshake(3000, 500);

  if (!bridgeAvailable) {
    return Promise.reject(new Error("Chrome extension bridge is not available."));
  }

  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `bridge-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("Timed out waiting for the Chrome extension bridge."));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timeoutId });

    window.postMessage(
      {
        source: APP_SOURCE,
        protocol: PROTOCOL_NAME,
        version: PROTOCOL_VERSION,
        type: "bridge-request",
        requestId,
        payload,
      },
      window.location.origin,
    );
  });
}
