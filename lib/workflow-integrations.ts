import type { WorkflowDetail, WorkflowNode, IntegrationDetail } from "./types";

/** Node types that require an integration account to be connected. */
const NODE_TYPE_TO_INTEGRATION: Record<string, string> = {
  gmail: "gmail",
  googlesheets: "gsheets",
  gsheets: "gsheets",
  gdrive: "gdrive",
  googledrive: "gdrive",
  google_drive: "gdrive",
  gdocs: "gdocs",
  googledocs: "gdocs",
  google_docs: "gdocs",
  gcalendar: "gcalendar",
  googleslides: "gSlides",
  gslides: "gSlides",
  airtable: "airtable",
  hubspot: "hubspot",
  calendly: "calendly",
  zoho: "zoho",
  slack: "slack",
  linkedin: "linkedin",
  outlook: "outlook",
};

/**
 * Collect integration keys required by this workflow.
 * Only considers integration nodes (gmail, gsheets, gdrive, etc.) and form fields with integrationSource.
 * Non-integration node types (form, form_input, text, condition, etc.) are ignored.
 */
export function getRequiredIntegrationKeys(workflow: WorkflowDetail | null): string[] {
  if (!workflow?.nodes?.length) return [];
  const keys = new Set<string>();

  for (const node of workflow.nodes) {
    const type = (node.type ?? (node.nodeMasterId as { type?: string })?.type ?? "").toString().toLowerCase().replace(/\s+/g, "");
    const key = NODE_TYPE_TO_INTEGRATION[type];
    if (key) keys.add(key);

    const subNodes = (node as WorkflowNode).subNodes ?? [];
    for (const sub of subNodes) {
      const params = (sub as { parameters?: Record<string, unknown> }).parameters ?? {};
      const source = (params.integrationSource ?? params.sourceIntegration ?? params.integration) as string | undefined;
      if (source) {
        const srcNorm = source.toLowerCase().replace(/\s+/g, "");
        const sk = NODE_TYPE_TO_INTEGRATION[srcNorm];
        if (sk) keys.add(sk);
      }
    }
  }

  return Array.from(keys);
}

/**
 * From the integrations list (from API), return which required keys are not connected.
 */
export function getMissingIntegrations(
  requiredKeys: string[],
  integrations: IntegrationDetail[]
): { key: string; name: string }[] {
  const missing: { key: string; name: string }[] = [];
  const nameByKey: Record<string, string> = {
    gmail: "Gmail",
    gsheets: "Google Sheets",
    gdrive: "Google Drive",
    gdocs: "Google Docs",
    gcalendar: "Google Calendar",
    gSlides: "Google Slides",
    airtable: "Airtable",
    hubspot: "HubSpot",
    calendly: "Calendly",
    zoho: "Zoho",
    slack: "Slack",
    linkedin: "LinkedIn",
    outlook: "Outlook",
  };

  for (const key of requiredKeys) {
    const norm = key.toLowerCase();
    const found = integrations.find(
      (i) => (i.userSecretKey ?? i.type ?? "").toLowerCase() === norm
    );
    if (!found || found.status !== "connected") {
      missing.push({ key: norm, name: nameByKey[key] ?? found?.name ?? key });
    }
  }

  return missing;
}
