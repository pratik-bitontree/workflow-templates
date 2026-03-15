"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { WorkflowListItem } from "@/lib/types";

type SortOption = "name-asc" | "name-desc" | "newest" | "oldest";

function filterTemplates(templates: WorkflowListItem[], query: string): WorkflowListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return templates;
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q)
  );
}

function sortTemplates(templates: WorkflowListItem[], sort: SortOption): WorkflowListItem[] {
  const list = [...templates];
  switch (sort) {
    case "name-asc":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return list.sort((a, b) => b.name.localeCompare(a.name));
    case "newest":
      return list.sort((a, b) => {
        const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const db = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return db - da;
      });
    case "oldest":
      return list.sort((a, b) => {
        const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const db = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return da - db;
      });
    default:
      return list;
  }
}

export default function TemplatesSearchAndGrid({
  templates,
}: {
  templates: WorkflowListItem[];
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("name-asc");

  const filteredAndSorted = useMemo(() => {
    const filtered = filterTemplates(templates, search);
    return sortTemplates(filtered, sort);
  }, [templates, search, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-grey">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-primary-black placeholder:text-primary-grey focus:border-primary-green focus:outline-none focus:ring-1 focus:ring-primary-green"
            aria-label="Search templates"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="sort-templates" className="text-sm font-medium text-primary-grey whitespace-nowrap">
            Sort by
          </label>
          <select
            id="sort-templates"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-primary-black focus:border-primary-green focus:outline-none focus:ring-1 focus:ring-primary-green"
          >
            <option value="name-asc">Name (A–Z)</option>
            <option value="name-desc">Name (Z–A)</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {filteredAndSorted.length === 0 ? (
        <p className="text-primary-grey">
          {templates.length === 0
            ? "No templates found. Make sure the backend is running and has prebuilt workflows."
            : "No templates match your search. Try a different query."}
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSorted.map((t) => (
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

      {search && filteredAndSorted.length > 0 && (
        <p className="text-sm text-primary-grey">
          Showing {filteredAndSorted.length} of {templates.length} template
          {templates.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
