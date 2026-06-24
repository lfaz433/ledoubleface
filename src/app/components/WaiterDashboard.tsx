import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { 
  LogOut, Clock, Check, Play, CheckCircle2, DollarSign, 
  MessageSquare, User, Wifi, WifiOff, Bell, Loader2, AlertCircle
} from "lucide-react";
import { translations, Language } from "../../lib/translations";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  customizations?: any;
}

interface Order {
  id: string;
  table_id: string;
  area: string;
  status: string;
  order_status: "pending" | "seen" | "preparing" | "served" | "bill_requested" | "paid";
  total: number;
  note?: string;
  created_at: string;
  order_items?: OrderItem[];
}

interface WaiterDashboardProps {
  waiterId?: string;
  waiterName: string;
  assignedTables: string[];
  onLogout: () => void;
}

export function WaiterDashboard({ waiterId, waiterName, assignedTables, onLogout }: WaiterDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [lang, setLang] = useState<Language>("fr");
  const [timeNow, setTimeNow] = useState(Date.now());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMock = !supabase || supabase.isMock || !supabase.auth;
  const t = translations[lang];

  useEffect(() => {
    // Detect browser language
    if (typeof window !== "undefined") {
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === "en") setLang("en");
      // Pre-load notification sound
      audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav");
    }

    loadActiveOrders();

    // 1. Setup Live Realtime Subscription
    let subscription: any = null;
    if (!isMock) {
      subscription = supabase
        .channel("waiter_orders_channel")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            // Trigger sound on new order
            if (payload.eventType === "INSERT") {
              const newOrder = payload.new as Order;
              if (assignedTables.length === 0 || assignedTables.includes(newOrder.table_id)) {
                audioRef.current?.play().catch(() => {});
              }
            }
            loadActiveOrders();
          }
        )
        .subscribe((status) => {
          setOnline(status === "SUBSCRIBED");
        });
    } else {
      // Mock Realtime via storage event listener
      const handleStorageUpdate = (e: any) => {
        if (e.key && (e.key === "ldf_orders" || e.key === "ldf_order_items")) {
          loadActiveOrders();
        }
      };
      window.addEventListener("storage", handleStorageUpdate);
      window.addEventListener("ldf-db-update", loadActiveOrders);
      return () => {
        window.removeEventListener("storage", handleStorageUpdate);
        window.removeEventListener("ldf-db-update", loadActiveOrders);
      };
    }

    // 2. Poll every 30s as a fallback
    const pollInterval = setInterval(loadActiveOrders, 30000);

    // 3. Heartbeat update last_seen every 60s
    const heartbeatInterval = setInterval(sendHeartbeat, 60000);
    sendHeartbeat(); // initial

    // 4. Update relative elapsed times every 30s
    const clockInterval = setInterval(() => setTimeNow(Date.now()), 30000);

    return () => {
      if (subscription) supabase.removeChannel(subscription);
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
      clearInterval(clockInterval);
    };
  }, [isMock, assignedTables]);

  const sendHeartbeat = async () => {
    if (!waiterId) return;
    try {
      if (isMock) {
        const localWaiters = JSON.parse(localStorage.getItem("ldf_waiters") || "[]");
        const updated = localWaiters.map((w: any) => 
          w.id === waiterId ? { ...w, last_seen: new Date().toISOString() } : w
        );
        localStorage.setItem("ldf_waiters", JSON.stringify(updated));
      } else {
        await supabase
          .from("waiters")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", waiterId);
      }
    } catch (err) {
      console.error("Waiter heartbeat failed:", err);
    }
  };

  const loadActiveOrders = async () => {
    try {
      let data: any[] | null = null;
      let error: any = null;

      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const todayStr = todayMidnight.toISOString();

      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const localItems = JSON.parse(localStorage.getItem("ldf_order_items") || "[]");
        
        // Filter: active (not paid) and belongs to today
        let filtered = localOrders.filter((o: any) => o.order_status !== "paid" && o.created_at >= todayStr);
        
        // Filter by assigned tables if waiter is table-restricted
        if (assignedTables.length > 0) {
          filtered = filtered.filter((o: any) => assignedTables.includes(o.table_id));
        }

        // Attach items
        data = filtered.map((o: any) => ({
          ...o,
          order_items: localItems.filter((i: any) => i.order_id === o.id)
        }));
      } else {
        // Build base query
        let query = supabase
          .from("orders")
          .select("*, order_items(*)")
          .neq("order_status", "paid")
          .gte("created_at", todayStr)
          .order("created_at", { ascending: true });

        // Filter by assigned tables if applicable
        if (assignedTables.length > 0) {
          query = query.in("table_id", assignedTables);
        }

        const response = await query;
        data = response.data;
        error = response.error;
      }

      if (error) throw error;

      if (data) {
        const formattedOrders = data.map(o => ({
          ...o,
          order_status: o.order_status || "pending"
        }));
        setOrders(formattedOrders);
      }
    } catch (err) {
      console.error("Error loading waiter orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, nextStatus: Order["order_status"]) => {
    try {
      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const updated = localOrders.map((o: any) => {
          if (o.id === orderId) {
            return { 
              ...o, 
              order_status: nextStatus,
              status: nextStatus === "served" ? "delivered" : nextStatus === "preparing" ? "preparing" : o.status
            };
          }
          return o;
        });
        localStorage.setItem("ldf_orders", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: "orders" } }));
      } else {
        const traditionalStatus = nextStatus === "served" ? "delivered" : nextStatus === "preparing" ? "preparing" : undefined;
        const payload: any = { order_status: nextStatus };
        if (traditionalStatus) payload.status = traditionalStatus;

        const { error } = await supabase
          .from("orders")
          .update(payload)
          .eq("id", orderId);
        if (error) throw error;
      }
      loadActiveOrders();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const addOrderNote = async (orderId: string, noteText: string) => {
    if (!noteText) return;
    try {
      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const updated = localOrders.map((o: any) => {
          if (o.id === orderId) {
            const oldNote = o.note ? o.note + " | " : "";
            return { ...o, note: oldNote + noteText };
          }
          return o;
        });
        localStorage.setItem("ldf_orders", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: "orders" } }));
      } else {
        const { data: current } = await supabase.from("orders").select("note").eq("id", orderId).single();
        const oldNote = current?.note ? current.note + " | " : "";
        const { error } = await supabase
          .from("orders")
          .update({ note: oldNote + noteText })
          .eq("id", orderId);
        if (error) throw error;
      }
      loadActiveOrders();
    } catch (err) {
      console.error("Failed to append note:", err);
    }
  };

  const getElapsedTime = (createdAt: string) => {
    const diffMs = timeNow - new Date(createdAt).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 0) return "0m";
    return `${diffMins}m`;
  };

  const getUrgencyStyles = (createdAt: string) => {
    const diffMs = timeNow - new Date(createdAt).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins >= 30) {
      return "border-red-600/60 shadow-[0_0_15px_rgba(220,38,38,0.15)] bg-[#1A0B09]";
    }
    if (diffMins >= 15) {
      return "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)] bg-[#1A120E]";
    }
    return "border-border bg-card";
  };

  const getStatusTranslation = (status: Order["order_status"]) => {
    if (status === "pending") return lang === "fr" ? "En attente" : "Pending";
    if (status === "seen") return t.statusSeen;
    if (status === "preparing") return t.statusPreparing;
    if (status === "served") return t.statusServed;
    if (status === "bill_requested") return t.statusBillRequested;
    return status;
  };

  const statusColors: Record<string, string> = {
    pending: "#F59E0B",
    seen: "#38BDF8",
    preparing: "#C8102E",
    served: "#10B981",
    bill_requested: "#A855F7",
  };

  const statusLabels: Record<string, string> = {
    pending: "EN ATTENTE",
    seen: "VU",
    preparing: "PREPARATION",
    served: "SERVI",
    bill_requested: "ADDITION",
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 bg-card border-b border-border flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-foreground">{waiterName}</div>
            <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-muted-foreground">
              <span>{t.assignedTables}:</span>
              <span className="text-foreground font-bold">
                {assignedTables.length > 0 ? assignedTables.join(", ") : t.noAssignedTables}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Online status indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted border border-border text-[9px] font-mono uppercase">
            {online ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-[#10B981] font-bold">{t.online}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-primary animate-pulse" />
                <span className="text-primary font-bold">{t.offline}</span>
              </>
            )}
          </div>

          <button
            onClick={() => setLang(l => l === "fr" ? "en" : "fr")}
            className="px-2 py-1 bg-muted border border-border rounded text-[10px] font-mono text-muted-foreground hover:text-foreground cursor-pointer active:scale-95 transition-all"
          >
            {lang.toUpperCase()}
          </button>

          <button
            onClick={onLogout}
            className="p-2 bg-muted border border-border hover:border-red-900/30 hover:bg-red-950/20 text-muted-foreground hover:text-primary rounded-lg transition-all cursor-pointer active:scale-95"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Board content */}
      <main className="flex-1 p-6 max-w-lg mx-auto w-full">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-xs font-mono tracking-widest uppercase">Syncing Kitchen Orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground text-center px-6">
            <AlertCircle className="w-10 h-10 text-[#2A1E15] mb-3" />
            <p className="text-sm font-semibold">{t.noActiveOrders}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <AnimatePresence initial={false}>
              {orders.map((order) => (
                <WaiterOrderCard
                  key={order.id}
                  order={order}
                  timeNow={timeNow}
                  t={t}
                  lang={lang}
                  updateOrderStatus={updateOrderStatus}
                  addOrderNote={addOrderNote}
                  getUrgencyStyles={getUrgencyStyles}
                  getElapsedTime={getElapsedTime}
                  getStatusTranslation={getStatusTranslation}
                  statusColors={statusColors}
                  statusLabels={statusLabels}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}

// Swipeable Order Card Component for Waitstaff Dashboard
function WaiterOrderCard({
  order,
  timeNow,
  t,
  lang,
  updateOrderStatus,
  addOrderNote,
  getUrgencyStyles,
  getElapsedTime,
  getStatusTranslation,
  statusColors,
  statusLabels,
}: {
  order: Order;
  timeNow: number;
  t: any;
  lang: Language;
  updateOrderStatus: (id: string, nextStatus: Order["order_status"]) => void;
  addOrderNote: (id: string, note: string) => Promise<void>;
  getUrgencyStyles: (created_at: string) => string;
  getElapsedTime: (created_at: string) => string;
  getStatusTranslation: (status: string) => string;
  statusColors: Record<string, string>;
  statusLabels: Record<string, string>;
}) {
  const [dragX, setDragX] = useState(0);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const shouldReduceMotion = useReducedMotion();

  const handleSwipeEnd = (offsetX: number) => {
    // Commit if swipe threshold exceeded
    if (offsetX > 120) {
      const nextStatus = getNextStatus(order.order_status);
      if (nextStatus) {
        navigator.vibrate?.([50]);
        updateOrderStatus(order.id, nextStatus);
      }
    } else if (offsetX < -120) {
      if (order.order_status === "served") {
        navigator.vibrate?.([50]);
        updateOrderStatus(order.id, "bill_requested");
      }
    }
  };

  const getNextStatus = (currentStatus: string): Order["order_status"] | null => {
    if (currentStatus === "pending") return "seen";
    if (currentStatus === "seen") return "preparing";
    if (currentStatus === "preparing") return "served";
    return null;
  };

  const nextStatus = getNextStatus(order.order_status);
  const isAmber = Math.floor((timeNow - new Date(order.created_at).getTime()) / 60000) >= 15;
  const isRed = Math.floor((timeNow - new Date(order.created_at).getTime()) / 60000) >= 30;

  const getNextStatusLabel = () => {
    if (order.order_status === "pending") return lang === "fr" ? "VU" : "MARK SEEN";
    if (order.order_status === "seen") return lang === "fr" ? "PRÉPARATION" : "PREPARING";
    if (order.order_status === "preparing") return lang === "fr" ? "SERVI" : "SERVE ORDER";
    return "";
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-muted w-full select-none shadow-md">
      
      {/* Right Underlay (Green - Swipe Right to Advance Status) */}
      {nextStatus && (
        <div 
          className="absolute inset-0 flex items-center justify-start pl-6 bg-[#10B981]/25 rounded-xl transition-all"
          style={{ opacity: Math.min(1, Math.max(0, dragX / 120)) }}
        >
          <div className="flex items-center gap-2 text-[#10B981] font-mono text-xs font-bold uppercase tracking-widest">
            <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
            <span>→ {getNextStatusLabel()}</span>
          </div>
        </div>
      )}

      {/* Left Underlay (Amber - Swipe Left to Call for Bill) */}
      {order.order_status === "served" && (
        <div 
          className="absolute inset-0 flex items-center justify-end pr-6 bg-accent/25 rounded-xl transition-all"
          style={{ opacity: Math.min(1, Math.max(0, -dragX / 120)) }}
        >
          <div className="flex items-center gap-2 text-accent font-mono text-xs font-bold uppercase tracking-widest">
            <span>{lang === "fr" ? "ADDITION ←" : "GET BILL ←"}</span>
            <DollarSign className="w-5 h-5 text-accent" />
          </div>
        </div>
      )}

      {/* Main Order Card Body */}
      <motion.div
        drag={shouldReduceMotion ? false : "x"}
        dragConstraints={{ left: -150, right: 150 }}
        dragElastic={0.15}
        onDrag={(event, info) => setDragX(info.offset.x)}
        onDragEnd={(event, info) => {
          handleSwipeEnd(info.offset.x);
          setDragX(0);
        }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`border rounded-xl p-5 flex flex-col gap-4 relative z-10 w-full transition-colors duration-200 ${getUrgencyStyles(order.created_at)}`}
        style={{ 
          x: 0,
          borderColor: dragX > 30 && nextStatus ? "rgba(16, 185, 129, 0.4)" : dragX < -30 && order.order_status === "served" ? "rgba(212, 160, 23, 0.4)" : "" 
        }}
      >
        {/* Timer Badge */}
        <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-mono font-bold flex items-center gap-1 rounded-bl-lg ${
          isRed ? "bg-primary text-foreground" : isAmber ? "bg-accent text-black" : "bg-secondary text-muted-foreground"
        }`}>
          <Clock className="w-3.5 h-3.5" />
          <span>{getElapsedTime(order.created_at)}</span>
        </div>

        {/* Header info */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-lg text-foreground">
              Table {order.table_id}
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              {order.area}
            </span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
            ID: {order.id}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">Status:</span>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-wide uppercase" style={{ 
            backgroundColor: `${statusColors[order.order_status]}1A`, 
            color: statusColors[order.order_status],
            border: `1px solid ${statusColors[order.order_status]}33`
          }}>
            {getStatusTranslation(order.order_status)}
          </span>
        </div>

        {/* Order Items */}
        <div className="bg-muted border border-border rounded-xl p-3.5 divide-y divide-border space-y-2">
          {order.order_items?.map((item) => (
            <div key={item.id} className="pt-2 first:pt-0 flex justify-between gap-4 text-xs">
              <div className="flex-1">
                <span className="font-bold text-foreground mr-1.5">{item.quantity}x</span>
                <span className="text-foreground font-medium">{item.name}</span>
                {item.customizations && Object.keys(item.customizations).length > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                    {Object.entries(item.customizations).map(([key, val]: any) => (
                      <div key={key}>
                        • <span className="capitalize">{key}</span>: {Array.isArray(val) ? val.join(", ") : val}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="font-mono text-muted-foreground">
                €{(item.price * item.quantity).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        {order.note && (
          <div className="p-3 bg-secondary border border-border rounded-lg text-xs flex gap-2 items-start">
            <MessageSquare className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
            <div className="text-foreground">
              <span className="font-bold text-accent uppercase text-[9px] block font-mono">Kitchen Note</span>
              <p className="italic">{order.note}</p>
            </div>
          </div>
        )}

        {/* Note inputs */}
        {isEditingNote ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t.addNotePlaceholder}
              className="flex-1 px-3 py-2 bg-muted border border-border text-xs text-foreground rounded-lg outline-none focus:border-primary"
            />
            <button
              onClick={async () => {
                await addOrderNote(order.id, noteText);
                setIsEditingNote(false);
              }}
              className="px-3 bg-[#10B981] hover:bg-[#10B981]/90 text-foreground font-bold rounded-lg text-xs cursor-pointer active:scale-95 transition-all"
            >
              Add
            </button>
            <button
              onClick={() => setIsEditingNote(false)}
              className="px-3 bg-secondary/80 text-foreground font-bold rounded-lg text-xs cursor-pointer active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setNoteText(order.note || "");
              setIsEditingNote(true);
            }}
            className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer w-fit"
          >
            + {t.addNoteBtn}
          </button>
        )}

        {/* Swipe instructions (subtle reminder) */}
        <div className="text-center text-[9px] font-mono text-muted-foreground/30 uppercase tracking-widest border-t border-border/30 pt-2.5 mt-1 select-none">
          {order.order_status === "served" 
            ? "← Glisser pour l'addition"
            : nextStatus 
              ? "Glisser à droite pour avancer →" 
              : "Commande finalisée"}
        </div>
      </motion.div>
    </div>
  );
}
