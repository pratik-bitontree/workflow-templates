"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { DynamicForm } from "@/components/DynamicForm";
import { getFormFieldsFromWorkflow } from "@/lib/form-schema";
import {
  getRequiredIntegrationKeys,
  getMissingIntegrations,
} from "@/lib/workflow-integrations";
import type {
  WorkflowDetail,
  ExecutionDetail,
  ExecutionStatus,
  ExecutionStatusNode,
  NodeExecutionResult,
  WorkflowRunHistoryItem,
  WorkflowHistoryResponse,
  IntegrationDetail,
} from "@/lib/types";
import { apiGet, apiPost, ApiError, getBackendBaseUrl } from "@/lib/api";
import { orchestrationEndpoints } from "@/lib/api-endpoints";
import { getIntegrationHeaders } from "@/lib/integration-api";

const WEBHOOK_USER_ID = "000000000000000000000001";
/** Fixed trigger node ID for all three webhook registration templates (Calendly, Cal.com, Instantly). */
const REGISTRATION_TRIGGER_NODE_ID = "6985c684f6f284b9838ea298";

/** Path segment for webhook from template name: cal | calendly | instantly */
function getWebhookRegistrationPathSegment(templateName: string): string {
  const n = (templateName || "").toLowerCase();
  if (n.includes("instantly")) return "instantly";
  if (n.includes("calendly")) return "calendly";
  if (n.includes("cal.com")) return "cal";
  return "cal";
}

/** Example trigger URL (base from NEXT_PUBLIC_API_BASE_URL). Not for input default. */
function getWebhookRegistrationExampleUrl(
  baseUrl: string,
  pathSegment: string,
  workflowId: string,
  nodeId: string,
  userId: string
): string {
  const params = new URLSearchParams({ workflowId, nodeId, userId });
  return `${baseUrl}/orchestration/workflow/${pathSegment}/trigger-webhook?${params.toString()}`;
}

/** Sort nodes by execution flow: by startTime/endTime so they appear in run order */
function sortNodesByFlow<T extends { startTime?: string; endTime?: string; nodeId?: string }>(nodes: T[]): T[] {
  return [...nodes].sort((a, b) => {
    const aStart = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bStart = b.startTime ? new Date(b.startTime).getTime() : 0;
    if (aStart !== bStart) return aStart - bStart;
    const aEnd = a.endTime ? new Date(a.endTime).getTime() : 0;
    const bEnd = b.endTime ? new Date(b.endTime).getTime() : 0;
    return aEnd - bEnd;
  });
}

const TERMINAL_STATUSES = ["completed", "failed", "stopped", "partially-completed"] as const;
const DEFAULT_USER_ID = "000000000000000000000001";

function parseIntegrationList(raw: unknown): IntegrationDetail[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const arr = Array.isArray(obj.data)
    ? obj.data
    : Array.isArray(obj.integrations)
      ? obj.integrations
      : Array.isArray((obj.data as Record<string, unknown>)?.integrations)
        ? (obj.data as Record<string, unknown>).integrations as IntegrationDetail[]
        : [];
  return Array.isArray(arr) ? arr : [];
}

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

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? "";
  const bg =
    s === "failed"
      ? "bg-amber-100 text-amber-800"
      : s === "stopped"
        ? "bg-orange-100 text-orange-800"
        : s === "completed" || s === "partially-completed"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-gray-100 text-gray-800";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${bg}`}>
      {status || "pending"}
    </span>
  );
}

interface TemplateRunClientProps {
  workflow: WorkflowDetail;
}

