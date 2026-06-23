import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Maximize2, Minimize2, Clock, Loader2, Utensils, ShoppingBag, Wifi, WifiOff
} from "lucide-react";
import { translations, Language } from "../../lib/translations";
import { motion, AnimatePresence } from "motion/react";

interface Order {
  id: string;
  table_id: string;
  order_status: "pending" | "seen" | "preparing" | "served" | "bill_requested" | "paid";
  created_at: string;
}

export function CustomerDisplay() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [lang, setLang] = useState<Language>("fr");
  const [timeNow, setTimeNow] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shouldFlashReady, setShouldFlashReady] = useState(false);
  const [servedTimes, setServedTimes] = useState<Record<string, number>>({});

  const prevReadyIdsRef = useRef<string[]>([]);
  const isMock = !supabase || supabase.isMock || !supabase.auth;
  const t = translations[lang];

  // Synthesize a retro-style double chime (G5 -> C6) using Web Audio API
  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;

      // Note 1: G5 (783.99 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(783.99, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // Note 2: C6 (1046.50 Hz) with a 150ms delay
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1046.50, now + 0.15);
      gain2.gain.setValueAtTime(0.15, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.55);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.75);
    } catch (err) {
      console.warn("Audio chime playback blocked or failed:", err);
    }
  };

  useEffect(() => {
    // Sync browser language
    if (typeof window !== "undefined") {
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === "en") setLang("en");
    }

    loadCustomerOrders();

    // Setup Live Realtime Subscription
    let subscription: any = null;
    if (!isMock) {
      subscription = supabase
         .channel("customer_display_channel")
         .on(
           "postgres_changes",
           { event: "*", schema: "public", table: "orders" },
           () => {
             loadCustomerOrders();
           }
         )
         .subscribe((status) => {
           setOnline(status === "SUBSCRIBED");
         });
    } else {
      // Mock Realtime via storage event listener
      const handleStorageUpdate = (e: any) => {
        if (e.key && (e.key === "ldf_orders" || e.key === "ldf_order_items")) {
          loadCustomerOrders();
        }
      };
      window.addEventListener("storage", handleStorageUpdate);
      window.addEventListener("ldf-db-update", loadCustomerOrders);
      return () => {
        window.removeEventListener("storage", handleStorageUpdate);
        window.removeEventListener("ldf-db-update", loadCustomerOrders);
      };
    }

    // Poll fallback every 15 seconds to ensure sync
    const pollInterval = setInterval(loadCustomerOrders, 15000);

    // Clock ticks every second
    const clockInterval = setInterval(() => setTimeNow(Date.now()), 1000);

    // Fullscreen event listener
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
  }, [isMock]);

  // Keep served timestamps synced with localStorage
  useEffect(() => {
    const syncServedTimes = () => {
      try {
        const cached = JSON.parse(localStorage.getItem("ldf_kds_served_times") || "{}");
        setServedTimes(cached);
      } catch (_) {}
    };
    syncServedTimes();
    const interval = setInterval(syncServedTimes, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadCustomerOrders = async () => {
    try {
      let data: any[] | null = null;
      let error: any = null;

      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const todayStr = todayMidnight.toISOString();

      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        data = localOrders.filter((o: any) => o.order_status !== "paid" && o.created_at >= todayStr);
      } else {
        const response = await supabase
          .from("orders")
          .select("id, table_id, order_status, created_at")
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
        setOrders(formatted);
      }
    } catch (err) {
      console.error("Customer Display error loading orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Filter ready (served) orders
  const readyOrders = orders.filter(o => {
    if (o.order_status !== "served") return false;
    const servedAt = servedTimes[o.id];
    if (servedAt !== undefined && Date.now() - servedAt >= 120000) {
      return false; // auto-expires after 2 minutes
    }
    return true;
  });

  const dineInOrders = readyOrders.filter(o => o.table_id.toUpperCase() !== "DELIVERY");
  const takeawayOrders = readyOrders.filter(o => o.table_id.toUpperCase() === "DELIVERY");

  // Play chime and flash when new ready orders arrive
  useEffect(() => {
    const readyIds = readyOrders.map(o => o.id);
    const newReadyIds = readyIds.filter(id => !prevReadyIdsRef.current.includes(id));
    
    // Only play if it is not the initial load
    if (newReadyIds.length > 0 && prevReadyIdsRef.current.length > 0) {
      setShouldFlashReady(true);
      setTimeout(() => setShouldFlashReady(false), 2000);
      playChime();
    }
    prevReadyIdsRef.current = readyIds;
  }, [readyOrders]);

  return (
    <div className="h-screen w-screen bg-[#1E0B07] text-[#F5EBDC] flex flex-col select-none overflow-hidden relative group/fullscreen">
      
      {/* Dynamic Flashing Alert Overlay (When a new order becomes ready) */}
      <AnimatePresence>
        {shouldFlashReady && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#FFAA00] pointer-events-none z-40"
          />
        )}
      </AnimatePresence>

      {/* Hidden Hover-Only Controls in top-right corner to keep TV screens clean */}
      <div className="absolute top-4 right-4 z-50 opacity-0 group-hover/fullscreen:opacity-100 transition-opacity duration-300">
        <button
          onClick={toggleFullscreen}
          style={{ fontFamily: "Fredoka, sans-serif" }}
          className="p-3 bg-[#D62300] hover:bg-[#B31D00] text-white rounded-xl shadow-lg cursor-pointer transition-all active:scale-95 flex items-center gap-2 border border-red-500/20 text-xs font-bold"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          <span>{isFullscreen ? "MODE FENÊTRE" : "PLEIN ÉCRAN"}</span>
        </button>
      </div>

      {/* Retro Brand Header */}
      <header className="px-4 md:px-12 py-3 md:py-5 bg-[#120603] border-b border-[#3D1E16] flex items-center justify-between flex-wrap gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3 md:gap-5">
          {/* Stylized Logo Badge */}
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-[#FFAA00] border-4 border-[#D62300] flex items-center justify-center font-serif font-black text-lg md:text-2xl text-[#1E0B07] shadow-inner rotate-[-4deg]">
            LDF
          </div>
          <div>
            <h1 
              style={{ fontFamily: "Fraunces, serif" }}
              className="text-2xl md:text-4xl font-[900] tracking-tight text-[#F5EBDC] leading-none"
            >
              LE DOUBLE FACE
            </h1>
            <p 
              style={{ fontFamily: "Fredoka, sans-serif" }}
              className="text-xs font-bold tracking-widest text-[#FF8732] uppercase mt-1"
            >
              {t.orderDisplayBoard}
            </p>
          </div>
        </div>

        {/* Status Indicators & Clock */}
        <div className="flex items-center gap-3 md:gap-8">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1E0B07] rounded-lg border border-[#3D1E16]">
            {online ? (
              <>
                <Wifi className="w-4 h-4 text-[#198737]" />
                <span style={{ fontFamily: "Fredoka, sans-serif" }} className="text-[10px] font-bold text-[#198737] uppercase tracking-wider">SYNC ON</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-[#D62300] animate-pulse" />
                <span style={{ fontFamily: "Fredoka, sans-serif" }} className="text-[10px] font-bold text-[#D62300] uppercase tracking-wider">OFFLINE</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Clock className="w-4 h-4 md:w-6 md:h-6 text-[#FFAA00]" />
            <div 
              style={{ fontFamily: "Fredoka, sans-serif" }}
              className="text-xl md:text-3xl font-black tracking-widest text-[#FFAA00]"
            >
              {new Date(timeNow).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </header>

      {/* Columns Board (Dine-In / Takeaway) — stacks on mobile, 2-col on md+ */}
      <main className="flex-1 w-full p-4 md:p-10 gap-4 md:gap-10 grid grid-cols-1 md:grid-cols-2 overflow-y-auto md:overflow-hidden bg-[#1E0B07]">
        
        {/* Left Column: À table (Dine-in) */}
        <div className="flex flex-col bg-[#120603] border-4 border-[#2D120A] rounded-[32px] overflow-hidden shadow-2xl relative">
          {/* Header Panel */}
          <div className="px-8 py-5.5 bg-[#FFAA00] border-b-4 border-[#2D120A] flex items-center justify-between shrink-0">
            <h2 
              style={{ fontFamily: "Fraunces, serif" }}
              className="text-3xl font-[900] tracking-wide uppercase text-[#1E0B07] flex items-center gap-3"
            >
              <Utensils className="w-7 h-7 stroke-[2.5]" />
              <span>{t.dineInLabel}</span>
            </h2>
            <span 
              style={{ fontFamily: "Fredoka, sans-serif" }}
              className="bg-[#1E0B07] text-[#FFAA00] font-black text-2xl px-5 py-1 rounded-full border-2 border-[#2D120A]"
            >
              {dineInOrders.length}
            </span>
          </div>

          {/* Cards Area */}
          <div className="flex-1 overflow-y-auto p-8 scrollbar-none">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-[#F5EBDC]/50">
                <Loader2 className="w-12 h-12 animate-spin text-[#FFAA00] mb-3" />
                <p style={{ fontFamily: "Fredoka, sans-serif" }} className="text-sm font-bold uppercase tracking-widest">CHARGEMENT...</p>
              </div>
            ) : dineInOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#F5EBDC]/10 text-center py-20">
                <Utensils className="w-20 h-20 mb-4 stroke-[1.5]" />
                <p 
                  style={{ fontFamily: "Fraunces, serif" }} 
                  className="text-xl font-bold tracking-wide"
                >
                  {lang === "fr" ? "Pas de commandes prêtes" : "No orders ready"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <AnimatePresence initial={false}>
                  {dineInOrders.map(order => {
                    const code = order.id.replace("ORD-", "");
                    return (
                      <motion.div
                        layoutId={`order-${order.id}`}
                        initial={{ opacity: 0, scale: 0.8, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 220, damping: 18 }}
                        key={order.id}
                        className="h-28 bg-[#F5EBDC] border-4 border-[#2D120A] rounded-[24px] flex flex-col items-center justify-center shadow-[6px_6px_0px_0px_#2D120A] relative overflow-hidden"
                      >
                        <div 
                          style={{ fontFamily: "Fredoka, sans-serif" }}
                          className="absolute top-2 left-4 text-xs font-black text-[#FF8732] bg-[#1E0B07] px-2.5 py-0.5 rounded-full border border-[#2D120A]"
                        >
                          TABLE {order.table_id}
                        </div>
                        <span 
                          style={{ fontFamily: "Fredoka, sans-serif" }}
                          className="text-6xl font-[900] text-[#1E0B07] tracking-tighter mt-2"
                        >
                          {code}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: À emporter (Takeaway) */}
        <div className="flex flex-col bg-[#120603] border-4 border-[#2D120A] rounded-[32px] overflow-hidden shadow-2xl relative">
          {/* Header Panel */}
          <div className="px-8 py-5.5 bg-[#D62300] border-b-4 border-[#2D120A] flex items-center justify-between shrink-0">
            <h2 
              style={{ fontFamily: "Fraunces, serif" }}
              className="text-3xl font-[900] tracking-wide uppercase text-[#F5EBDC] flex items-center gap-3"
            >
              <ShoppingBag className="w-7 h-7 stroke-[2.5]" />
              <span>{t.takeawayLabel}</span>
            </h2>
            <span 
              style={{ fontFamily: "Fredoka, sans-serif" }}
              className="bg-[#1E0B07] text-[#D62300] font-black text-2xl px-5 py-1 rounded-full border-2 border-[#2D120A]"
            >
              {takeawayOrders.length}
            </span>
          </div>

          {/* Cards Area */}
          <div className="flex-1 overflow-y-auto p-8 scrollbar-none">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-[#F5EBDC]/50">
                <Loader2 className="w-12 h-12 animate-spin text-[#D62300] mb-3" />
                <p style={{ fontFamily: "Fredoka, sans-serif" }} className="text-sm font-bold uppercase tracking-widest">CHARGEMENT...</p>
              </div>
            ) : takeawayOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#F5EBDC]/10 text-center py-20">
                <ShoppingBag className="w-20 h-20 mb-4 stroke-[1.5]" />
                <p 
                  style={{ fontFamily: "Fraunces, serif" }} 
                  className="text-xl font-bold tracking-wide"
                >
                  {lang === "fr" ? "Pas de retraits prêts" : "No pickups ready"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <AnimatePresence initial={false}>
                  {takeawayOrders.map(order => {
                    const code = order.id.replace("ORD-", "");
                    return (
                      <motion.div
                        layoutId={`order-${order.id}`}
                        initial={{ opacity: 0, scale: 0.8, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 220, damping: 18 }}
                        key={order.id}
                        className="h-28 bg-[#F5EBDC] border-4 border-[#2D120A] rounded-[24px] flex flex-col items-center justify-center shadow-[6px_6px_0px_0px_#2D120A] relative overflow-hidden"
                      >
                        <div 
                          style={{ fontFamily: "Fredoka, sans-serif" }}
                          className="absolute top-2 left-4 text-xs font-black text-[#198737] bg-[#1E0B07] px-2.5 py-0.5 rounded-full border border-[#2D120A] uppercase tracking-wider"
                        >
                          BAG 🛍️
                        </div>
                        <span 
                          style={{ fontFamily: "Fredoka, sans-serif" }}
                          className="text-6xl font-[900] text-[#D62300] tracking-tighter mt-2"
                        >
                          {code}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Footer Branding Bar */}
      <footer className="px-4 md:px-12 py-3 bg-[#120603] border-t border-[#3D1E16] flex items-center justify-between shrink-0">
        <span 
          style={{ fontFamily: "Fredoka, sans-serif" }}
          className="text-xs font-black uppercase tracking-[0.2em] text-[#FF8732]"
        >
          • Mettez la main à la pâte •
        </span>
        <span 
          style={{ fontFamily: "Fredoka, sans-serif" }}
          className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F5EBDC]/40"
        >
          LE DOUBLE FACE digital display board system
        </span>
      </footer>
    </div>
  );
}
