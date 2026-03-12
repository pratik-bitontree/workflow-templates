import { API_BASE } from "./api";
import type { IntegrationDetail, ConnectedAccount } from "./types";

const localBase = API_BASE.replace(/\/$/, "");
const growstackUsersUrl = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_GROWSTACK_USERS_URL)
  ? String(process.env.NEXT_PUBLIC_GROWSTACK_USERS_URL).replace(/\/$/, "")
  : "";

export const isGrowStackIntegrationMode = (): boolean => !!growstackUsersUrl;

/** Same shape as GrowStack: https://testing.growstack.ai/users/api/v1/integrationHub/... with optional Bearer */
export function getIntegrationHeaders(): Record<string, string> {
  const token = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GROWSTACK_AUTH_TOKEN : "";
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

const base = growstackUsersUrl || localBase;
const pathPrefix = growstackUsersUrl ? "api/v1/integrationHub" : "integration-hub";

function detailsUrl(userId: string): string {
  if (growstackUsersUrl) return `${base}/${pathPrefix}/integrations/details`;
  return `${base}/${pathPrefix}/integrations/details?userId=${encodeURIComponent(userId)}`;
}

function connectedAccountsUrl(userId: string, service: string): string {
  if (growstackUsersUrl) return `${base}/${pathPrefix}/integrations/connectedAccounts?service=${encodeURIComponent(service)}`;
  return `${base}/${pathPrefix}/integrations/connectedAccounts?userId=${encodeURIComponent(userId)}&service=${encodeURIComponent(service)}`;
}

export const integrationEndpoints = {
  getDetails: (userId: string) => detailsUrl(userId),
  getCategories: (userId: string) =>
    growstackUsersUrl
      ? `${base}/${pathPrefix}/integrations/categories`
      : `${base}/${pathPrefix}/integrations/categories?userId=${encodeURIComponent(userId)}`,
  getConnectedAccounts: (userId: string, service: string) => connectedAccountsUrl(userId, service),
  setPrimaryAccount: () => `${base}/${pathPrefix}/integrations/setPrimaryAccount`,
  postLogActivity: () => `${base}/${pathPrefix}/integrations/PostLogActivity`,
  getActivityLogs: (userId: string, limit?: number) =>
    growstackUsersUrl
      ? `${base}/${pathPrefix}/integrations/getActivityLogs${limit != null ? `?limit=${limit}` : ""}`
      : `${base}/${pathPrefix}/integrations/getActivityLogs?userId=${encodeURIComponent(userId)}${limit != null ? `&limit=${limit}` : ""}`,
  oauthLogin: (service: string, userId: string) =>
    growstackUsersUrl
      ? `${base}/${pathPrefix}/oauth/login?service=${encodeURIComponent(service)}`
      : `${base}/integration-hub/oauth/login?service=${encodeURIComponent(service)}&userId=${encodeURIComponent(userId)}`,
  oauthAuthCheck: (service: string, userId: string) =>
    growstackUsersUrl
      ? `${base}/${pathPrefix}/integrations/connectedAccounts?service=${encodeURIComponent(service)}`
      : `${base}/integration-hub/oauth/auth-check?service=${encodeURIComponent(service)}&userId=${encodeURIComponent(userId)}`,
  saveApiKey: () => (growstackUsersUrl ? `${base}/api/v1/integrationHub/account-connections/api-key` : `${base}/integration-hub/account-connections/api-key`),
  updateApiKey: () => (growstackUsersUrl ? `${base}/api/v1/integrationHub/account-connections/api-key` : `${base}/integration-hub/account-connections/api-key`),
  logout: () => (growstackUsersUrl ? `${base}/api/v1/integrationHub/account-connections/logout` : `${base}/integration-hub/account-connections/logout`),
} as const;

export const getOAuthConnectBaseUrl = (): string => {
  const url = typeof process !== "undefined" && process.env.NEXT_PUBLIC_OAUTH_CONNECT_BASE_URL
    ? String(process.env.NEXT_PUBLIC_OAUTH_CONNECT_BASE_URL).replace(/\/$/, "")
    : (typeof process !== "undefined" && process.env.NEXT_PUBLIC_CONNECT_BASE_URL)
      ? String(process.env.NEXT_PUBLIC_CONNECT_BASE_URL).replace(/\/$/, "")
      : "";
  return url;
};

export type { IntegrationDetail, ConnectedAccount };
