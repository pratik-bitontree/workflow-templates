import {
  integrationEndpoints,
  getIntegrationHeaders,
  getOAuthConnectBaseUrl,
  isGrowStackIntegrationMode,
} from "./integration-api";

/**
 * Starts OAuth flow: resolves auth URL, navigates the popup to it, and polls until
 * auth completes, popup is closed, or timeout. Caller must open the popup synchronously
 * on user click to avoid popup blockers.
 */
export async function signInOAuthService(
  serviceKey: string,
  userId: string,
  existingWindow: Window | null
): Promise<void> {
  if (!existingWindow || existingWindow.closed) {
    throw new Error("Popup was blocked or closed. Allow popups for this site and try again.");
  }

  let authUrl: string;

  const connectBase = getOAuthConnectBaseUrl();
  if (connectBase) {
    authUrl = `${connectBase.replace(/\/$/, "")}/orchestration/${encodeURIComponent(serviceKey)}/connect?userId=${encodeURIComponent(userId)}`;
  } else {
    const loginUrl = integrationEndpoints.oauthLogin(serviceKey, userId);
    const headers = getIntegrationHeaders();
    const res = await fetch(loginUrl, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...headers },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (existingWindow && !existingWindow.closed) existingWindow.close();
      throw new Error(
        data?.message || `OAuth login failed (${res.status}). Check CONNECT_BASE_URL in backend .env.`
      );
    }
    const urlFromBackend = data?.url && String(data.url).trim();
    const fallback =
      typeof process !== "undefined" && process.env.NEXT_PUBLIC_CONNECT_BASE_URL
        ? `${String(process.env.NEXT_PUBLIC_CONNECT_BASE_URL).replace(/\/$/, "")}/orchestration/${encodeURIComponent(serviceKey)}/connect?userId=${encodeURIComponent(userId)}`
        : "";
    authUrl = urlFromBackend || fallback;
  }

  if (!authUrl || !authUrl.startsWith("http")) {
    if (existingWindow && !existingWindow.closed) existingWindow.close();
    throw new Error(
      "OAuth URL not configured. Set NEXT_PUBLIC_OAUTH_CONNECT_BASE_URL or NEXT_PUBLIC_CONNECT_BASE_URL in .env.local (e.g. https://your-orchestration-host)."
    );
  }

  existingWindow.location.href = authUrl;

  const checkUrl = integrationEndpoints.oauthAuthCheck(serviceKey, userId);
  const maxAttempts = 30;
  const pollIntervalMs = 2000;
  let attempts = 0;

  return new Promise<void>((resolve, reject) => {
    const poll = async () => {
      try {
        if (typeof existingWindow.closed !== "undefined" && existingWindow.closed) {
          reject(new Error("Popup was closed before completing sign-in."));
          return;
        }

        const headers = getIntegrationHeaders();
        const r = await fetch(checkUrl, {
          cache: "no-store",
          headers: { "Content-Type": "application/json", ...headers },
        });
        const d = await r.json().catch(() => ({}));
        const success =
          d?.success === true ||
          (isGrowStackIntegrationMode() &&
            Array.isArray(d?.connectedAccounts) &&
            d.connectedAccounts.length > 0);

        if (success) {
          try {
            if (!existingWindow.closed) existingWindow.close();
          } catch {}
          resolve();
          return;
        }
      } catch {
        // Network error during poll; continue until max attempts
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, pollIntervalMs);
      } else {
        try {
          if (!existingWindow.closed) existingWindow.close();
        } catch {}
        reject(new Error("Connection timed out. Complete sign-in in the popup or try again."));
      }
    };

    setTimeout(poll, pollIntervalMs);
  });
}
