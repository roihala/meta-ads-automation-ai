"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  Inbox,
  Images,
  Users,
  Target,
  ListChecks,
  Briefcase,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { SearchHit, SearchResponse } from "@/app/api/search/route";

type Scope = "all" | "current";

const KIND_META: Record<
  SearchHit["kind"],
  { label: string; Icon: typeof Inbox }
> = {
  approval: { label: "הצעות", Icon: Inbox },
  campaign: { label: "קמפיינים", Icon: Target },
  creative: { label: "קריאייטיב", Icon: Images },
  audience: { label: "קהלים", Icon: Users },
  lead: { label: "לידים", Icon: ListChecks },
  service: { label: "שירותים", Icon: Briefcase },
};

/**
 * Maps a route prefix to the search scope it represents. The "current tab"
 * toggle uses this to narrow the API call when the operator wants to scope
 * the query to whatever they're already looking at.
 */
function currentTabScope(pathname: string): SearchHit["kind"] | null {
  if (pathname.startsWith("/approvals")) return "approval";
  if (pathname.startsWith("/campaigns")) return "campaign";
  if (pathname.startsWith("/gallery")) return "creative";
  if (pathname.startsWith("/audiences")) return "audience";
  if (pathname.startsWith("/leads")) return "lead";
  if (pathname.startsWith("/business-knowledge")) return "service";
  return null;
}

/**
 * Inline global search — lives inside the right pill of the Nav. Collapsed
 * state is an icon button; click (or Ctrl/⌘+K) expands the icon into a real
 * input. Results appear in a floating panel anchored under the input, not in
 * a modal dialog. Outside-click + Escape + Enter-on-no-result all collapse it
 * back to the icon.
 *
 * Replaced the previous Dialog-based UX on 2026-05-18 — operator feedback was
 * that a modal felt too heavyweight for what is essentially an autocomplete.
 */
