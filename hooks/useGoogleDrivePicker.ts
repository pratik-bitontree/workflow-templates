"use client";

import { useState, useEffect, useCallback } from "react";
import { orchestrationEndpoints } from "@/lib/api-endpoints";
import { getIntegrationHeaders } from "@/lib/integration-api";

const DEFAULT_USER_ID = "000000000000000000000001";

export interface GoogleDrivePickerResult {
  id: string;
  name: string;
  mimeType?: string;
  url?: string;
}

declare global {
  interface Window {
    gapi?: unknown;
    google?: { picker?: unknown };
  }
}

/**
 * Loads Google Picker API and provides openPicker(token, onSelect).
 * Token must be obtained from backend (drive-picker-token).
 */
export function useGoogleDrivePicker(userId: string = DEFAULT_USER_ID) {
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.gapi && window.google?.picker) {
      setIsApiLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => {
      if (window.gapi && typeof (window.gapi as { load: (name: string, cb: () => void) => void }).load === "function") {
        (window.gapi as { load: (name: string, cb: () => void) => void }).load("picker", () => setIsApiLoaded(true));
      }
    };
    document.body.appendChild(script);
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const url = orchestrationEndpoints.getDrivePickerToken(userId);
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...getIntegrationHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.accessToken) return data.accessToken;
      setError(data.message || "Google Drive not connected.");
      return null;
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to get token.");
      return null;
    }
  }, [userId]);

  const openPicker = useCallback(
    async (onSelect: (result: GoogleDrivePickerResult) => void, onCancel?: () => void): Promise<void> => {
      setError(null);
      const token = await getToken();
      if (!token) return;
      if (!window.google?.picker || !isApiLoaded) {
        setError("Google Picker not loaded yet.");
        return;
      }
      const picker = (window.google as any)?.picker;
      if (!picker) {
        setError("Google Picker not available.");
        return;
      }
      const view = new picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);
      const builder = new picker.PickerBuilder()
        .setOAuthToken(token)
        .addView(view)
        .setCallback((data: any) => {
          const action = String(data?.action ?? "").toLowerCase();
          if (action === "cancel" && onCancel) onCancel();
          if ((action === "picked" || action === "pick") && data?.docs?.length) {
            const doc = data.docs[0];
            onSelect({ id: doc.id, name: doc.name, mimeType: doc.mimeType, url: doc.url });
          }
        });
      const appId = typeof process !== "undefined" && process.env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER;
      if (appId) builder.setAppId(appId);
      const devKey = typeof process !== "undefined" && process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (devKey) builder.setDeveloperKey(devKey);
      builder.build().setVisible(true);
    },
    [getToken, isApiLoaded]
  );

  return { openPicker, isApiLoaded, error };
}
