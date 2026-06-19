/**
 * LiveOrdersQueue.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained 3-column kanban for the Admin "Orders" section.
 *
 * COLUMN MAPPING:
 *   Col 1 — PREPARING : order_status IN ('pending','seen','preparing')
 *   Col 2 — READY     : order_status IN ('served','bill_requested')
 *   Col 3 — PAID      : paid === true AND order_status === 'paid'
 *
 * ASSUMPTIONS:
 *  • The parent (AdminDashboard) passes a flat `orders` array already merged
 *    from Supabase + localStorage mock. Each order has at minimum:
 *      id, table_id, area, status, order_status?, total, paid?, items[], note?,
 *      created_at (ISO string), time (HH:MM string pre-formatted)
 *  • Supabase columns written: `order_status` + `paid`
 *  • `oe` alias = supabase client imported from "../../lib/supabase"
 *  • downloadInvoicePNG(order) is passed as a prop from AdminDashboard
 *  • No new npm packages used
 *
 * MOBILE:
 *  • Columns stack vertically; each is an accordion.
 *  • Default: Col 1 (PREPARING) expanded, others collapsed.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Receipt, Lock, ChevronDown } from "lucide-react";
import { supabase as oe } from "../../lib/supabase";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  customizations: Record<string, string | string[]>;
}

export interface LiveOrder {
  id: string;
  table_id: string;
  area: string;
  /** Legacy pipeline field (pending/preparing/ready/delivered) */
  status: string;
  /** Waiter-granular status field */
  order_status?: string;
  total: number;
  note?: string;
  paid?: boolean;
  items: OrderItem[];
  /** Pre-formatted HH:MM string from parent */
  time: string;
  /** ISO 8601 timestamp for elapsed timer */
  created_at: string;
}

interface LiveOrdersQueueProps {
  orders: LiveOrder[];
  setOrders: React.Dispatch<React.SetStateAction<LiveOrder[]>>;
  language?: "fr" | "en";
  downloadInvoicePNG: (order: LiveOrder) => void;
}

// ─── i18n ────────────────────────────────────────────────────────────────────

const LABELS = {
  fr: {
    col1Title: "PRÉPARATION",
    col2Title: "PRÊT",
    col3Title: "PAYÉ",
    col1Btn: "🍳  PRÉPARATION → PRÊT",
    col2Btn: "✅  PRÊT → PAYÉ",
    total: "TOTAL",
    unpaid: "IMPAYÉ",
    paid: "PAYÉ",
    billRequested: "🧾 ADDITION DEMANDÉE",
    toastReceipt: "💳 Reçu téléchargé ✓",
    toastError: "Erreur — réessayez",
    colSum: (n: number, sum: string) => `${n} commande${n !== 1 ? "s" : ""} · ${sum}`,
    emptyPreparing: "Aucune commande en préparation",
    emptyReady: "Aucune commande prête",
    emptyPaid: "Aucune commande réglée",
  },
  en: {
    col1Title: "PREPARING",
    col2Title: "READY",
    col3Title: "PAID",
    col1Btn: "🍳  PREPARING → READY",
    col2Btn: "✅  READY → PAID",
    total: "TOTAL",
    unpaid: "UNPAID",
    paid: "PAID",
    billRequested: "🧾 BILL REQUESTED",
    toastReceipt: "💳 Receipt downloaded ✓",
    toastError: "Error — please retry",
    colSum: (n: number, sum: string) => `${n} order${n !== 1 ? "s" : ""} · ${sum}`,
    emptyPreparing: "No orders in preparation",
    emptyReady: "No orders ready",
    emptyPaid: "No paid orders",
  },
} as const;

// ─── Elapsed Timer Hook ───────────────────────────────────────────────────────