export function GlobalSearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [pathname, setPathname] = useState("/");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track pathname so the "current tab" scope toggle has something to map.
  // Reading window.location avoids a re-render loop with usePathname when the
  // dialog is the only consumer of route state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPathname(window.location.pathname);
  }, [open]);

  // Keyboard shortcut — ⌘/Ctrl-K opens; '/' opens when no form field is focused.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const target = e.target as HTMLElement | null;
      const isFormField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!isFormField && e.key === "/") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-focus the input when it expands, reset state on collapse.
  useEffect(() => {
    if (open) {
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQ("");
      setHits([]);
    }
  }, [open]);

  // Outside-click closes — only when expanded, so we don't waste a listener
  // in the collapsed state.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const root = containerRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Debounced fetch — 180ms — so the API isn't hit on every keystroke.
  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const tabKind = currentTabScope(pathname);
        const tabParam =
          scope === "current" && tabKind ? `&scope=${tabKindToParam(tabKind)}` : "";
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}${tabParam}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setHits([]);
          return;
        }
        const data = (await res.json()) as SearchResponse;
        setHits(data.hits);
        setActive(0);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") setHits([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [q, scope, open, pathname]);

  // Group hits by kind for rendering, while keeping a flat running index so
  // arrow keys + Enter target the right hit regardless of group boundaries.
  const grouped = useMemo(() => {
    const map = new Map<SearchHit["kind"], SearchHit[]>();
    for (const h of hits) {
      const arr = map.get(h.kind) ?? [];
      arr.push(h);
      map.set(h.kind, arr);
    }
    return Array.from(map.entries());
  }, [hits]);

  const navigateTo = useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      router.push(hit.href);
    },
    [router],
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = hits[active];
      if (target) navigateTo(target);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Flat counter shared across groups so the keyboard cursor lands correctly.
  let runningIndex = -1;
  const showPanel = open && q.trim().length > 0;

  return (
    <div ref={containerRef} className="relative">
      {open ? (
        // Expanded — inline input replaces the icon. The input is the same
        // height (h-9) as the icon button it replaced so the Nav pill row
        // doesn't reflow.
        <div className="flex items-center gap-1 rounded-full bg-foreground/[0.04] px-2 ring-1 ring-border/60">
          <Search size={14} className="shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKeyDown}
            dir="auto"
            placeholder="חיפוש: קמפיין, ליד, קריאייטיב, קהל…"
            className="h-9 w-44 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground/70 sm:w-60"
          />
          {loading ? (
            <Loader2
              size={13}
              className="shrink-0 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : null}
          <button
            type="button"
            aria-label="סגור חיפוש"
            onClick={() => setOpen(false)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label="חיפוש גלובלי (Ctrl/⌘+K)"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search size={16} />
        </button>
      )}

      {/* Floating results panel — anchored under the expanded input. We mount
          it only when there's a query, so the empty-state-on-focus isn't a
          full panel of nothing. RTL: align to end so the panel hugs the input
          on the left edge (since the Nav action pill sits on the page's left
          in RTL). */}
      {showPanel ? (
        <div
          role="listbox"
          aria-label="תוצאות חיפוש"
          className="absolute end-0 top-[calc(100%+8px)] z-50 w-[min(420px,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border/70 bg-popover shadow-elev-3"
        >
          {/* Scope strip — same controls as before, just slimmer for inline. */}
          <div className="flex items-center gap-1 border-b border-border/40 px-2 py-1.5">
            <ScopePill
              active={scope === "all"}
              onClick={() => setScope("all")}
              label="כל הטאבים"
            />
            <ScopePill
              active={scope === "current"}
              onClick={() => setScope("current")}
              label="טאב נוכחי"
            />
            <span className="ms-auto text-[10.5px] text-muted-foreground/70">
              <kbd className="font-tabular rounded border border-border bg-muted/40 px-1 py-[1px] text-[10px]">
                ↑↓
              </kbd>{" "}
              ·{" "}
              <kbd className="font-tabular rounded border border-border bg-muted/40 px-1 py-[1px] text-[10px]">
                ↵
              </kbd>
            </span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {hits.length === 0 && !loading ? (
              <EmptyState query={q.trim()} />
            ) : (
              grouped.map(([kind, items]) => {
                const meta = KIND_META[kind];
                return (
                  <div key={kind} className="px-1.5 py-1">
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <meta.Icon size={11} aria-hidden />
                      <span>{meta.label}</span>
                      <span className="opacity-70">({items.length})</span>
                    </div>
                    <ul className="flex flex-col">
                      {items.map((h) => {
                        runningIndex += 1;
                        const isActive = runningIndex === active;
                        const myIndex = runningIndex;
                        return (
                          <li key={`${h.kind}:${h.id}`}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onMouseEnter={() => setActive(myIndex)}
                              onClick={() => navigateTo(h)}
                              className={cn(
                                "flex w-full items-start gap-3 rounded-md px-2 py-2 text-start transition-colors",
                                isActive
                                  ? "bg-brand-500/10 text-foreground"
                                  : "text-foreground/85 hover:bg-foreground/[0.04]",
                              )}
                            >
                              <span className="mt-[3px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground">
                                <meta.Icon size={13} aria-hidden />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium">
                                  {h.title}
                                </span>
                                {h.subtitle ? (
                                  <span className="block truncate text-[11.5px] text-muted-foreground">
                                    {h.subtitle}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScopePill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-brand-500/15 text-foreground"
          : "text-muted-foreground hover:bg-foreground/5",
      )}
    >
      {label}
    </button>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-[13px] font-medium text-foreground">אין התאמות</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        לא מצאנו תוצאות עבור &ldquo;{query}&rdquo;.
      </p>
    </div>
  );
}

// Tab kind → API scope param. The API uses plural names, the dialog keeps
// singular `SearchHit["kind"]`. One translation table in one place keeps the
// two in lock-step.
function tabKindToParam(kind: SearchHit["kind"]): string {
  switch (kind) {
    case "approval":
      return "approvals";
    case "campaign":
      return "campaigns";
    case "creative":
      return "gallery";
    case "audience":
      return "audiences";
    case "lead":
      return "leads";
    case "service":
      return "services";
  }
}
