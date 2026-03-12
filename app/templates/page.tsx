import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { apiGet } from "@/lib/api";
import type { WorkflowListItem } from "@/lib/types";

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
      {templates.length === 0 ? (
        <p className="text-primary-grey">No templates found. Make sure the backend is running and has prebuilt workflows.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Link
              key={t._id}
              href={`/templates/${t._id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary-green hover:shadow-md"
            >
              {t.image && (
                <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-primary-light-gray">
                  <img
                    src={t.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <h2 className="font-semibold text-primary-black mb-1">{t.name}</h2>
              <p className="text-sm text-primary-grey line-clamp-3">
                {t.description || "No description."}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
