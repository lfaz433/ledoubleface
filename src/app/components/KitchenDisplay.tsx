import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Clock, Play, CheckCircle2, ChevronRight, AlertTriangle, 
  Maximize2, Minimize2, Wifi, WifiOff, Loader2, ArrowLeft, Lock, Check, Archive
} from "lucide-react";
import { translations, Language } from "../../lib/translations";
import { motion, AnimatePresence } from "motion/react";

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

export function KitchenDisplay() {
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [lang, setLang] = useState<Language>("fr");
  const [timeNow, setTimeNow] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Served timestamps registry to track the 2-minute auto-expiry on "Ready" column
  const [servedTimes, setServedTimes] = useState<Record<string, number>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMock = !supabase || supabase.isMock || !supabase.auth;
  const t = translations[lang];

  // 1. PIN Gate Verification
  useEffect(() => {
    const verified = sessionStorage.getItem("ldf_kitchen_pin_verified") === "true";
    if (verified) {
      setIsPinVerified(true);
    }
    // Detect browser language
    if (typeof window !== "undefined") {
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === "en") setLang("en");
      // Pre-load notification sound
      audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav");
    }
  }, []);

  // Load served times cache from localStorage on initialization
  useEffect(() => {
    if (isPinVerified) {
      try {
        const cached = JSON.parse(localStorage.getItem("ldf_kds_served_times") || "{}");
        // Cleanup entries older than 24 hours to prevent memory leaks
        const now = Date.now();
        const cleaned: Record<string, number> = {};
        Object.entries(cached).forEach(([id, timestamp]) => {
          if (now - (timestamp as number) < 86400000) {
            cleaned[id] = timestamp as number;
          }
        });
        localStorage.setItem("ldf_kds_served_times", JSON.stringify(cleaned));
        setServedTimes(cleaned);
      } catch (_) {}
    }
  }, [isPinVerified]);

  // Main KDS sync hook
  useEffect(() => {
    if (!isPinVerified) return;

    loadKdsOrders();

    // Setup Live Realtime Subscription
    let subscription: any = null;
    if (!isMock) {
      subscription = supabase
         .channel("kds_orders_channel")
         .on(
           "postgres_changes",
           { event: "*", schema: "public", table: "orders" },
           (payload) => {
             // Play chime on incoming new orders
             if (payload.eventType === "INSERT") {
               audioRef.current?.play().catch(() => {});
             }
             loadKdsOrders();
           }
         )
         .subscribe((status) => {
           setOnline(status === "SUBSCRIBED");
         });
    } else {
      // Mock Realtime via storage event listener
      const handleStorageUpdate = (e: any) => {
        if (e.key && (e.key === "ldf_orders" || e.key === "ldf_order_items")) {
          loadKdsOrders();
        }
      };
      window.addEventListener("storage", handleStorageUpdate);
      window.addEventListener("ldf-db-update", loadKdsOrders);
      return () => {
        window.removeEventListener("storage", handleStorageUpdate);
        window.removeEventListener("ldf-db-update", loadKdsOrders);
      };
    }

    // Poll fallback every 15 seconds
    const pollInterval = setInterval(loadKdsOrders, 15000);

    // Clock ticks every second for fullscreen header & card duration counters
    const clockInterval = setInterval(() => setTimeNow(Date.now()), 1000);

    // Monitor fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      if (subscription) supabase.removeChannel(subscription);
      clearInterval(pollInterval);
      clearInterval(clockInterval);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isPinVerified, servedTimes, isMock]);

  const loadKdsOrders = async () => {
    try {
      let data: any[] | null = null;
      let error: any = null;

      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const todayStr = todayMidnight.toISOString();

      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const localItems = JSON.parse(localStorage.getItem("ldf_order_items") || "[]");
        
        data = localOrders
          .filter((o: any) => o.order_status !== "paid" && o.created_at >= todayStr)
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
          .neq("order_status", "paid")
          .gte("created_at", todayStr)
          .order("created_at", { ascending: true });

        data = response.data;
        error = response.error;
      }

      if (error) throw error;

      if (data) {
        const formatted = data.map(o => ({
          ...o,
          order_status: o.order_status || "pending"
        }));

        // Dynamically register transition timestamps for newly "served" orders we haven't seen yet
        const now = Date.now();
        let updatedServedTimes = { ...servedTimes };
        let timesChanged = false;

        formatted.forEach(o => {
          if (o.order_status === "served" && !updatedServedTimes[o.id]) {
            updatedServedTimes[o.id] = now;
            timesChanged = true;
          }
        });

        if (timesChanged) {
          localStorage.setItem("ldf_kds_served_times", JSON.stringify(updatedServedTimes));
          setServedTimes(updatedServedTimes);
        }

        setOrders(formatted);
      }
    } catch (err) {
      console.error("KDS error loading orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const advanceOrderStatus = async (orderId: string, currentStatus: Order["order_status"]) => {
    let nextStatus: Order["order_status"] = "seen";
    let traditionalStatus = "pending";

    if (currentStatus === "pending" || currentStatus === "seen") {
      nextStatus = "preparing";
      traditionalStatus = "preparing";
    } else if (currentStatus === "preparing") {
      nextStatus = "served"; // Maps to "Ready" column
      traditionalStatus = "delivered";
      // Record served timestamp locally immediately
      const updatedTimes = { ...servedTimes, [orderId]: Date.now() };
      localStorage.setItem("ldf_kds_served_times", JSON.stringify(updatedTimes));
      setServedTimes(updatedTimes);
    } else if (currentStatus === "served") {
      // Archive instantly on click by marking served time as expired
      const updatedTimes = { ...servedTimes, [orderId]: 0 };
      localStorage.setItem("ldf_kds_served_times", JSON.stringify(updatedTimes));
      setServedTimes(updatedTimes);
      loadKdsOrders();
      return;
    }

    try {
      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const updated = localOrders.map((o: any) => {
          if (o.id === orderId) {
            return { ...o, order_status: nextStatus, status: traditionalStatus };
          }
          return o;
        });
        localStorage.setItem("ldf_orders", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: "orders" } }));
      } else {
        const { error } = await supabase
          .from("orders")
          .update({ order_status: nextStatus, status: traditionalStatus })
          .eq("id", orderId);
        if (error) throw error;
      }
      loadKdsOrders();
    } catch (err) {
      console.error("Failed to advance order status:", err);
    }
  };

  const verifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    const envPin = import.meta.env.VITE_KITCHEN_PIN || "1234";
    if (pinInput === envPin) {
      sessionStorage.setItem("ldf_kitchen_pin_verified", "true");
      setIsPinVerified(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const getElapsedTime = (createdAt: string) => {
    const diffMs = timeNow - new Date(createdAt).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 0) return "0s";
    
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    return `${mins}m ${secs}s`;
  };

  const isUrgentPending = (createdAt: string) => {
    const diffMs = timeNow - new Date(createdAt).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    return diffSecs >= 600; // 10 minutes
  };

  // Filter columns based on operational status mapping
  const pendingOrders = orders.filter(o => o.order_status === "pending" || o.order_status === "seen");
  const preparingOrders = orders.filter(o => o.order_status === "preparing");
  const readyOrders = orders.filter(o => {
    if (o.order_status !== "served") return false;
    const servedAt = servedTimes[o.id];
    // Exclude if marked served more than 2 minutes (120,000ms) ago
    if (servedAt !== undefined && Date.now() - servedAt >= 120000) {
      return false;
    }
    return true;
  });

  // Render PIN security gate
  if (!isPinVerified) {
    return (
      <div className="min-h-screen bg-[#0A0704] flex items-center justify-center p-4 font-sans select-none text-white animate-fade-in">
        <div className="w-full max-w-sm bg-[#120D09] border border-[#2A1E15] p-8 rounded-2xl shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-[#C8102E]" />
          
          <div className="w-12 h-12 rounded-xl bg-[#C8102E]/10 border border-[#C8102E]/30 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5 text-[#C8102E]" />
          </div>

          <h2 className="font-serif font-black text-xl text-white mb-1">Le Double Face</h2>
          <p className="text-[9.5px] font-mono tracking-widest text-[#8E7E70] uppercase mb-8">
            {t.enterKitchenPin}
          </p>

          {pinError && (
            <div className="mb-6 p-3 bg-[#C8102E]/15 border border-[#C8102E]/35 rounded-xl text-xs text-[#C8102E] flex items-center justify-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t.invalidPin}</span>
            </div>
          )}

          <form onSubmit={verifyPin} className="space-y-6">
            <input
              type="password"
              maxLength={4}
              required
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full px-4 py-3 bg-[#1A130E] border border-[#2A1E15] rounded-xl text-white outline-none focus:border-[#C8102E] text-center tracking-widest text-2xl font-bold font-mono focus:ring-1 focus:ring-[#C8102E]/50"
            />

            <button
              type="submit"
              className="w-full py-3 bg-[#C8102E] hover:bg-[#C8102E]/90 text-white font-bold rounded-xl text-xs tracking-widest uppercase transition-all cursor-pointer active:scale-[0.98] shadow-lg shadow-[#C8102E]/15"
            >
              Verify Code
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#070503] text-white flex flex-col font-sans select-none overflow-hidden">
      {/* KDS Header */}
      <header className="px-4 md:px-6 py-3 bg-[#100B07] border-b border-[#23170F] flex items-center justify-between gap-2 flex-wrap z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#C8102E] flex items-center justify-center font-serif font-black text-xs text-white animate-pulse">L</div>
          <div>
            <h1 className="font-serif font-bold text-sm tracking-tight text-white">{t.kdsTitle}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/30 border border-white/5 text-[9px] font-mono uppercase text-[#8E7E70]">
                {online ? (
                  <>
                    <Wifi className="w-2.5 h-2.5 text-[#10B981]" />
                    <span className="text-[#10B981] font-bold">ONLINE</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-2.5 h-2.5 text-[#EF4444]" />
                    <span className="text-[#EF4444] font-bold">OFFLINE</span>
                  </>
                )}
              </div>
              <span className="hidden sm:inline text-[9px] font-mono text-[#8E7E70] uppercase">
                {isMock ? "LOCAL SIMULATION" : "LIVE CLOUD CONNECTED"}
              </span>
            </div>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-mono font-bold tracking-wider text-[#E5D5C5]">
              {new Date(timeNow).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[9px] font-mono text-[#8E7E70] uppercase">
              {new Date(timeNow).toLocaleDateString([], { weekday: 'short', month: 'short', day: '2-digit' })}
            </div>
          </div>

          <div className="hidden sm:block h-6 w-px bg-[#23170F]" />

          <div className="flex gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-[#1A130E] border border-[#2A1E15] hover:bg-white/5 rounded-lg text-white transition-colors cursor-pointer"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem("ldf_kitchen_pin_verified");
                setIsPinVerified(false);
                setPinInput("");
              }}
              className="px-2 md:px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-[10px] font-mono uppercase transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Lock size={10} /> <span className="hidden sm:inline">Lock Screen</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Board Workspace — 3 cols on desktop, stacks vertically on mobile */}
      <main className="flex-1 w-full p-3 md:p-4 gap-3 md:gap-4 grid grid-cols-1 md:grid-cols-3 overflow-y-auto md:overflow-hidden">
        {/* Column 1: Pending Orders */}
        <div className="flex flex-col bg-[#0C0805] border border-red-950/20 rounded-xl overflow-hidden shadow-inner">
          <div className="px-4 py-3 bg-red-950/15 border-b border-red-950/40 flex items-center justify-between shrink-0">
            <h3 className="font-serif font-black text-xs tracking-wider uppercase text-red-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {t.pendingCol}
            </h3>
            <span className="bg-red-500/20 border border-red-500/30 text-red-500 font-mono font-bold text-xs px-2.5 py-0.5 rounded-full">
              {pendingOrders.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
            <AnimatePresence initial={false}>
              {pendingOrders.map(order => {
                const urgent = isUrgentPending(order.created_at);
                const orderNum = order.id.replace("ORD-", "");

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    key={order.id}
                    onClick={() => advanceOrderStatus(order.id, order.order_status)}
                    className={`border rounded-xl p-4 transition-all relative overflow-hidden cursor-pointer group ${
                      urgent 
                        ? "border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.25)] bg-red-950/20 animate-pulse" 
                        : "border-[#20150E] bg-[#120D09] hover:border-red-500/40 shadow-md"
                    }`}
                  >
                    {/* Timer */}
                    <div className={`absolute top-0 right-0 px-2.5 py-0.5 text-[9px] font-mono font-bold flex items-center gap-1 rounded-bl-lg ${
                      urgent ? "bg-red-600 text-white" : "bg-white/5 text-[#8E7E70]"
                    }`}>
                      <Clock className="w-3 h-3" />
                      <span>{getElapsedTime(order.created_at)}</span>
                    </div>

                    <div className="mb-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-black text-base text-white">#{orderNum}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-[#E5D5C5] uppercase font-bold border border-white/10">
                          Table {order.table_id}
                        </span>
                      </div>
                      <div className="text-[9px] font-mono text-[#8E7E70] uppercase mt-0.5">{order.area}</div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-1.5 py-2.5 border-t border-b border-[#23170F] text-xs leading-snug">
                      {order.order_items?.map(item => (
                        <div key={item.id} className="flex justify-between gap-2">
                          <div className="flex-1">
                            <span className="font-bold text-[#E5D5C5] mr-1.5">{item.quantity}x</span>
                            <span className="text-white font-medium">{item.name}</span>
                            {item.customizations && Object.keys(item.customizations).length > 0 && (
                              <div className="text-[9.5px] text-[#8E7E70] ml-4 font-mono">
                                {Object.entries(item.customizations).map(([key, val]: any) => (
                                  <div key={key}>• {key}: {Array.isArray(val) ? val.join(", ") : val}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Note */}
                    {order.note && (
                      <div className="mt-2 text-[10px] text-[#D4A017] bg-[#D4A017]/5 border border-[#D4A017]/25 p-2 rounded-lg italic leading-normal">
                        <span className="font-mono font-bold block uppercase text-[8px] tracking-wider mb-0.5">NOTE:</span>
                        {order.note}
                      </div>
                    )}

                    {/* Progress Indicator */}
                    <div className="mt-3 flex items-center justify-end gap-1 text-[9px] font-mono font-bold text-red-500 uppercase tracking-widest pt-2 border-t border-[#23170F]/50 group-hover:text-red-400">
                      <span>TAP TO COOK</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </motion.div>
                );
              })}
              {pendingOrders.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-[#8E7E70] text-center p-6 py-20">
                  <span className="text-2xl mb-1">🍽️</span>
                  <p className="text-[10px] font-mono uppercase tracking-widest">No pending tickets</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Column 2: In Preparation */}
        <div className="flex flex-col bg-[#0C0805] border border-amber-950/20 rounded-xl overflow-hidden shadow-inner">
          <div className="px-4 py-3 bg-amber-950/15 border-b border-amber-950/40 flex items-center justify-between shrink-0">
            <h3 className="font-serif font-black text-xs tracking-wider uppercase text-amber-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {t.preparingCol}
            </h3>
            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-500 font-mono font-bold text-xs px-2.5 py-0.5 rounded-full">
              {preparingOrders.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
            <AnimatePresence initial={false}>
              {preparingOrders.map(order => {
                const orderNum = order.id.replace("ORD-", "");
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    key={order.id}
                    onClick={() => advanceOrderStatus(order.id, order.order_status)}
                    className="border border-[#20150E] bg-[#120D09] hover:border-amber-500/40 rounded-xl p-4 transition-all relative overflow-hidden cursor-pointer group shadow-md"
                  >
                    {/* Timer */}
                    <div className="absolute top-0 right-0 px-2.5 py-0.5 text-[9px] font-mono font-bold flex items-center gap-1 rounded-bl-lg bg-white/5 text-[#8E7E70]">
                      <Clock className="w-3 h-3" />
                      <span>{getElapsedTime(order.created_at)}</span>
                    </div>

                    <div className="mb-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-black text-base text-white">#{orderNum}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-[#E5D5C5] uppercase font-bold border border-white/10">
                          Table {order.table_id}
                        </span>
                      </div>
                      <div className="text-[9px] font-mono text-[#8E7E70] uppercase mt-0.5">{order.area}</div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-1.5 py-2.5 border-t border-b border-[#23170F] text-xs leading-snug">
                      {order.order_items?.map(item => (
                        <div key={item.id} className="flex justify-between gap-2">
                          <div className="flex-1">
                            <span className="font-bold text-[#E5D5C5] mr-1.5">{item.quantity}x</span>
                            <span className="text-white font-medium">{item.name}</span>
                            {item.customizations && Object.keys(item.customizations).length > 0 && (
                              <div className="text-[9.5px] text-[#8E7E70] ml-4 font-mono">
                                {Object.entries(item.customizations).map(([key, val]: any) => (
                                  <div key={key}>• {key}: {Array.isArray(val) ? val.join(", ") : val}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Note */}
                    {order.note && (
                      <div className="mt-2 text-[10px] text-[#D4A017] bg-[#D4A017]/5 border border-[#D4A017]/25 p-2 rounded-lg italic leading-normal">
                        <span className="font-mono font-bold block uppercase text-[8px] tracking-wider mb-0.5">NOTE:</span>
                        {order.note}
                      </div>
                    )}

                    {/* Progress Indicator */}
                    <div className="mt-3 flex items-center justify-end gap-1 text-[9px] font-mono font-bold text-amber-500 uppercase tracking-widest pt-2 border-t border-[#23170F]/50 group-hover:text-amber-400">
                      <span>TAP TO SERVE</span>
                      <Play className="w-3.5 h-3.5" />
                    </div>
                  </motion.div>
                );
              })}
              {preparingOrders.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-[#8E7E70] text-center p-6 py-20">
                  <span className="text-2xl mb-1">🍳</span>
                  <p className="text-[10px] font-mono uppercase tracking-widest">Nothing cooking right now</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Column 3: Ready for pickup (Green) */}
        <div className="flex flex-col bg-[#0C0805] border border-green-950/20 rounded-xl overflow-hidden shadow-inner">
          <div className="px-4 py-3 bg-green-950/15 border-b border-green-950/40 flex items-center justify-between shrink-0">
            <h3 className="font-serif font-black text-xs tracking-wider uppercase text-green-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {t.readyCol}
            </h3>
            <span className="bg-green-500/20 border border-green-500/30 text-green-500 font-mono font-bold text-xs px-2.5 py-0.5 rounded-full">
              {readyOrders.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
            <AnimatePresence initial={false}>
              {readyOrders.map(order => {
                const orderNum = order.id.replace("ORD-", "");
                const servedAt = servedTimes[order.id];
                const ageSecs = servedAt ? Math.max(0, Math.floor((Date.now() - servedAt) / 1000)) : 0;
                const remainingSecs = Math.max(0, 120 - ageSecs);
                const percent = (remainingSecs / 120) * 100;

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    key={order.id}
                    onClick={() => advanceOrderStatus(order.id, order.order_status)}
                    className="border border-[#20150E] bg-[#120D09] hover:border-green-500/40 rounded-xl p-4 transition-all relative overflow-hidden cursor-pointer group shadow-md"
                  >
                    {/* Expiry Bar (2m countdown indicator) */}
                    <div 
                      className="absolute bottom-0 left-0 h-1 bg-green-600 transition-all duration-1000" 
                      style={{ width: `${percent}%` }}
                    />

                    {/* Expiry Countdown Timer */}
                    <div className="absolute top-0 right-0 px-2.5 py-0.5 text-[9px] font-mono font-bold flex items-center gap-1 rounded-bl-lg bg-green-950/20 text-green-500 border-l border-b border-green-950/40">
                      <span>AUTO: {remainingSecs}s</span>
                    </div>

                    <div className="mb-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-black text-base text-white">#{orderNum}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-950/10 text-green-400 uppercase font-bold border border-green-950/30">
                          Table {order.table_id}
                        </span>
                      </div>
                      <div className="text-[9px] font-mono text-[#8E7E70] uppercase mt-0.5">{order.area}</div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-1.5 py-2.5 border-t border-b border-[#23170F] text-xs leading-snug">
                      {order.order_items?.map(item => (
                        <div key={item.id} className="flex justify-between gap-2 text-[#8E7E70]">
                          <div className="flex-1">
                            <span className="font-bold text-[#E5D5C5] mr-1.5">{item.quantity}x</span>
                            <span className="text-[#E5D5C5] font-medium">{item.name}</span>
                            {item.customizations && Object.keys(item.customizations).length > 0 && (
                              <div className="text-[9.5px] text-[#8E7E70] ml-4 font-mono">
                                {Object.entries(item.customizations).map(([key, val]: any) => (
                                  <div key={key}>• {key}: {Array.isArray(val) ? val.join(", ") : val}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Note */}
                    {order.note && (
                      <div className="mt-2 text-[10px] text-[#8E7E70] bg-white/5 border border-white/5 p-2 rounded-lg italic leading-normal">
                        <span className="font-mono font-bold block uppercase text-[8px] tracking-wider mb-0.5">NOTE:</span>
                        {order.note}
                      </div>
                    )}

                    {/* Progress Indicator */}
                    <div className="mt-3 flex items-center justify-end gap-1.5 text-[9px] font-mono font-bold text-green-500 uppercase tracking-widest pt-2 border-t border-[#23170F]/50 group-hover:text-green-400">
                      <span>TAP TO ARCHIVE</span>
                      <Archive className="w-3.5 h-3.5" />
                    </div>
                  </motion.div>
                );
              })}
              {readyOrders.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-[#8E7E70] text-center p-6 py-20">
                  <span className="text-2xl mb-1">✅</span>
                  <p className="text-[10px] font-mono uppercase tracking-widest">No orders waiting service</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
