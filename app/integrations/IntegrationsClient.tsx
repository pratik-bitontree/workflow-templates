"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { IntegrationDetail } from "@/lib/types";
import { orchestrationEndpoints } from "@/lib/api-endpoints";
import { getIntegrationHeaders } from "@/lib/integration-api";
import { IntegrationCards } from "./IntegrationCards";
import { IntegrationDrawer } from "./IntegrationDrawer";

/** Parse API response into integration list (handles { data }, { data: { integrations } }, or raw array). */
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

interface IntegrationsClientProps {
  initialIntegrations: IntegrationDetail[];
}

type StatusFilter = "all" | "connected" | "disconnected";

function filterIntegrations(
  list: IntegrationDetail[],
  search: string,
  statusFilter: StatusFilter
): IntegrationDetail[] {
  const q = search.trim().toLowerCase();
  let out = list;
  if (q) {
    out = out.filter(
      (i) =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.type && i.type.toLowerCase().includes(q)) ||
        (i.subCategory && i.subCategory.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q))
    );
  }
  if (statusFilter === "connected") {
    out = out.filter((i) => i.status === "connected");
  } else if (statusFilter === "disconnected") {
    out = out.filter((i) => i.status !== "connected");
  }
  return out;
}

export function IntegrationsClient({ initialIntegrations }: IntegrationsClientProps) {
  const [integrations, setIntegrations] = useState<IntegrationDetail[]>(initialIntegrations);
  const [selected, setSelected] = useState<IntegrationDetail | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredIntegrations = useMemo(
    () => filterIntegrations(integrations, search, statusFilter),
    [integrations, search, statusFilter]
  );

  const refresh = useCallback(async () => {
    try {
      const url = orchestrationEndpoints.getIntegrationDetails();
      const headers = getIntegrationHeaders();
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...headers },
      });
      const data = await res.json().catch(() => ({}));
      const list = parseIntegrationList(data);
      setIntegrations(list);
    } catch {
      setIntegrations((prev) => prev);
    }
  }, []);

  // Refetch on mount so listing is visible even when SSR fetch failed (e.g. wrong host or backend down during build).
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="search"
            placeholder="Search by name, type or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-4 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            aria-label="Search integrations"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            aria-label="Filter by status"
          >
            <option value="all">All</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Not connected</option>
          </select>
        </div>
      </div>
      <IntegrationCards
        integrations={filteredIntegrations}
        onSelectIntegration={setSelected}
        emptyMessage={
          integrations.length === 0
            ? "No integrations configured. Ensure the backend is running and integration hub is set up."
            : "No integrations match your search or filter."
        }
      />
      <IntegrationDrawer
        integration={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        onRefresh={refresh}
      />
    </>
  );
}
