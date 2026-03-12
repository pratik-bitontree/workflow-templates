"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import type { WorkflowHistoryResponse, WorkflowRunHistoryItem } from "@/lib/types";

const DEFAULT_USER_ID = "000000000000000000000001";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  const statusLower = status?.toLowerCase() ?? "";
  const isFailed = statusLower === "failed";
  const isStopped = statusLower === "stopped";
  const isCompleted = statusLower === "completed" || statusLower === "partially-completed";
  const bg = isFailed
    ? "bg-amber-100 text-amber-800"
    : isStopped
      ? "bg-orange-100 text-orange-800"
      : isCompleted
        ? "bg-emerald-100 text-emerald-800"
        : "bg-gray-100 text-gray-800";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${bg}`}>
      {status || "pending"}
    </span>
  );
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<"history" | "schedule">("history");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState<WorkflowHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        userId: DEFAULT_USER_ID,
        limit: "50",
        offset: "0",
      };
      if (search.trim()) params.search = search.trim();
      const query = new URLSearchParams(params).toString();
      const res = await apiGet<WorkflowHistoryResponse>(`/workflow/history?${query}`);
      setData(res);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Failed to load history");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
  }, [activeTab, fetchHistory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const runs = data?.runs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-primary-black">Workflow runs</h1>
        <Link
          href="/templates"
          className="text-sm text-primary-green hover:underline"
        >
          ← Back to templates
        </Link>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`border-b-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "border-primary-green text-primary-green"
                : "border-transparent text-primary-grey hover:text-primary-black"
            }`}
          >
            History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("schedule")}
            className={`border-b-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "schedule"
                ? "border-primary-green text-primary-green"
                : "border-transparent text-primary-grey hover:text-primary-black"
            }`}
          >
            Schedule
          </button>
        </nav>
      </div>

      {activeTab === "history" && (
        <>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-64 focus:border-primary-green focus:outline-none focus:ring-1 focus:ring-primary-green"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary-green px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Search
            </button>
          </form>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-primary-grey">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-green border-t-transparent" />
              <span>Loading history…</span>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-primary-light-gray">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-primary-black">
                        Workflow Run ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-primary-black">
                        Workflow Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-primary-black">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-primary-black">
                        Last Updated At
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-primary-black">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {runs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-primary-grey">
                          No workflow runs found.
                        </td>
                      </tr>
                    ) : (
                      runs.map((run: WorkflowRunHistoryItem) => (
                        <tr key={run._id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-primary-black">
                            {run.workflowRunId}
                          </td>
                          <td className="px-4 py-3 text-sm text-primary-black">
                            {run.workflowName}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={run.status} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-primary-grey">
                            {formatDate(run.lastUpdatedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/history/${run.workflowRunId}`}
                              className="inline-flex rounded-lg bg-primary-green px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                            >
                              View Details
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "schedule" && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-primary-grey">
          Scheduled runs will appear here. This feature can be added later.
        </div>
      )}
    </div>
  );
}
