"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildAuthHeaders, getApiBase } from "@/app/lib/apiBase";

type PortfolioProject = {
  id: string;
  title: string;
  description: string;
  category: PortfolioCategory;
  imageUrl: string | null;
};

const PORTFOLIO_CATEGORIES = ["LIVING ROOM", "BEDROOM", "KITCHEN", "OTHER"] as const;
type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];

type DesignerPortfolioResponse = {
  designer?: {
    name?: string;
    designation?: string;
    branch?: string | null;
    inspirationProjects?: unknown;
  };
};

const CATEGORIES = ["ALL PROJECTS", ...PORTFOLIO_CATEGORIES] as const;

function normalizeProjects(value: unknown): PortfolioProject[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const project = item as Record<string, unknown>;
    const title = typeof project.title === "string" ? project.title.trim() : "";
    if (!title) return [];

    const rawCategory = typeof project.category === "string" ? project.category.toUpperCase() : "OTHER";
    const category: PortfolioCategory = PORTFOLIO_CATEGORIES.includes(rawCategory as PortfolioCategory)
      ? (rawCategory as PortfolioCategory)
      : "OTHER";

    return [{
      id: typeof project.id === "string" || typeof project.id === "number"
        ? String(project.id)
        : `project-${index}`,
      title,
      description: typeof project.description === "string" ? project.description : "",
      category,
      imageUrl: typeof project.imageUrl === "string" && project.imageUrl.trim()
        ? project.imageUrl
        : null,
    }];
  });
}

export default function DesignerPortfolioPage() {
  const params = useParams<{ id: string }>();
  const designerId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [designer, setDesigner] = useState<{ name: string; designation: string; branch: string | null } | null>(null);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>("ALL PROJECTS");
  const [loading, setLoading] = useState(true);
  const [loadedDesignerId, setLoadedDesignerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const invalidDesignerId = !designerId || !/^\d+$/.test(designerId) || Number(designerId) <= 0;

  useEffect(() => {
    if (!designerId || !/^\d+$/.test(designerId) || Number(designerId) <= 0) return;

    const controller = new AbortController();

    fetch(`${getApiBase()}/api/xp/designer/${encodeURIComponent(designerId)}`, {
      headers: buildAuthHeaders(null, { "Content-Type": "application/json" }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || "Failed to load designer portfolio.");
        }
        return body as DesignerPortfolioResponse;
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        if (!body.designer) throw new Error("Designer portfolio was not found.");
        setDesigner({
          name: body.designer.name || "Designer",
          designation: body.designer.designation || "Interior Designer",
          branch: body.designer.branch || null,
        });
        setProjects(normalizeProjects(body.designer.inspirationProjects));
        setError(null);
        setLoadedDesignerId(designerId);
        setLoading(false);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load designer portfolio.");
        setLoadedDesignerId(designerId);
        setLoading(false);
      });

    return () => controller.abort();
  }, [designerId]);

  const visibleProjects = useMemo(
    () => activeCategory === "ALL PROJECTS"
      ? projects
      : projects.filter((project) => project.category === activeCategory),
    [activeCategory, projects],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-[#0b0d12] dark:text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <span aria-hidden="true">←</span>
          Back to Designers
        </Link>

        {invalidDesignerId ? (
          <div role="alert" className="mt-8 rounded-2xl border border-rose-200 bg-white p-8 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-[#14171e] dark:text-rose-300">
            Invalid designer ID.
          </div>
        ) : loading || loadedDesignerId !== designerId ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-[#14171e] dark:text-slate-400">
            Loading designer portfolio…
          </div>
        ) : error ? (
          <div role="alert" className="mt-8 rounded-2xl border border-rose-200 bg-white p-8 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-[#14171e] dark:text-rose-300">
            {error}
          </div>
        ) : (
          <>
            <header className="mb-8 mt-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
                Designer Portfolio
              </p>
              <h1 className="mt-2 text-3xl font-bold">{designer?.name}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {designer?.designation}{designer?.branch ? ` · ${designer.branch}` : ""}
              </p>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                {projects.length} {projects.length === 1 ? "project" : "projects"}
              </p>
            </header>

            <nav aria-label="Filter portfolio projects" className="mb-6 flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  aria-pressed={activeCategory === category}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                    activeCategory === category
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-[#14171e] dark:text-slate-300"
                  }`}
                >
                  {category}
                </button>
              ))}
            </nav>

            {visibleProjects.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-[#14171e] dark:text-slate-400">
                {projects.length === 0
                  ? "This designer has not added portfolio projects yet."
                  : "No portfolio projects in this category."}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProjects.map((project) => (
                  <article
                    key={project.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#14171e]"
                  >
                    {project.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={project.imageUrl} alt={project.title} className="h-56 w-full object-cover" />
                    ) : (
                      <div className="flex h-56 items-center justify-center bg-slate-100 text-sm font-semibold text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        {project.category}
                      </div>
                    )}
                    <div className="p-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
                        {project.category}
                      </p>
                      <h2 className="mt-1 text-lg font-bold">{project.title}</h2>
                      {project.description && (
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
