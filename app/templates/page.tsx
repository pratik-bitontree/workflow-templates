import { unstable_noStore as noStore } from "next/cache";
import { apiGet } from "@/lib/api";
import type { WorkflowListItem } from "@/lib/types";
import TemplatesSearchAndGrid from "./TemplatesSearchAndGrid";

export const dynamic = "force-dynamic";

function normalizeList(raw: unknown): WorkflowListItem[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "data" in raw && Array.isArray((raw as { data: unknown }).data)) {
    return (raw as { data: WorkflowListItem[] }).data;
  }
  return [];
}

async function getTemplates(): Promise<WorkflowListItem[]> {
  noStore(); // Opt out of Router Cache so "back" always gets fresh data
  try {
    const list = await apiGet<unknown>("/workflow", {
      isPrebuilt: "true",
    });
    return normalizeList(list);
  } catch {
    return [];
  }
}

export default async function TemplatesPage() {
  const templates = await getTemplates();

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary-black mb-6">Templates</h1>
      <TemplatesSearchAndGrid templates={templates} />
    </div>
  );
}
