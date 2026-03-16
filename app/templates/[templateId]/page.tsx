import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { WorkflowDetail } from "@/lib/types";
import { TemplateRunClient } from "./TemplateRunClient";

/** Default userId for template run (integration hub, trigger URL default). Replace with real auth when available. */
const DEFAULT_USER_ID = "000000000000000000000001";

interface PageProps {
  params: Promise<{ templateId: string }>;
  searchParams?: Promise<{ userId?: string }>;
}

async function getWorkflow(id: string, userId?: string): Promise<WorkflowDetail | null> {
  try {
    const effectiveUserId = userId || DEFAULT_USER_ID;
    return await apiGet<WorkflowDetail>(`/workflow/${id}`, { userId: effectiveUserId });
  } catch {
    return null;
  }
}

export default async function TemplateRunPage({ params, searchParams }: PageProps) {
  const { templateId } = await params;
  const { userId } = (await searchParams) || {};
  const workflow = await getWorkflow(templateId, userId);

  if (!workflow) {
    notFound();
  }

  return <TemplateRunClient workflow={workflow} />;
}
