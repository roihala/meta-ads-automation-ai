"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Inbox, AlertTriangle, ListChecks, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type {
  NotificationItem,
  NotificationKind,
  NotificationsResponse,
} from "@/app/api/notifications/route";

/**
 * Nav bell — polls /api/notifications and renders a popover with the unified
 * feed (pending approvals + flow errors + ungraded leads). The dot is shown
 * only when `unread_count > 0`; an inline counter badge appears when >9 items.
 *
 * The polling cadence (30s) is the cheapest "feels live" without WebSockets.
 * When the popover is open the cadence drops to 8s so a freshly-graded lead
 * disappears almost immediately. Replaces the previous static placeholder.
 */
export function NotificationsPopover() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) {
          if (alive) setLoading(false);
          return;
        }
        const json = (await res.json()) as NotificationsResponse;
        if (alive) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (alive) setLoading(false);
      }
    }

    refresh();
    const interval = open ? 8000 : 30000;
    const t = setInterval(refresh, interval);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [open]);

  const unread = data?.unread_count ?? 0;
  const items = data?.items ?? [];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            unread > 0 ? `התראות — ${unread} פתוחות` : "התראות"
          }
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell size={16} />
          {unread > 0 ? (
            unread > 9 ? (
              <span
                aria-hidden
                className="font-tabular absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background"
              >
                9+
              </span>
            ) : (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-500 ring-2 ring-background"
              />
            )
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[360px] max-w-[calc(100vw-2rem)] p-0"
      >
        <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold">התראות</span>
            {unread > 0 ? (
              <span className="font-tabular text-[11px] text-muted-foreground">
                {unread} פתוחות
              </span>
            ) : null}
          </div>
          {loading ? (
            <Loader2 size={13} className="animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </header>

        {data?.summary ? <SummaryStrip summary={data.summary} /> : null}

        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 && !loading ? (
            <EmptyState />
          ) : (
            <ul className="flex flex-col">
              {items.map((it, i) => (
                <NotificationRow
                  key={it.id}
                  item={it}
                  divider={i > 0}
                  onClick={() => setOpen(false)}
                />
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-border/60 px-3 py-2">
          <Link
            href="/approvals"
            onClick={() => setOpen(false)}
            className="text-[12px] font-medium text-primary hover:underline"
          >
            פתח את כל ההצעות ←
          </Link>
        </footer>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SummaryStrip({
  summary,
}: {
  summary: NotificationsResponse["summary"];
}) {
  const cells = [
    {
      label: "הצעות",
      value: summary.pending_total,
      tone: summary.pending_urgent > 0 ? ("urgent" as const) : ("neutral" as const),
      sub: summary.pending_urgent > 0 ? `${summary.pending_urgent} דחופות` : null,
    },
    {
      label: "שגיאות 24ש'",
      value: summary.flow_errors_24h,
      tone: summary.flow_errors_24h > 0 ? ("warning" as const) : ("neutral" as const),
      sub: null,
    },
    {
      label: "לידים לדירוג",
      value: summary.ungraded_leads,
      tone:
        summary.ungraded_leads > 0 ? ("info" as const) : ("neutral" as const),
      sub: null,
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-px border-b border-border/60 bg-border/40">
      {cells.map((c) => (
        <div
          key={c.label}
          className={cn(
            "flex flex-col items-start gap-0.5 bg-background px-3 py-2",
          )}
        >
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {c.label}
          </span>
          <span
            className={cn(
              "font-tabular text-[18px] font-bold leading-none",
              c.tone === "urgent" && "text-destructive",
              c.tone === "warning" && "text-amber-600 dark:text-amber-400",
              c.tone === "info" && "text-sky-600 dark:text-sky-400",
              c.tone === "neutral" && "text-foreground/60",
            )}
          >
            {c.value}
          </span>
          {c.sub ? (
            <span className="text-[10px] text-muted-foreground">{c.sub}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const KIND_STYLE: Record<
  NotificationKind,
  { Icon: typeof Inbox; tone: string; label: string }
> = {
  approval_urgent: {
    Icon: AlertTriangle,
    tone: "text-destructive",
    label: "דחוף",
  },
  approval_pending: { Icon: Inbox, tone: "text-brand-500", label: "ממתין" },
  flow_error: {
    Icon: AlertTriangle,
    tone: "text-amber-600 dark:text-amber-400",
    label: "שגיאת ריצה",
  },
  lead_ungraded: {
    Icon: ListChecks,
    tone: "text-sky-600 dark:text-sky-400",
    label: "לידים",
  },
};

function NotificationRow({
  item,
  divider,
  onClick,
}: {
  item: NotificationItem;
  divider: boolean;
  onClick: () => void;
}) {
  const meta = KIND_STYLE[item.kind];
  return (
    <li className={divider ? "border-t border-border/60" : ""}>
      <Link
        href={item.href}
        onClick={onClick}
        className="flex items-start gap-3 px-3 py-3 transition-colors hover:bg-foreground/[0.04]"
      >
        <span
          className={cn(
            "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.04]",
            meta.tone,
          )}
        >
          <meta.Icon size={14} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-medium">
              {item.title}
            </span>
            <span className="font-tabular shrink-0 text-[11px] text-muted-foreground">
              {relativeHe(item.at)}
            </span>
          </div>
          {item.subtitle ? (
            <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
              {item.subtitle}
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-[13px] font-medium text-foreground">הכול שקט</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        אין התראות חדשות כרגע. נעדכן אותך ברגע שמשהו יקרה.
      </p>
    </div>
  );
}

function relativeHe(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} ש'`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `לפני ${days} ימים`;
  const weeks = Math.floor(days / 7);
  return `לפני ${weeks} שבועות`;
}
