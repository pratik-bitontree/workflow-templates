/**
 * OAuth and integration auth helpers using api-endpoints (orchestration + user service).
 * Single implementation — no duplicate signInOAuthService in components.
 */
import instance from "@/lib/axios-instance";
import { authEndpoints } from "@/lib/api-endpoints";

const SERVICE_NAME_MAPPING: Record<string, string> = {
  gmail: "gmail",
  youtube: "youtube",
  googleDrive: "gdrive",
  googleSheets: "gsheets",
  googleDocs: "gdocs",
  googleCalendar: "gcalendar",
  google_ads: "gAds",
  googlecalendar: "gcalendar",
  googlesheets: "gsheets",
  googledrive: "gdrive",
  googledocs: "gdocs",
  gslides: "gSlides",
  twitter: "twitter",
  linkedin: "linkedin",
  "linkedin-marketing": "linkedin",
  wordpress: "wordpress",
  slack: "slack",
  facebook_marketing: "facebook",
  airtable: "airtable",
  salesforce: "salesforce",
  zoom: "zoom",
  "microsoft-teams": "microsoft-teams",
  hubspot: "hubspot",
  calendly: "calendly",
  apollo: "apollo",
  campaign: "smart_lead",
  "campaign-sequence": "smart_lead",
  undetectableai: "undetectableai",
  snowflake: "snowflake",
  openproject: "openproject",
  happierleads: "happierleads",
  telegram: "telegram",
  facebook_posts: "facebook_posts",
  cal: "cal",
  openai: "openai",
  anthropic: "anthropic",
  gemini: "gemini",
  perplexity: "perplexity",
  mistral: "mistral",
  growstackai: "growstackai",
  brandmentions: "brandMentions",
  outlook: "outlook",
};

export function getApiServiceName(service: string): string {
  return SERVICE_NAME_MAPPING[service] ?? service;
}

export interface LoginState {
  service: string;
  email: string;
  userName: string;
  authenticated: boolean;
  tokenCreatedAt: string;
}

/**
 * Starts OAuth flow: gets auth URL from orchestration, opens/navigates popup, polls auth-check until done.
 * Caller must open the popup synchronously on user click (before any await) to avoid blockers.
 */
