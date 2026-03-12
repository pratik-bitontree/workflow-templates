import type { IntegrationDetail } from "@/lib/types";
import { IntegrationsClient } from "./IntegrationsClient";
import { orchestrationEndpoints } from "@/lib/api-endpoints";
import { getIntegrationHeaders } from "@/lib/integration-api";

function parseIntegrationList(raw: unknown): IntegrationDetail[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const arr = Array.isArray(obj.data)
    ? obj.data
    : Array.isArray(obj.integrations)
      ? obj.integrations
      : Array.isArray((obj.data as Record<string, unknown>)?.integrations)
        ? (obj.data as Record<string, unknown>).integrations as IntegrationDetail[]
        : Array.isArray(obj)
          ? (obj as IntegrationDetail[])
          : [];
  return Array.isArray(arr) ? arr : [];
}

async function getIntegrations(): Promise<IntegrationDetail[]> {
  try {
    const url = orchestrationEndpoints.getIntegrationDetails();
    const headers = getIntegrationHeaders();
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...headers },
    });
    const data = await res.json().catch(() => ({}));
    return parseIntegrationList(data);
  } catch {
    return [];
  }
}

export default async function IntegrationsPage() {
  const integrations = await getIntegrations();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Integration Hub</h1>
      <p className="text-gray-600 text-sm mb-6">
        Connect your accounts to use them in workflow templates. Click an integration to connect via OAuth or add an API key.
      </p>
      <IntegrationsClient initialIntegrations={integrations} />
    </div>
  );
}
