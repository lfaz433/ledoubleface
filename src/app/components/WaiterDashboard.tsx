import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { 
  LogOut, Clock, Check, Play, CheckCircle2, DollarSign, 
  MessageSquare, User, Wifi, WifiOff, Bell, Loader2, AlertCircle
} from "lucide-react";
import { translations, Language } from "../../lib/translations";

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
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [activeNotes, setActiveNotes] = useState<Record<string, boolean>>({});
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
              if (assignedTables.includes(newOrder.table_id)) {
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

    // 3. Heartbeat: update last_seen timestamp every 60s
    const heartbeatInterval = setInterval(sendHeartbeat, 60000);

    // 4. Tick time elapsed every 10s
    const clockInterval = setInterval(() => setTimeNow(Date.now()), 10000);

    return () => {
      if (subscription) supabase.removeChannel(subscription);
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
      clearInterval(clockInterval);
    };
  }, [assignedTables, isMock]);

  const sendHeartbeat = async () => {
    if (isMock || !waiterId) return;
    try {
      await supabase
        .from("waiters")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", waiterId);
    } catch (_) {}
  };

  const loadActiveOrders = async () => {
    try {
      if (assignedTables.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      let data: any[] | null = null;
      let error: any = null;

      if (isMock) {
        // Fetch from mock local storage
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const localItems = JSON.parse(localStorage.getItem("ldf_order_items") || "[]");
        
        // Filter to assigned tables and non-paid orders
        data = localOrders
          .filter((o: any) => assignedTables.includes(o.table_id) && o.order_status !== "paid")
          .map((o: any) => ({
            ...o,
            order_items: localItems.filter((i: any) => i.order_id === o.id)
          }));
      } else {
        const response = await supabase
          .from("orders")
          .select(`
            *,
            order_items (
              *
            )
          `)
          .in("table_id", assignedTables)
          .neq("order_status", "paid")
          .order("created_at", { ascending: false });
        
        data = response.data;
        error = response.error;
      }

      if (error) throw error;

      if (data) {
        // Double check status column fallback to order_status if order_status is null
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
              // Also map to traditional status column for kitchen dashboard compatibility
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

  const addOrderNote = async (orderId: string) => {
    const noteText = noteInputs[orderId];
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
        // Fetch current note first
        const { data: current } = await supabase.from("orders").select("note").eq("id", orderId).single();
        const oldNote = current?.note ? current.note + " | " : "";
        const { error } = await supabase
          .from("orders")
          .update({ note: oldNote + noteText })
          .eq("id", orderId);
        if (error) throw error;
      }

      setNoteInputs(prev => ({ ...prev, [orderId]: "" }));
      setActiveNotes(prev => ({ ...prev, [orderId]: false }));
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
      return "border-red-600/60 shadow-[0_0_15px_rgba(220,38,38,0.15)] bg-red-950/10";
    }
    if (diffMins >= 15) {
      return "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)] bg-amber-950/5";
    }
    return "border-[#2A1E15] bg-[#120D09]";
  };

  const getStatusTranslation = (status: Order["order_status"]) => {
    if (status === "pending") return lang === "fr" ? "En attente" : "Pending";
    if (status === "seen") return t.statusSeen;
    if (status === "preparing") return t.statusPreparing;
    if (status === "served") return t.statusServed;
    if (status === "bill_requested") return t.statusBillRequested;
    return status;
  };

  return (
    <div className="min-h-screen bg-[#0A0704] text-white flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 bg-[#120D09] border-b border-[#2A1E15] flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#C8102E]/10 border border-[#C8102E]/30 flex items-center justify-center">
            <User className="w-4 h-4 text-[#C8102E]" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight">{waiterName}</div>
            <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-[#8E7E70]">
              <span>{t.assignedTables}:</span>
              <span className="text-white font-bold">
                {assignedTables.length > 0 ? assignedTables.join(", ") : t.noAssignedTables}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Online status indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1A130E] border border-[#2A1E15] text-[9px] font-mono uppercase">
            {online ? (
              <>
                <Wifi className="w-3 h-3 text-[#10B981]" />
                <span className="text-[#10B981] hidden sm:inline">{t.online}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-[#EF4444]" />
                <span className="text-[#EF4444] hidden sm:inline">{t.offline}</span>
              </>
            )}
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#C8102E]/15 border border-[#C8102E]/30 hover:bg-[#C8102E]/25 text-white text-xs rounded-lg transition-all cursor-pointer font-semibold uppercase tracking-wider"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full pb-16">
        <div className="flex items-center justify-between mb-4 border-b border-[#2A1E15] pb-2">
          <h2 className="text-xs font-mono tracking-widest text-[#8E7E70] uppercase">
            {t.activeOrdersQueue} ({orders.length})
          </h2>
          <button 
            onClick={loadActiveOrders}
            className="text-[10px] font-mono text-[#D4A017] hover:underline cursor-pointer"
          >
            REFRESH
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#8E7E70]">
            <Loader2 className="w-8 h-8 animate-spin text-[#C8102E] mb-3" />
            <p className="text-xs font-mono tracking-widest uppercase">Syncing Kitchen Orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#8E7E70] text-center px-6">
            <AlertCircle className="w-10 h-10 text-[#2A1E15] mb-3" />
            <p className="text-sm font-semibold">{t.noActiveOrders}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isAmber = Math.floor((timeNow - new Date(order.created_at).getTime()) / 60000) >= 15;
              const isRed = Math.floor((timeNow - new Date(order.created_at).getTime()) / 60000) >= 30;

              return (
                <div 
                  key={order.id} 
                  className={`border rounded-xl p-5 transition-all duration-300 flex flex-col gap-4 relative overflow-hidden ${getUrgencyStyles(order.created_at)}`}
                >
                  {/* Timer Badge */}
                  <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-mono font-bold flex items-center gap-1 rounded-bl-lg ${
                    isRed ? "bg-red-600 text-white" : isAmber ? "bg-amber-500 text-black" : "bg-white/5 text-[#8E7E70]"
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{getElapsedTime(order.created_at)}</span>
                  </div>

                  {/* Header info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-bold text-lg text-white">
                        Table {order.table_id}
                      </h3>
                      <span className="text-[10px] font-mono text-[#8E7E70] uppercase">
                        {order.area}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-[#8E7E70] mt-0.5">
                      ID: {order.id}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#8E7E70] font-mono text-[10px] tracking-wider uppercase">Status:</span>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-wide uppercase ${
                      order.order_status === "pending" ? "bg-amber-500/10 text-amber-500 border border-amber-500/30" :
                      order.order_status === "seen" ? "bg-sky-500/10 text-sky-400 border border-sky-500/30" :
                      order.order_status === "preparing" ? "bg-[#C8102E]/10 text-[#C8102E] border border-[#C8102E]/30" :
                      order.order_status === "served" ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30" :
                      "bg-purple-500/10 text-purple-400 border border-purple-500/30" // bill_requested
                    }`}>
                      {getStatusTranslation(order.order_status)}
                    </span>
                  </div>

                  {/* Order Items */}
                  <div className="bg-[#1A130E] border border-[#2A1E15] rounded-xl p-3.5 divide-y divide-[#2A1E15] space-y-2">
                    {order.order_items?.map((item) => (
                      <div key={item.id} className="pt-2 first:pt-0 flex justify-between gap-4 text-xs">
                        <div className="flex-1">
                          <span className="font-bold text-[#E5D5C5] mr-1.5">{item.quantity}x</span>
                          <span className="text-white font-medium">{item.name}</span>
                          {item.customizations && Object.keys(item.customizations).length > 0 && (
                            <div className="text-[10px] text-[#8E7E70] mt-0.5 leading-relaxed">
                              {Object.entries(item.customizations).map(([key, val]: any) => (
                                <div key={key}>
                                  • <span className="capitalize">{key}</span>: {Array.isArray(val) ? val.join(", ") : val}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="font-mono text-[#8E7E70]">
                          €{(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Note */}
                  {order.note && (
                    <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs flex gap-2 items-start">
                      <MessageSquare className="w-4 h-4 text-[#D4A017] mt-0.5 flex-shrink-0" />
                      <div className="text-[#E5D5C5]">
                        <span className="font-bold text-[#D4A017] uppercase text-[9px] block font-mono">Kitchen Note</span>
                        <p className="italic">{order.note}</p>
                      </div>
                    </div>
                  )}

                  {/* Note inputs */}
                  {activeNotes[order.id] ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={noteInputs[order.id] || ""}
                        onChange={(e) => setNoteInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                        placeholder={t.addNotePlaceholder}
                        className="flex-1 px-3 py-2 bg-[#1A130E] border border-[#2A1E15] text-xs text-white rounded-lg outline-none focus:border-[#C8102E]"
                      />
                      <button
                        onClick={() => addOrderNote(order.id)}
                        className="px-3 bg-[#10B981] hover:bg-[#10B981]/90 text-white font-bold rounded-lg text-xs cursor-pointer active:scale-95 transition-all"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setActiveNotes(prev => ({ ...prev, [order.id]: false }))}
                        className="px-3 bg-white/10 text-white font-bold rounded-lg text-xs cursor-pointer active:scale-95 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveNotes(prev => ({ ...prev, [order.id]: true }))}
                      className="text-left text-xs text-[#8E7E70] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      + {t.addNoteBtn}
                    </button>
                  )}

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 gap-2.5 mt-2 border-t border-[#2A1E15] pt-4">
                    {order.order_status === "pending" && (
                      <button
                        onClick={() => updateOrderStatus(order.id, "seen")}
                        className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] font-mono tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>MARK SEEN</span>
                      </button>
                    )}

                    {(order.order_status === "pending" || order.order_status === "seen") && (
                      <button
                        onClick={() => updateOrderStatus(order.id, "preparing")}
                        className="w-full py-2.5 bg-[#C8102E] hover:bg-[#C8102E]/90 text-white font-bold text-[10px] font-mono tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer col-span-2 sm:col-span-1"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>PREPARING</span>
                      </button>
                    )}

                    {order.order_status === "preparing" && (
                      <button
                        onClick={() => updateOrderStatus(order.id, "served")}
                        className="w-full py-2.5 bg-[#10B981] hover:bg-[#10B981]/90 text-white font-bold text-[10px] font-mono tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer col-span-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>SERVE ORDER</span>
                      </button>
                    )}

                    {order.order_status === "served" && (
                      <button
                        onClick={() => updateOrderStatus(order.id, "bill_requested")}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] font-mono tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer col-span-2"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>CALL FOR BILL</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