function useElapsedMin(createdAt: string): number {
  const [min, setMin] = useState(0);
  useEffect(() => {
    const tick = () =>
      setMin(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [createdAt]);
  return min;
}

// ─── Timer Badge ─────────────────────────────────────────────────────────────

function TimerBadge({ createdAt }: { createdAt: string }) {
  const min = useElapsedMin(createdAt);

  const pad = (n: number) => String(n).padStart(2, "0");
  const displayH = Math.floor(min / 60);
  const displayM = min % 60;
  const label = displayH > 0 ? `${displayH}h${pad(displayM)}` : `${min}m`;

  const color =
    min >= 20
      ? "text-[#C8102E] animate-pulse"
      : min >= 10
      ? "text-[#F59E0B]"
      : "text-[#10B981]";

  return (
    <span className={`text-[10px] font-mono tabular-nums ${color}`}>{label}</span>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: LiveOrder;
  column: 1 | 2 | 3;
  lang: "fr" | "en";
  onAdvance: (orderId: string, isPaidAction: boolean) => void;
  onReDownload: (order: LiveOrder) => void;
  reduced: boolean;
}

function OrderCard({ order, column, lang, onAdvance, onReDownload, reduced }: OrderCardProps) {
  const t = LABELS[lang];
  const isPaidCol = column === 3;
  const createdAt = order.created_at || new Date().toISOString();

  // Dim paid cards older than 10 min
  const elapsedMin = useElapsedMin(createdAt);
  const dimmed = isPaidCol && elapsedMin >= 10;

  const isBillRequested = order.order_status === "bill_requested";
  const isPaid = order.paid === true;

  const cardVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: dimmed ? 0.4 : 1, y: 0 },
    exit: { opacity: 0, scale: 0.92 },
  };

  // Shorten ID for display: take last 6 chars prefixed with ORD-
  const shortId = `ORD-${order.id.slice(-6).toUpperCase()}`;

  return (
    <motion.div
      layout={!reduced}
      layoutId={reduced ? undefined : order.id}
      variants={reduced ? undefined : cardVariants}
      initial={reduced ? undefined : "initial"}
      animate={reduced ? undefined : "animate"}
      exit={reduced ? undefined : "exit"}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="bg-[#120D09] border border-[#2A1E15] rounded-xl p-4 space-y-3 hover:border-[#2A1E15]/80 transition-colors"
    >
      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono font-bold text-sm text-[#D4A017] tracking-wider truncate">
            {shortId}
          </span>
          <span className="text-[#8E7E70] text-[10px] font-mono uppercase tracking-wide">
            TABLE {order.table_id}
            {order.area ? ` · ${order.area.toUpperCase()}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <TimerBadge createdAt={createdAt} />
        </div>
      </div>

      {/* ── Bill-requested pill ── */}
      {isBillRequested && (
        <div className="inline-flex items-center gap-1">
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#D4A017]/10 text-[#D4A017] border border-[#D4A017]/30">
            {t.billRequested}
          </span>
        </div>
      )}

      {/* ── Items list ── */}
      <div className="space-y-1.5">
        {order.items.map((item, idx) => (
          <div key={`${item.product_id}-${idx}`} className="space-y-0.5">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-xs text-[#E5D5C5]">
                <span className="font-bold">{item.quantity}×</span>{" "}
                {item.name}
              </span>
              <span className="text-[10px] font-mono text-[#8E7E70] flex-shrink-0">
                €{(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
            {/* Customizations */}
            {item.customizations &&
              Object.entries(item.customizations).map(([k, v]) => {
                const val = Array.isArray(v) ? v.join(", ") : v;
                if (!val) return null;
                return (
                  <div
                    key={k}
                    className="text-[10px] text-[#8E7E70] ml-3 leading-relaxed"
                  >
                    ↳ {val}
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      {/* ── Note ── */}
      {order.note && (
        <div className="p-2 bg-[#1A130E] border border-dashed border-[#2A1E15] text-[10px] text-[#F59E0B] rounded font-mono">
          📝 {order.note}
        </div>
      )}

      {/* ── Divider + footer ── */}
      <div className="pt-2 border-t border-[#2A1E15]/50 flex items-center justify-between gap-2">
        <span className="font-bold text-xs text-[#E5D5C5]">
          {t.total}:{" "}
          <span className="font-mono">€{order.total.toFixed(2)}</span>
        </span>

        {isPaid ? (
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30">
            {t.paid} ✓
          </span>
        ) : (
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#C8102E]/10 text-[#C8102E] border border-[#C8102E]/30">
            {t.unpaid} 🔴
          </span>
        )}
      </div>

      {/* ── Action button ── */}
      {column === 1 && (
        <button
          onClick={() => onAdvance(order.id, false)}
          className="w-full h-10 rounded-xl font-mono font-bold text-sm bg-[#C8102E] text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all"
        >
          {t.col1Btn}
        </button>
      )}

      {column === 2 && (
        <button
          onClick={() => onAdvance(order.id, true)}
          className="w-full h-10 rounded-xl font-mono font-bold text-sm bg-[#10B981] text-[#0A0704] cursor-pointer hover:opacity-90 active:scale-95 transition-all"
        >
          {t.col2Btn}
        </button>
      )}

      {column === 3 && (
        <button
          onClick={() => onReDownload(order)}
          title="Re-download receipt"
          className="flex items-center justify-center gap-2 w-full h-10 rounded-xl font-mono text-xs text-[#8E7E70] border border-[#2A1E15] bg-transparent cursor-pointer hover:border-[#D4A017]/40 hover:text-[#D4A017] active:scale-95 transition-all"
        >
          <Receipt className="w-3.5 h-3.5" />
          <Lock className="w-3 h-3" />
          <span>🧾</span>
        </button>
      )}
    </motion.div>
  );
}

// ─── Column Header ────────────────────────────────────────────────────────────

interface ColumnHeaderProps {
  title: string;
  count: number;
  sumStr: string;
  accentClass: string;
  expanded: boolean;
  isMobile: boolean;
  onToggle: () => void;
}

function ColumnHeader({
  title,
  count,
  sumStr,
  accentClass,
  expanded,
  isMobile,
  onToggle,
}: ColumnHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between pb-3 mb-3 border-b border-[#2A1E15] pl-3 ${accentClass} ${
        isMobile ? "cursor-pointer select-none" : ""
      }`}
      onClick={isMobile ? onToggle : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="font-serif font-bold text-[#E5D5C5] text-sm">{title}</span>
        <span className="bg-[#2A1E15] text-[#8E7E70] font-mono text-[10px] rounded-full px-2 py-0.5">
          {count}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#D4A017] font-mono text-[10px]">{sumStr}</span>
        {isMobile && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-[#8E7E70]" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LiveOrdersQueue({
  orders,
  setOrders,
  language = "fr",
  downloadInvoicePNG,
}: LiveOrdersQueueProps) {
  const t = LABELS[language];
  const reduced = useReducedMotion() ?? false;

  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [expandedCols, setExpandedCols] = useState<Set<number>>(new Set([1]));

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const toggleCol = (col: number) => {
    setExpandedCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  // ── Partition orders into 3 columns ──────────────────────────────────────
  //
  // We look at `order_status` first (waiter-granular), then fall back to
  // the legacy `status` field so both mock and real DB work correctly.
  //
  // Exclude DELIVERY and COMPTOIR orders (those have their own pipeline).

  const dineInOrders = orders.filter(
    (o) =>
      o.table_id?.toUpperCase() !== "DELIVERY" &&
      o.table_id?.toUpperCase() !== "COMPTOIR"
  );

  const resolveStatus = (o: LiveOrder) => o.order_status || o.status || "pending";

  const col1 = dineInOrders.filter((o) => {
    const s = resolveStatus(o);
    return ["pending", "seen", "preparing"].includes(s) && !o.paid;
  });

  const col2 = dineInOrders.filter((o) => {
    const s = resolveStatus(o);
    return ["served", "bill_requested"].includes(s) && !o.paid;
  });

  const col3 = dineInOrders.filter((o) => o.paid === true && resolveStatus(o) === "paid");

  // ── Optimistic advanceOrder ────────────────────────────────────────────────

  const advanceOrder = useCallback(
    async (orderId: string, isPaidAction: boolean) => {
      const nextOrderStatus = isPaidAction ? "paid" : "served";
      const nextStatus = isPaidAction ? "delivered" : "ready"; // legacy status col
      const prevOrder = orders.find((o) => o.id === orderId);
      if (!prevOrder) return;

      // 1. Immediate optimistic UI update
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                order_status: nextOrderStatus,
                status: nextStatus,
                ...(isPaidAction ? { paid: true } : {}),
              }
            : o
        )
      );

      // 2. If PAID → download receipt immediately
      if (isPaidAction) {
        downloadInvoicePNG({ ...prevOrder, paid: true });
        toast.success(t.toastReceipt, { duration: 2000 });
      }

      // 3. Background DB update
      const update: Record<string, unknown> = {
        order_status: nextOrderStatus,
        status: nextStatus,
      };
      if (isPaidAction) update.paid = true;

      const { error } = await oe.from("orders").update(update).eq("id", orderId);

      // 4. Revert on error
      if (error) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  order_status: prevOrder.order_status,
                  status: prevOrder.status,
                  paid: prevOrder.paid,
                }
              : o
          )
        );
        toast.error(t.toastError);
      }
    },
    [orders, setOrders, downloadInvoicePNG, t]
  );

  // ── Re-download receipt for paid cards ────────────────────────────────────

  const handleReDownload = useCallback(
    (order: LiveOrder) => {
      downloadInvoicePNG(order);
      toast.success(t.toastReceipt, { duration: 1500 });
    },
    [downloadInvoicePNG, t]
  );

  // ── Column config ─────────────────────────────────────────────────────────

  const totalFor = (list: LiveOrder[]) =>
    `€${list.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}`;

  const columns: {
    id: 1 | 2 | 3;
    title: string;
    list: LiveOrder[];
    accentBorder: string;
    emptyMsg: string;
  }[] = [
    {
      id: 1,
      title: t.col1Title,
      list: col1,
      accentBorder: "border-l-2 border-l-[#C8102E]",
      emptyMsg: t.emptyPreparing,
    },
    {
      id: 2,
      title: t.col2Title,
      list: col2,
      accentBorder: "border-l-2 border-l-[#10B981]",
      emptyMsg: t.emptyReady,
    },
    {
      id: 3,
      title: t.col3Title,
      list: col3,
      accentBorder: "border-l-2 border-l-[#8E7E70]",
      emptyMsg: t.emptyPaid,
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <LayoutGroup>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const isExpanded = !isMobile || expandedCols.has(col.id);

          return (
            <div
              key={col.id}
              className="flex flex-col min-h-[120px] bg-[#120D09]/40 border border-[#2A1E15]/60 rounded-xl p-4"
            >
              {/* Column Header */}
              <ColumnHeader
                title={col.title}
                count={col.list.length}
                sumStr={totalFor(col.list)}
                accentClass={col.accentBorder}
                expanded={isExpanded}
                isMobile={isMobile}
                onToggle={() => toggleCol(col.id)}
              />

              {/* Column Body — collapsible on mobile */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="body"
                    initial={isMobile ? { height: 0, opacity: 0 } : false}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={isMobile ? { height: 0, opacity: 0 } : undefined}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-3 mt-1">
                      <AnimatePresence mode="popLayout">
                        {col.list.length === 0 ? (
                          <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="py-8 text-center text-[#8E7E70] text-xs font-mono"
                          >
                            {col.emptyMsg}
                          </motion.div>
                        ) : (
                          col.list.map((order) => (
                            <OrderCard
                              key={order.id}
                              order={order}
                              column={col.id}
                              lang={language}
                              onAdvance={advanceOrder}
                              onReDownload={handleReDownload}
                              reduced={reduced}
                            />
                          ))
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
