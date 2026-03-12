"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntegrationDetail, ConnectedAccount } from "@/lib/types";
import { getIntegrationHeaders } from "@/lib/integration-api";
import { apiPost, apiPut } from "@/lib/api";
import {
  orchestrationEndpoints,
  accountConnectionEndpoints,
} from "@/lib/api-endpoints";
import { signInOAuthService } from "@/lib/auth";

const DEFAULT_USER_ID = "000000000000000000000001";
const MASKED = "••••••••••••";

type ActivityLogEntry = { _id?: string; action?: string; details?: string; createdAt?: string };

interface IntegrationDrawerProps {
  integration: IntegrationDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function IntegrationDrawer({ integration, isOpen, onClose, onRefresh }: IntegrationDrawerProps) {
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "connect" | "activity">("overview");
  const [openApiKeyModal, setOpenApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSubmittingApiKey, setIsSubmittingApiKey] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showAccountConnected, setShowAccountConnected] = useState(false);
  const [showAccountDisconnected, setShowAccountDisconnected] = useState(false);
  const [showPrimaryUpdated, setShowPrimaryUpdated] = useState(false);
  const [showApiKeyMap, setShowApiKeyMap] = useState<Record<string, boolean>>({});
  const [connectError, setConnectError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  const userId = DEFAULT_USER_ID;

  useEffect(() => {
    setLogoError(false);
  }, [integration?.type]);



  const fetchConnectedAccountsCorrect = useCallback(async () => {
    if (!integration?.userSecretKey) return [];
    try {
      const url = orchestrationEndpoints.getConnectedAccounts(integration.userSecretKey, userId);
      const headers = getIntegrationHeaders();
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...headers },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConnectedAccounts([]);
        return [];
      }
      const list = Array.isArray(data?.connectedAccounts) ? data.connectedAccounts : [];
      setConnectedAccounts(list);
      return list;
    } catch {
      setConnectedAccounts([]);
      return [];
    }
  }, [integration?.userSecretKey, userId]);

  const postOAuthRefresh = useCallback(
    async (previousAccountIds: string[] = []) => {
      try {
        const list = await fetchConnectedAccountsCorrect();
        const newAcc = list?.find((acc: any) => !previousAccountIds.includes(acc.accountId)) ?? list?.[list.length - 1];
        if (newAcc && integration?.userSecretKey) {
          try {
            await apiPost(
              orchestrationEndpoints.postLogActivity(),
              {
                userId,
                accountId: newAcc.accountId,
                accountEmail: newAcc?.email ?? newAcc?.userName,
                integration: integration.userSecretKey,
                action: "CONNECTED",
                details: `Connected to ${integration.name} at ${new Date().toISOString()}`,
              },
              getIntegrationHeaders()
            );
          } catch {}
        }
        await onRefresh();
        setShowAccountConnected(true);
        setTimeout(() => setShowAccountConnected(false), 4000);
      } catch {
        setConnectError("Connection successful, but refresh failed. Try refreshing.");
        setTimeout(() => setConnectError(null), 6000);
      }
    },
    [fetchConnectedAccountsCorrect, integration?.userSecretKey, integration?.name, onRefresh, userId]
  );

  useEffect(() => {
    if (isOpen && integration?.userSecretKey) {
      fetchConnectedAccountsCorrect();
    }
  }, [isOpen, integration?.userSecretKey, fetchConnectedAccountsCorrect]);

  useEffect(() => {
    if (activeTab === "activity" && isOpen && integration?.userSecretKey) {
      setLoadingLogs(true);
      const url = orchestrationEndpoints.getActivityLogs(integration.userSecretKey, userId);
      const headers = getIntegrationHeaders();
      fetch(url, { cache: "no-store", headers: { "Content-Type": "application/json", ...headers } })
        .then((r) => r.json().catch(() => ({})))
        .then((data) => {
          const logs = Array.isArray(data) ? data : (data?.data ?? []);
          setActivityLogs(Array.isArray(logs) ? logs : []);
        })
        .catch(() => setActivityLogs([]))
        .finally(() => setLoadingLogs(false));
    }
  }, [activeTab, isOpen, userId, integration?.userSecretKey]);

  const isOAuth = integration?.connectionMethods?.oauth === true;
  const isApiKeyOnly = integration?.connectionMethods?.apiKey === true && !integration?.connectionMethods?.oauth;
  const handleOAuthConnect = () => {
    if (!integration) return;
    if (isApiKeyOnly) {
      setOpenApiKeyModal(true);
      return;
    }
    const width = 600;
    const height = 600;

    const popup = window.open(
      "",
      "oauth",
      `width=${width},height=${height}`
    );

    if (!popup) {
      setConnectError("Please allow popups for this site.");
      return;
    }

    startOAuth(popup);
  };
  
  const startOAuth = async (popup: Window) => {
    if (!integration) return;

    setIsConnecting(true);
    setConnectError(null);
    const previousAccountIds = (await fetchConnectedAccountsCorrect()).map((a: ConnectedAccount) => String(a.accountId ?? ""));

    try {
      const serviceKey = integration.userSecretKey ?? integration.type;
      await signInOAuthService(serviceKey, popup, undefined, userId);
      await postOAuthRefresh(previousAccountIds);
    } catch (err) {
      if (popup && !popup.closed) popup.close();
      setConnectError((err as Error)?.message ?? "OAuth failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleApiKeySubmit = async () => {
    if (!integration?.userSecretKey || !apiKey.trim()) {
      setApiKeyError("API key is required.");
      return;
    }
    setIsSubmittingApiKey(true);
    setApiKeyError("");
    try {
      const body = {
        userId,
        service: integration.userSecretKey,
        apiKey: apiKey.trim(),
        user_name: apiKeyName.trim() || undefined,
      };
      if (isEditMode && editingAccountId) {
        await apiPut(accountConnectionEndpoints.saveApiKeys(), {
          ...body,
          accountId: editingAccountId,
        }, getIntegrationHeaders());
        await fetchConnectedAccountsCorrect();
        await onRefresh();
        setOpenApiKeyModal(false);
      } else {
        await apiPost(accountConnectionEndpoints.saveApiKeys(), body, getIntegrationHeaders());
        await fetchConnectedAccountsCorrect();
        await onRefresh();
        setShowAccountConnected(true);
        setTimeout(() => setShowAccountConnected(false), 4000);
        setOpenApiKeyModal(false);
      }
    } catch (e: unknown) {
      setApiKeyError((e as { message?: string })?.message || "Failed to save API key.");
    } finally {
      setIsSubmittingApiKey(false);
    }
  };

  const handleEditApiKey = (acc: ConnectedAccount) => {
    setEditingAccountId(acc.accountId);
    setApiKey("");
    setApiKeyName(acc.name || acc.userName || "");
    setApiKeyError("");
    setIsEditMode(true);
    setOpenApiKeyModal(true);
  };

  const handleSetPrimary = async (accountId: string) => {
    if (!integration) return;
    try {
      await apiPost(orchestrationEndpoints.setPrimaryAccount(), {
        userId,
        service: integration.userSecretKey,
        accountId,
      }, getIntegrationHeaders());
      await fetchConnectedAccountsCorrect();
      setShowPrimaryUpdated(true);
      setTimeout(() => setShowPrimaryUpdated(false), 4000);
    } catch {}
  };

  const handleDisconnect = async (acc: ConnectedAccount) => {
    if (!integration?.userSecretKey) return;
    setIsDisconnecting(true);
    setDisconnectingId(acc.accountId);
    try {
      await apiPost(accountConnectionEndpoints.logout(), {
        userId,
        service: integration.userSecretKey,
        accountId: acc.accountId,
      }, getIntegrationHeaders());
      await fetchConnectedAccountsCorrect();
      await onRefresh();
      setShowAccountDisconnected(true);
      setTimeout(() => setShowAccountDisconnected(false), 4000);
    } catch {}
    finally {
      setIsDisconnecting(false);
      setDisconnectingId(null);
    }
  };

  const handleModalClose = () => {
    setOpenApiKeyModal(false);
    setIsEditMode(false);
    setEditingAccountId(null);
    setApiKey("");
    setApiKeyName("");
    setApiKeyError("");
  };

  if (!integration) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />
          <div className="relative ml-auto w-full max-w-lg h-full bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-3">
                {integration.logo && !logoError ? (
                  <img
                    src={integration.logo}
                    alt=""
                    className="h-8 w-8 rounded object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{integration.name}</h2>
                  <p className="text-sm text-gray-500">{integration.subCategory ?? integration.category}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            <div className="flex border-b">
              {(["overview", "connect", "activity"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium capitalize ${activeTab === tab ? "border-b-2 border-green-600 text-green-700" : "text-gray-600"}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "overview" && (
                <div className="space-y-4">
                  {integration.description && (
                    <p className="text-sm text-gray-600">{integration.description}</p>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-700">Connection method</p>
                    <p className="text-sm text-gray-600">
                      {isOAuth && "OAuth 2.0"}
                      {isApiKeyOnly && "API Key"}
                      {isOAuth && isApiKeyOnly && " / "}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "connect" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">Connected accounts</h3>
                    <button
                      type="button"
                      onClick={handleOAuthConnect}
                      disabled={isConnecting}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {isConnecting ? "Connecting…" : isApiKeyOnly ? "+ Add API key" : "+ Connect account"}
                    </button>
                  </div>
                  {connectError && (
                    <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">{connectError}</p>
                  )}
                  {showAccountConnected && (
                    <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Account connected successfully.</p>
                  )}
                  {showAccountDisconnected && (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Account disconnected.</p>
                  )}
                  {showPrimaryUpdated && (
                    <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Primary account updated.</p>
                  )}
                  {connectedAccounts.length === 0 ? (
                    <p className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
                      No accounts connected. Click “Connect account” to add one.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {connectedAccounts.map((acc) => (
                        <li
                          key={acc.accountId}
                          className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {!isApiKeyOnly && (
                              <input
                                type="radio"
                                name="primary"
                                checked={acc.isPrimary ?? false}
                                onChange={() => handleSetPrimary(acc.accountId)}
                                className="h-4 w-4 text-green-600"
                              />
                            )}
                            <div className="min-w-0">
                              <span className="font-medium text-gray-900 truncate block">
                                {isApiKeyOnly
                                  ? (showApiKeyMap[acc.accountId] ? acc.api_key : (acc.name || acc.userName || MASKED))
                                  : (acc.userName && acc.email ? `${acc.userName} – ${acc.email}` : acc.email || acc.userName || acc.accountId)}
                              </span>
                              {acc.isPrimary && <span className="text-xs text-green-600">Primary</span>}
                            </div>
                            {isApiKeyOnly && (
                              <button
                                type="button"
                                onClick={() => setShowApiKeyMap((p) => ({ ...p, [acc.accountId]: !p[acc.accountId] }))}
                                className="text-gray-500 hover:text-gray-700 text-sm"
                              >
                                {showApiKeyMap[acc.accountId] ? "Hide" : "Show"}
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {isApiKeyOnly && (
                              <button
                                type="button"
                                onClick={() => handleEditApiKey(acc)}
                                className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDisconnect(acc)}
                              disabled={isDisconnecting && disconnectingId === acc.accountId}
                              className="rounded border border-red-200 px-2 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {disconnectingId === acc.accountId ? "…" : "Disconnect"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === "activity" && (
                <div>
                  {loadingLogs ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                  ) : activityLogs.length === 0 ? (
                    <p className="text-sm text-gray-500">No activity yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {activityLogs.map((entry, i) => (
                        <li key={entry._id ?? i} className="border-l-2 border-gray-200 pl-3 py-1 text-sm">
                          <span className="font-medium">{entry.action ?? "Activity"}</span>
                          {entry.details && <p className="text-gray-600">{entry.details}</p>}
                          {entry.createdAt && <p className="text-xs text-gray-400">{String(entry.createdAt)}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {openApiKeyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleModalClose} aria-hidden />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {isEditMode ? "Edit API key" : "Add API key"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API key *</label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
                {apiKeyError && <p className="mt-1 text-sm text-red-600">{apiKeyError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={apiKeyName}
                  onChange={(e) => setApiKeyName(e.target.value)}
                  placeholder="Nickname for this key"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleModalClose}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApiKeySubmit}
                disabled={isSubmittingApiKey}
                className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmittingApiKey ? "Saving…" : isEditMode ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
