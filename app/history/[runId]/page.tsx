"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import type { ExecutionDetail, NodeExecutionResult } from "@/lib/types";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatDuration(startIso: string | undefined, endIso: string | undefined): string {
  if (!startIso || !endIso) return "—";
  try {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const sec = Math.round((end - start) / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${min}m ${s}s` : `${min}m`;
  } catch {
    return "—";
  }
}

function RunSummaryBlock({ execution }: { execution: ExecutionDetail }) {
  const nodes = execution.nodes || [];
  const status = execution.status;
  const startTs = execution.startTimestamp;
  const endTs = execution.endTimestamp;
  const successCount = nodes.filter((n) => n.status === "completed").length;
  const failedCount = nodes.filter((n) => n.status === "failed").length;
  const pendingCount = nodes.filter((n) => n.status === "pending" || n.status === "ready").length;
  const statusBg =
    status === "completed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "failed"
        ? "bg-red-100 text-red-800"
        : "bg-sky-100 text-sky-800";

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 shadow-sm mb-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-grey">Run Summary</h2>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          <strong>Success</strong> {successCount}
        </span>
        <span className="flex items-center gap-1.5 text-red-700">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden />
          <strong>Failed</strong> {failedCount}
        </span>
        <span className="flex items-center gap-1.5 text-sky-700">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-500" aria-hidden />
          <strong>Pending</strong> {pendingCount}
        </span>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="text-xs font-medium uppercase text-primary-grey">Workflow Run ID</p>
          <p className="mt-0.5 font-mono text-primary-black truncate" title={execution._id}>
            {execution._id?.slice(-16) ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-primary-grey">Start Time</p>
          <p className="mt-0.5 text-primary-black">{startTs ? formatTime(startTs) : "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-primary-grey">End Time</p>
          <p className="mt-0.5 text-primary-black">{endTs ? formatTime(endTs) : "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-primary-grey">Duration</p>
          <p className="mt-0.5 text-primary-black">{formatDuration(startTs, endTs)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-primary-grey">Main Workflow</p>
          <p className="mt-0.5">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBg}`}>
              {status || "pending"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function NodeOutput({ node }: { node: NodeExecutionResult }) {
  const result = node.result;
  const hasResult =
    result !== undefined &&
    result !== null &&
    (typeof result !== "object" || Object.keys(result as object).length > 0);

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-primary-black">{node.nodeName || node.nodeId}</span>
        <span className="text-xs text-primary-grey">{node.type}</span>
      </div>
      <div className="text-sm text-primary-grey">
        Status:{" "}
        <span className={node.status === "completed" ? "text-primary-green" : ""}>
          {node.status}
        </span>
      </div>
      {hasResult && (
        <pre className="mt-2 overflow-auto rounded bg-primary-light-gray p-3 text-xs">
          {typeof result === "object" ? JSON.stringify(result, null, 2) : String(result)}
        </pre>
      )}
    </li>
  );
}

function ExecutionResults({ execution }: { execution: ExecutionDetail }) {
  const nodes = execution.nodes || [];
  const status = execution.status;

  return (
    <div className="space-y-6">
      <RunSummaryBlock execution={execution} />
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-primary-light-gray/50 px-3 py-2">
        <span className="font-medium text-primary-black">Status:</span>
        <span
          className={
            status === "completed" ? "text-primary-green font-medium" : "text-primary-grey"
          }
        >
          {status}
        </span>
      </div>
      {nodes.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-primary-black">Node outputs</h2>
          <ul className="space-y-4">
            {nodes.map((node) => (
              <NodeOutput key={node.nodeId} node={node} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function HistoryRunDetailPage() {
  const params = useParams();
  const runId = params?.runId as string | undefined;
  const [execution, setExecution] = useState<ExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setLoading(false);
      setError("Missing run ID");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiGet<ExecutionDetail>(`/executions/${runId}`)
      .then((data) => {
        if (!cancelled) {
          setExecution(data);
        }
      })
      .catch((e: ApiError) => {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load execution details");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (!runId) {
    return (
      <div className="space-y-4">
        <Link href="/history" className="text-sm text-primary-green hover:underline">
          ← Back to History
        </Link>
        <p className="text-primary-grey">Invalid run ID.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/history" className="text-sm text-primary-green hover:underline">
        ← Back to History
      </Link>
      <h1 className="text-2xl font-bold text-primary-black">Workflow run details</h1>
      <p className="font-mono text-sm text-primary-grey break-all">{runId}</p>

      {loading && (
        <div className="flex items-center gap-2 text-primary-grey">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-green border-t-transparent" />
          <span>Loading…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && execution && (
        <ExecutionResults execution={execution} />
      )}
    </div>
  );
}