export async function signInOAuthService(
  service: string,
  existingWindow: Window | null,
  setLogin?: (state: LoginState) => void,
  _userId?: string
): Promise<void> {
  if (!existingWindow || existingWindow.closed) {
    throw new Error("Popup was blocked or closed. Allow popups for this site and try again.");
  }

  // Google OAuth: templates-workflow-BE uses /orchestration/:service/connect (redirect to Google). Open popup directly.
  const googleServices = ["gmail", "gsheets", "gdocs", "gcalendar", "gdrive", "googledrive", "gAds", "gSlides", "youtube"];
  if (googleServices.includes(service)) {
    const connectUrl = authEndpoints.googleConnect(service, _userId);
    try {
      existingWindow.location.href = connectUrl;
    } catch (navErr) {
      if (existingWindow && !existingWindow.closed) existingWindow.close();
      throw new Error("Could not navigate popup to login page. Try allowing popups and try again.");
    }
    return new Promise<void>((resolve, reject) => {
      const messageListener = (event: MessageEvent) => {
        if (event.data?.type === "OAUTH_SUCCESS") {
          if (setLogin) {
            setLogin({
              service,
              email: "",
              userName: "",
              authenticated: true,
              tokenCreatedAt: new Date().toISOString(),
            });
          }
          try {
            if (existingWindow && !existingWindow.closed) existingWindow.close();
          } catch {}
          clearTimeout(timeoutId);
          window.removeEventListener("message", messageListener);
          resolve();
        } else if (event.data?.type === "OAUTH_ERROR") {
          clearTimeout(timeoutId);
          window.removeEventListener("message", messageListener);
          reject(new Error(event.data?.error || "OAuth failed"));
        }
      };
      window.addEventListener("message", messageListener);
      const timeoutId = setTimeout(() => {
        window.removeEventListener("message", messageListener);
        reject(new Error("OAuth timeout - no response from popup"));
      }, 120000);
    });
  }

  let response: { data?: { data?: { authUrl?: string; url?: string }; authUrl?: string; url?: string } };
  switch (service) {
    case "salesforce":
      response = await instance.get(authEndpoints.salesforceLogin(false));
      break;
    case "salesforce-sandbox":
      response = await instance.get(authEndpoints.salesforceLogin(true));
      break;
    case "linkedin":
      response = await instance.get(authEndpoints.linkedinLogin());
      break;
    case "twitter":
      response = await instance.get(authEndpoints.twitterLogin());
      break;
    case "wordpress":
      response = await instance.get(authEndpoints.wordpressLogin());
      break;
    case "zoom":
      response = await instance.get(authEndpoints.zoomLogin());
      break;
    case "getlate/youtube":
      response = await instance.post(authEndpoints.getlateConnectYoutube());
      break;
    case "getlate/instagram":
      response = await instance.post(authEndpoints.getlateConnectInstagram());
      break;
    case "getlate/facebook":
      response = await instance.post(authEndpoints.getlateConnectFacebook());
      break;
    case "getlate/reddit":
      response = await instance.post(authEndpoints.getlateConnectReddit());
      break;
    case "slack":
      response = await instance.get(authEndpoints.slackLogin());
      break;
    case "facebook":
    case "facebook_marketing":
      response = await instance.get(authEndpoints.facebookMarketingLogin());
      break;
    case "airtable":
      response = await instance.get(authEndpoints.airtableLogin());
      break;
    case "microsoft-teams":
      response = await instance.get(authEndpoints.microsoftLogin());
      break;
    case "hubspot":
      response = await instance.get(authEndpoints.hubspotLogin());
      break;
    case "calendly":
      response = await instance.get(authEndpoints.calendlyLogin());
      break;
    case "zoho":
      response = await instance.get(authEndpoints.zohoLogin());
      break;
    case "snowflake":
      response = await instance.get(authEndpoints.snowflakeLogin());
      break;
    case "telegram":
      response = await instance.get(authEndpoints.telegramLogin());
      break;
    case "gohighlevel":
      response = await instance.get(authEndpoints.gohighlevelLogin());
      break;
    case "facebook_posts":
      response = await instance.get(authEndpoints.facebookPostsLogin());
      break;
    case "cal":
      response = await instance.get(authEndpoints.calLogin());
      break;
    case "outlook":
      response = await instance.get(authEndpoints.outlookLogin());
      break;
    default:
      if (existingWindow && !existingWindow.closed) existingWindow.close();
      throw new Error(`Unsupported OAuth service: ${service}`);
  }

  const res = response as { data?: { data?: { authUrl?: string; url?: string; error?: string }; authUrl?: string; url?: string; error?: string }; authUrl?: string; url?: string; error?: string };
  const payload = res.data?.data ?? res.data ?? response;
  const rawAuthUrl =
    (payload as { authUrl?: string })?.authUrl
    ?? (payload as { url?: string })?.url
    ?? (typeof payload === "string" ? payload : null);
  const authUrl = typeof rawAuthUrl === "string" ? rawAuthUrl : "";
  const serverError = (payload as { error?: string })?.error;

  if (!authUrl || !authUrl.startsWith("http")) {
    if (existingWindow && !existingWindow.closed) existingWindow.close();
    throw new Error(serverError || "Invalid or missing OAuth URL from server. Check backend configuration.");
  }

  try {
    existingWindow.location.href = authUrl;
  } catch (navErr) {
    if (existingWindow && !existingWindow.closed) existingWindow.close();
    throw new Error("Could not navigate popup to login page. Try allowing popups and try again.");
  }

  let accountId: string | undefined;
  let attempts = 0;
  const maxAttempts = 50;
  let pollingStopped = false;

  const cleanup = () => {
    pollingStopped = true;
    window.removeEventListener("message", messageListener);
  };

  const messageListener = (event: MessageEvent) => {
    if (event.data?.type === "OAUTH_SUCCESS") {
      accountId = event.data.accountId;
      if (!pollingStopped) pollAuthStatus();
    } else if (event.data?.type === "OAUTH_ERROR") {
      cleanup();
      reject(new Error(event.data?.error || "OAuth failed"));
    }
  };

  let resolve: () => void;
  let reject: (err: Error) => void;
  const done = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  window.addEventListener("message", messageListener);

  const pollAuthStatus = async () => {
    if (pollingStopped) return;
    try {
      if (!accountId) {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollAuthStatus, 1000);
        } else {
          cleanup();
          reject(new Error("OAuth timeout - no response from popup"));
        }
        return;
      }

      const authCheck = await instance.get(authEndpoints.googleAuthCheck(service, accountId));
      const success = (authCheck?.data as { success?: boolean })?.success === true;

      if (success) {
        const payload = authCheck?.data as { email?: string; userName?: string; tokenCreatedAt?: string };
        if (setLogin) {
          setLogin({
            service,
            email: payload?.email ?? "",
            userName: payload?.userName ?? "",
            authenticated: true,
            tokenCreatedAt: payload?.tokenCreatedAt ?? "",
          });
        }
        try {
          if (existingWindow && !existingWindow.closed) existingWindow.close();
        } catch {}
        cleanup();
        resolve();
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(pollAuthStatus, 1000);
      } else {
        cleanup();
        reject(new Error("OAuth timeout - maximum attempts reached"));
      }
    } catch (err) {
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(pollAuthStatus, 1000);
      } else {
        cleanup();
        reject(err instanceof Error ? err : new Error("OAuth check failed"));
      }
    }
  };

  setTimeout(pollAuthStatus, 2000);
  return done;
}