export function TemplateRunClient({ workflow }: TemplateRunClientProps) {
  const [runState, setRunState] = useState<"idle" | "submitting" | "polling" | "done" | "error">("idle");
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [execution, setExecution] = useState<ExecutionDetail | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<ExecutionStatusNode[]>([]);
  const [polledStatus, setPolledStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"run" | "history">("run");
  const [historyRuns, setHistoryRuns] = useState<WorkflowRunHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<ExecutionDetail | null>(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);

  const [missingIntegrations, setMissingIntegrations] = useState<{ key: string; name: string }[]>([]);
  const [registrationTriggerUrlInput, setRegistrationTriggerUrlInput] = useState("");

  const fields = getFormFieldsFromWorkflow(workflow.nodes || []);

  const isWebhookRegistrationTemplate =
    typeof workflow.name === "string" &&
    [
      "Calendly Webhook Registration",
      "Cal.com webhook Registration",
      "Instantly Webhook Registration",
    ].includes(workflow.name.trim());

  /** CRM sync templates: show webhook note only (no Run button). Add webhook to Cal.com/Calendly. */
  const WEBHOOK_NOTE_ONLY_TEMPLATES = [
    "Cal.com to Hubspot CRM Automated Contact & Meeting Sync",
    "Calendly to Zoho CRM Automated Contact & Meeting Sync",
    "Cal.com to Zoho CRM Automated Contact & Meeting Sync",
    "Calendly to Hubspot Automated Contact & Meeting Sync",
    "Campaign Reply Alert & Auto-Responder (Instantly)",
  ];
  const isWebhookNoteOnlyTemplate =
    isWebhookRegistrationTemplate ||
    (typeof workflow.name === "string" && WEBHOOK_NOTE_ONLY_TEMPLATES.includes(workflow.name.trim()));

  const registrationTriggerNode = (workflow.nodes || []).find((n) => {
    const t = (n.type || "").toLowerCase();
    return t === "calendly" || t === "cal" || t === "instantly";
  });

  const registrationPathSegment = getWebhookRegistrationPathSegment(workflow.name || "");
  const webhookBaseUrl = getBackendBaseUrl();
  const registrationExampleUrl =
    (isWebhookNoteOnlyTemplate || (isWebhookRegistrationTemplate && registrationTriggerNode)) && workflow._id
      ? getWebhookRegistrationExampleUrl(
          webhookBaseUrl,
          registrationPathSegment,
          workflow._id,
          REGISTRATION_TRIGGER_NODE_ID,
          WEBHOOK_USER_ID
        )
      : "";
  const webhookServiceName =
    registrationPathSegment === "cal" ? "Cal.com" : registrationPathSegment === "calendly" ? "Calendly" : registrationPathSegment === "instantly" ? "Instantly" : "your service";

  useEffect(() => {
    const required = getRequiredIntegrationKeys(workflow);
    if (required.length === 0) {
      setMissingIntegrations([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = orchestrationEndpoints.getIntegrationDetails(DEFAULT_USER_ID);
        const res = await fetch(url, {
          cache: "no-store",
          headers: { "Content-Type": "application/json", ...getIntegrationHeaders() },
        });
        const data = await res.json().catch(() => ({}));
        const list = parseIntegrationList(data);
        if (cancelled) return;
        const missing = getMissingIntegrations(required, list);
        setMissingIntegrations(missing);
      } catch {
        if (!cancelled) setMissingIntegrations([]);
      }
    })();
    return () => { cancelled = true; };
  }, [workflow._id, workflow.nodes]);

  const fetchFullExecution = useCallback(async (execId: string) => {
    try {
      const data = await apiGet<ExecutionDetail>(`/executions/${execId}`);
      setExecution(data);
      setRunState("done");
    } catch (e) {
      const err = e as ApiError;
      setErrorMessage(err?.message || "Failed to load execution result.");
      setRunState("error");
    }
  }, []);

  const pollStatus = useCallback(async (): Promise<boolean> => {
    if (!executionId || !workflow._id) return true;
    try {
      const statusData = await apiGet<ExecutionStatus>(
        `/workflow/${workflow._id}/status/${executionId}`
      );
      setPolledStatus(statusData.status);
      if (statusData.nodes?.length) setNodeStatuses(statusData.nodes);
      if (TERMINAL_STATUSES.includes(statusData.status as (typeof TERMINAL_STATUSES)[number])) {
        await fetchFullExecution(executionId);
        return true;
      }
    } catch (e) {
      const err = e as ApiError;
      setErrorMessage(err?.message || "Failed to fetch workflow status.");
      setRunState("error");
      return true;
    }
    return false;
  }, [executionId, workflow._id, fetchFullExecution]);

  useEffect(() => {
    if (!executionId || runState !== "polling") return;
    setNodeStatuses([]);
    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [executionId, runState, pollStatus]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const query = new URLSearchParams({
        userId: DEFAULT_USER_ID,
        workflowId: workflow._id,
        limit: "50",
        offset: "0",
      }).toString();
      const res = await apiGet<WorkflowHistoryResponse>(`/workflow/history?${query}`);
      setHistoryRuns(res.runs ?? []);
    } catch {
      setHistoryRuns([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [workflow._id]);

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
  }, [activeTab, fetchHistory]);

  const handleViewDetails = useCallback(async (runId: string) => {
    setSelectedRunId(runId);
    setHistoryDetail(null);
    setHistoryDetailLoading(true);
    try {
      const data = await apiGet<ExecutionDetail>(`/executions/${runId}`);
      setHistoryDetail(data);
    } catch {
      setHistoryDetail(null);
    } finally {
      setHistoryDetailLoading(false);
    }
  }, []);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    setRunState("submitting");
    setErrorMessage(null);
    setExecution(null);
    setNodeStatuses([]);
    setPolledStatus(null);
    try {
      const input = Object.entries(values).map(([variableName, variableValue]) => ({
        variableName,
        variableValue,
      }));
      const res = await apiPost<{ workflowExecutionId: string; workflowId: string }>(
        "/workflow/create-execution",
        {
          workflowId: workflow._id,
          input,
        }
      );
      setExecutionId(res.workflowExecutionId);
      setRunState("polling");
    } catch (e) {
      const err = e as ApiError;
      setErrorMessage(err?.message || "Failed to start workflow.");
      setRunState("error");
    }
  };

  return (
    <div className={activeTab === "run" ? "max-w-6xl" : "max-w-4xl"}>
      <Link href="/templates" className="text-sm text-primary-green hover:underline mb-4 inline-block">
        ← Back to templates
      </Link>
      <h1 className="text-2xl font-bold text-primary-black mb-2">{workflow.name}</h1>
      {workflow.description && (
        <p className="text-primary-grey text-sm mb-6 whitespace-pre-wrap">{workflow.description}</p>
      )}

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab("run")}
            className={`border-b-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "run"
                ? "border-primary-green text-primary-green"
                : "border-transparent text-primary-grey hover:text-primary-black"
            }`}
          >
            Run
          </button>
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
        </nav>
      </div>

      {activeTab === "run" && (
        <div
          className="flex min-h-0 flex-col gap-6 lg:flex-row lg:items-stretch"
          style={{ minHeight: "min(600px, calc(100vh - 320px))" }}
        >
          {/* Left: form – always visible, scrollable */}
          <div className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:max-w-md">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary-grey">
              Input parameters
            </h2>
            {isWebhookNoteOnlyTemplate && registrationExampleUrl ? (
              <div className="space-y-5 text-sm">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <p className="font-medium">Setup note</p>
                  <p className="mt-1 text-primary-grey">
                  Add this webhook to <strong>{webhookServiceName}</strong>’s: use this template&apos;s Workflow ID, Node ID 6985c684f6f284b9838ea298, and User ID below. 
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase text-primary-grey">
                    Webhook URL <span className="normal-case font-normal">(copy and add to {webhookServiceName})</span>
                  </label>
                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs text-primary-black break-all">
                    {registrationExampleUrl}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase text-primary-grey">Trigger node ID</label>
                  <input
                    type="text"
                    readOnly
                    value={REGISTRATION_TRIGGER_NODE_ID}
                    className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 font-mono text-xs text-primary-black"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase text-primary-grey">User ID</label>
                    <input
                      type="text"
                      readOnly
                      value={WEBHOOK_USER_ID}
                      className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 font-mono text-xs text-primary-black"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase text-primary-grey">Workflow ID</label>
                    <input
                      type="text"
                      readOnly
                      value={workflow._id}
                      className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 font-mono text-xs text-primary-black"
                    />
                  </div>
                </div>

                {isWebhookRegistrationTemplate && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium uppercase text-primary-grey">
                        Trigger URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={registrationTriggerUrlInput}
                        onChange={(e) => setRegistrationTriggerUrlInput(e.target.value)}
                        placeholder="Paste the trigger URL from above or type your URL"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs text-primary-black placeholder:text-gray-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSubmit({ trigger_url: registrationTriggerUrlInput })}
                      disabled={runState === "submitting" || !registrationTriggerUrlInput.trim()}
                      className="rounded-lg bg-primary-green px-5 py-2.5 text-white font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {runState === "submitting" ? "Running…" : "Run workflow"}
                    </button>
                  </>
                )}
              </div>
            ) : fields.length > 0 ? (
              <DynamicForm
                fields={fields}
                onSubmit={handleSubmit}
                isSubmitting={runState === "submitting"}
                submitLabel="Run workflow"
                disableSubmit={missingIntegrations.length > 0}
              />
            ) : (
              <div className="space-y-4">
                <p className="text-primary-grey text-sm">This template has no required inputs.</p>
                <button
                  type="button"
                  onClick={() => handleSubmit({})}
                  disabled={runState === "submitting"}
                  className="rounded-lg bg-primary-green px-5 py-2.5 text-white font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {runState === "submitting" ? "Running…" : "Run workflow"}
                </button>
              </div>
            )}
          </div>

          {/* Right: status / output – always visible when running or done, scrollable */}
          <div className="flex min-h-[320px] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:min-h-0">
            <h2 className="border-b border-gray-200 bg-primary-light-gray px-4 py-3 text-sm font-semibold text-primary-black">
              Output &amp; status
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {runState === "idle" && (
                <p className="text-primary-grey text-sm">
                  Run the workflow to see live node status and results here.
                </p>
              )}
              {runState === "submitting" && (
                <div className="flex items-center gap-2 text-primary-grey">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-green border-t-transparent" />
                  <span>Starting workflow…</span>
                </div>
              )}
              {runState === "polling" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary-grey">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-green border-t-transparent" />
                    <span>Workflow running…</span>
                  </div>
                  {(nodeStatuses.length > 0 || polledStatus) && (
                    <ExecutionResults
                      execution={{
                        _id: executionId!,
                        status: polledStatus ?? "running",
                        nodes: sortNodesByFlow(nodeStatuses),
                      }}
                    />
                  )}
                </div>
              )}
              {runState === "error" && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                  <p className="font-medium">Error</p>
                  <p className="mt-1 text-sm">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => setRunState("idle")}
                    className="mt-3 text-sm text-primary-green hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}
              {runState === "done" && execution && (
                <ExecutionResults execution={execution} />
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-6">
          {/* When Run details is open, hide the list; show list only when details are closed */}
          {!selectedRunId && (
            historyLoading ? (
              <div className="flex items-center gap-2 text-primary-grey">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-green border-t-transparent" />
                <span>Loading history…</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-primary-grey">
                  Total items: <strong className="text-primary-black">{historyRuns.length}</strong>
                  {historyRuns.length > 0 && " (showing all runs)"}
                </p>
                {historyRuns.length === 0 ? (
                  <p className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-primary-grey">
                    No runs for this template yet.
                  </p>
                ) : (
                  historyRuns.map((run) => (
                    <div
                      key={run._id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="font-mono text-sm text-primary-black">{run.workflowRunId}</span>
                        <StatusBadge status={run.status} />
                        <span className="text-sm text-primary-grey">{formatDate(run.lastUpdatedAt)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewDetails(run.workflowRunId)}
                        className="inline-flex rounded-lg bg-primary-green px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                      >
                        View Details
                      </button>
                    </div>
                  ))
                )}
              </div>
            )
          )}

          {selectedRunId && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-primary-black">Run details</h2>
                <button
                  type="button"
                  onClick={() => { setSelectedRunId(null); setHistoryDetail(null); }}
                  className="text-sm text-primary-grey hover:text-primary-green"
                >
                  Close
                </button>
              </div>
              <p className="font-mono text-xs text-primary-grey mb-4">{selectedRunId}</p>
              {historyDetailLoading ? (
                <div className="flex items-center gap-2 text-primary-grey">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-green border-t-transparent" />
                  <span>Loading…</span>
                </div>
              ) : historyDetail ? (
                <ExecutionResults execution={historyDetail} />
              ) : (
                <p className="text-primary-grey text-sm">Could not load run details.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RunSummary({ execution }: { execution: ExecutionDetail }) {
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
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-grey">Run Summary</h3>
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
            {execution._id?.slice(-12) ?? "—"}
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

function ExecutionResults({ execution }: { execution: ExecutionDetail }) {
  const nodes = sortNodesByFlow(execution.nodes || []);
  const status = execution.status;

  return (
    <div className="space-y-5">
      <RunSummary execution={execution} />
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-primary-light-gray/50 px-3 py-2">
        <span className="font-medium text-primary-black">Status</span>
        <span className={status === "completed" ? "text-primary-green font-medium" : "text-primary-grey"}>
          {status}
        </span>
      </div>
      {nodes.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary-grey">Node flow</h3>
          <ul className="space-y-2">
            {nodes.map((node) => (
              <NodeOutput key={node.nodeId} node={node} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NodeOutput({ node }: { node: NodeExecutionResult }) {
  const result = node.result;
  const hasResult = result !== undefined && result !== null && (typeof result !== "object" || Object.keys(result as object).length > 0);
  const isCompleted = node.status === "completed";
  const defaultOpen = isCompleted && hasResult;
  const [open, setOpen] = useState(defaultOpen);

  const statusColor =
    node.status === "completed"
      ? "text-emerald-600"
      : node.status === "failed"
        ? "text-amber-600"
        : node.status === "skipped"
          ? "text-gray-500"
          : "text-primary-grey";

  return (
    <li className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50/80"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs text-primary-grey">
            {node.type?.slice(0, 1).toUpperCase() || "?"}
          </span>
          <span className="min-w-0 truncate font-medium text-primary-black">
            {node.nodeName || node.nodeId}
          </span>
          <span className={`shrink-0 text-xs font-medium ${statusColor}`}>{node.status}</span>
        </div>
        <span className="shrink-0 text-primary-grey" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4">
          <div className="mb-2 text-xs text-primary-grey">
            Type: {node.type} {node.endTime && ` · Ended ${formatDate(node.endTime)}`}
          </div>
          {hasResult ? (
            <pre className="max-h-72 overflow-auto rounded-lg bg-white p-3 text-xs shadow-inner border border-gray-100">
              {typeof result === "object" ? JSON.stringify(result, null, 2) : String(result)}
            </pre>
          ) : (
            <p className="text-xs text-primary-grey">No output</p>
          )}
        </div>
      )}
    </li>
  );
}
