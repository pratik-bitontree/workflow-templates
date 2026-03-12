import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { WorkflowDetail } from "@/lib/types";
import { TemplateRunClient } from "./TemplateRunClient";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

async function getWorkflow(id: string): Promise<WorkflowDetail | null> {
  try {
    return await apiGet<WorkflowDetail>(`/workflow/${id}`);
  } catch {
    return null;
  }
}

export default async function TemplateRunPage({ params }: PageProps) {
  const { templateId } = await params;
  const workflow = await getWorkflow(templateId);

  if (!workflow) {
    notFound();
  }

  return <TemplateRunClient workflow={workflow} />;
}
