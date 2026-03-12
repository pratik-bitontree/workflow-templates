/**
 * Central API endpoints. Backend (orchestration + integration hub) runs on one host.
 * Use NEXT_PUBLIC_API_BASE_URL; local default is http://localhost:8000 (no separate user service).
 */
const API_BASE = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL)
  ? String(process.env.NEXT_PUBLIC_API_BASE_URL).replace(/\/$/, "")
  : "http://localhost:8000";

const withApiUrl = (path: string): string => `${API_BASE}${path}`;
const withMcpApiUrl = (path: string): string => `${API_BASE}/mcp${path}`;

// --- Integration Hub (templates-workflow-BE: /api/integration-hub/integrations/...) ---
export const orchestrationEndpoints = {
  getIntegrationCategories: () =>
    withApiUrl(`/api/integration-hub/integrations/categories`),
  getIntegrationDetails: (userId?: string) => {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    return withApiUrl(`/api/integration-hub/integrations/details${q}`);
  },
  getIntegrationUsageMetrics: () =>
    withApiUrl(`/api/integration-hub/integrations/usage-metrics`),
  getConnectedAccounts: (service: string, userId?: string) => {
    const q = new URLSearchParams({ service });
    if (userId) q.set("userId", userId);
    return withApiUrl(`/api/integration-hub/integrations/connectedAccounts?${q.toString()}`);
  },
  getDrivePickerToken: (userId?: string) => {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    return withApiUrl(`/api/integration-hub/integrations/drive-picker-token${q}`);
  },
  getActivityLogs: (
    _integration: string,
    userId: string,
    options?: { limit?: number }
  ) => {
    const params = new URLSearchParams({ userId });
    if (options?.limit != null) params.set("limit", String(options.limit));
    return withApiUrl(`/api/integration-hub/integrations/getActivityLogs?${params.toString()}`);
  },
  postLogActivity: () =>
    withApiUrl(`/api/integration-hub/integrations/PostLogActivity`),
  setPrimaryAccount: () =>
    withApiUrl(`/api/integration-hub/integrations/setPrimaryAccount`),
} as const;

// --- Account connections (templates-workflow-BE: /api/integration-hub/account-connections/...) ---
export const accountConnectionEndpoints = {
  saveApiKeys: () => withApiUrl(`/api/integration-hub/account-connections/api-key`),
  logout: () => withApiUrl(`/api/integration-hub/account-connections/logout`),
} as const;

// OAuth: templates-workflow-BE uses /orchestration (excluded from /api). Login is via /orchestration/:service/connect.
export const authEndpoints = {
  googleAuthCheck: (_service: string, _accountId?: string) =>
    withApiUrl(`/api/integration-hub/integrations/connectedAccounts`),
  /** URL to open in popup for Google OAuth — backend redirects to Google (templates-workflow-BE: GET /orchestration/:service/connect) */
  googleConnect: (service: string, userId?: string) => {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    return withApiUrl(`/orchestration/${encodeURIComponent(service)}/connect${q}`);
  },
  googleLogin: (service: string) =>
    withApiUrl(`/orchestration/google/login?service=${encodeURIComponent(service)}`),
  salesforceLogin: (sandbox?: boolean) => {
    const sandboxQuery = sandbox ? "?sandbox=true" : "";
    return withApiUrl(`/orchestration/salesforce/login${sandboxQuery}`);
  },
  twitterLogin: () => withApiUrl(`/orchestration/twitter/login`),
  linkedinLogin: () => withApiUrl(`/orchestration/linkedin/login`),
  wordpressLogin: () => withApiUrl(`/orchestration/wordpress/login`),
  slackLogin: () => withApiUrl(`/orchestration/slack/login`),
  facebookMarketingLogin: () => withApiUrl(`/orchestration/facebook-marketing/auth/login`),
  facebookPostsLogin: () => withApiUrl(`/orchestration/facebook/login`),
  zoomLogin: () => withApiUrl(`/orchestration/zoom/login`),
  airtableLogin: () => withApiUrl(`/orchestration/airtable/auth/login`),
  microsoftLogin: () => withApiUrl(`/orchestration/microsoft/login`),
  hubspotLogin: () => withApiUrl(`/orchestration/hubspot/auth/login`),
  calendlyLogin: () => withApiUrl(`/orchestration/calendly/login`),
  zohoLogin: (region?: string) => {
    const regionQuery = region ? `?region=${encodeURIComponent(region)}` : "";
    return withApiUrl(`/orchestration/zoho/login${regionQuery}`);
  },
  snowflakeLogin: () => withApiUrl(`/orchestration/snowflake/login`),
  telegramLogin: () => withApiUrl(`/orchestration/telegram/login`),
  gohighlevelLogin: () => withApiUrl(`/orchestration/gohigh/login`),
  calLogin: () => withApiUrl(`/orchestration/cal/login`),
  outlookLogin: () => withApiUrl(`/orchestration/outlook/login`),
  getlateConnectYoutube: () => withApiUrl(`/orchestration/getlate/connect/youtube`),
  getlateConnectInstagram: () => withApiUrl(`/orchestration/getlate/connect/instagram`),
  getlateConnectFacebook: () => withApiUrl(`/orchestration/getlate/connect/facebook`),
  getlateConnectReddit: () => withApiUrl(`/orchestration/getlate/connect/reddit`),
} as const;

/** Custom MCP (when enabled) */
export const customMCPEndpoints = {
  getMCPConfigs: (userId: string) =>
    withMcpApiUrl(`/api/v1/mcp/configs?user_id=${encodeURIComponent(userId)}`),
  getMCPConfigDetails: (configId: string) =>
    withMcpApiUrl(`/api/v1/mcp/configs/${encodeURIComponent(configId)}`),
} as const;
