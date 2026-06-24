import { useState, useEffect, useRef } from "react";
import { supabase as oe } from "../../lib/supabase";
import { Clock, Check, Bell, RefreshCw } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

interface OrderTrackerProps {
  orderId: string;
  orderNumber: string; // e.g., "ORD-1234"
  tableId: string;
  area: string;
  items: Array<{ name: string; quantity: number; price: number; customizations?: any }>;
  totalPrice: number;
  language: "fr" | "en";
  onCallWaiter: () => void;
  onNewOrder: () => void;
  waiterCallPending: boolean;
}

export function OrderTracker({
  orderId,
  orderNumber,
  tableId,
  area,
  items,
  totalPrice,
  language,
  onCallWaiter,
  onNewOrder,
  waiterCallPending,
}: OrderTrackerProps) {
  const [orderStatus, setOrderStatus] = useState<string>("pending");
  const [createdAt, setCreatedAt] = useState<string>(new Date().toISOString());
  const [timeNow, setTimeNow] = useState<number>(Date.now());
  const [showCelebration, setShowCelebration] = useState(false);
  const [showActiveCallAlert, setShowActiveCallAlert] = useState(false);

  const prevStatusRef = useRef<string>("pending");
  const shouldReduceMotion = useReducedMotion();

  // Translation keys
  const T = {
    fr: {
      orderReceived: "Commande reçue",
      seenByStaff: "Vue par l'équipe",
      beingPrepared: "En préparation 🍳",
      readyToServe: "Prêt à servir ✅",
      minutesAgo: "Il y a {n} min",
      billRequested: "Addition demandée",
      billRequestedDesc: "Addition demandée — un serveur arrive 🧾",
      bonAppetit: "Bon appétit ! 🍽️",
      enjoyMeal: "Profitez de votre repas !",
      thankYouVisit: "Merci pour votre visite ! À bientôt 👋",
      seeYouSoon: "À très bientôt",
      newOrder: "Nouvelle commande",
      callWaiter: "🛎️ Appeler un serveur",
      waiterOnTheWay: "Un serveur arrive... 🚶",
      callAlreadyActive: "Votre appel est en cours...",
      orderSummary: "Détail de la commande",
      total: "Total",
      table: "Table",
    },
    en: {
      orderReceived: "Order received",
      seenByStaff: "Seen by staff",
      beingPrepared: "Being prepared 🍳",
      readyToServe: "Ready to serve ✅",
      minutesAgo: "{n} min ago",
      billRequested: "Bill requested",
      billRequestedDesc: "Bill requested — waiter on the way 🧾",
      bonAppetit: "Enjoy your meal! 🍽️",
      enjoyMeal: "Bon appétit!",
      thankYouVisit: "Thank you! See you soon 👋",
      seeYouSoon: "See you soon",
      newOrder: "New order",
      callWaiter: "🛎️ Call a waiter",
      waiterOnTheWay: "Waiter on the way... 🚶",
      callAlreadyActive: "Your call is already active...",
      orderSummary: "Order Summary",
      total: "Total",
      table: "Table",
    },
  };

  const t = T[language] || T.fr;

  useEffect(() => {
    // 1. Fetch initial status and createdAt
    const fetchOrderDetails = async () => {
      try {
        const { data, error } = await oe
          .from("orders")
          .select("order_status, created_at")
          .eq("id", orderId)
          .single();

        if (data) {
          setOrderStatus(data.order_status || "pending");
          prevStatusRef.current = data.order_status || "pending";
          if (data.created_at) {
            setCreatedAt(data.created_at);
          }
        }
      } catch (err) {
        console.error("OrderTracker failed to fetch initial order details:", err);
      }
    };

    fetchOrderDetails();

    // 2. Realtime subscription for status updates
    const channel = oe
      .channel(`order-tracker-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.order_status) {
            setOrderStatus(payload.new.order_status);
          }
        }
      )
      .subscribe();

    // 3. Keep elapsed time fresh
    const interval = setInterval(() => {
      setTimeNow(Date.now());
    }, 30000);

    return () => {
      oe.removeChannel(channel);
      clearInterval(interval);
    };
  }, [orderId]);

  // Handle celebration trigger when status becomes 'served'
  useEffect(() => {
    if (orderStatus === "served" && prevStatusRef.current !== "served") {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 2000);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = orderStatus;
  }, [orderStatus]);

  // Stepper helper
  const steps = [
    { key: "pending", label: t.orderReceived },
    { key: "seen", label: t.seenByStaff },
    { key: "preparing", label: t.beingPrepared },
    { key: "served", label: t.readyToServe },
  ];

  const getStepIndex = (status: string) => {
    if (status === "pending") return 0;
    if (status === "seen") return 1;
    if (status === "preparing") return 2;
    if (status === "served" || status === "bill_requested") return 3;
    if (status === "paid") return 4;
    return 0;
  };

  const activeIndex = getStepIndex(orderStatus);

  // Time elapsed calculation
  const getElapsedTimeText = () => {
    const diffMs = timeNow - new Date(createdAt).getTime();
    const diffMins = Math.max(0, Math.floor(diffMs / 60000));
    return t.minutesAgo.replace("{n}", String(diffMins));
  };

  const handleCallWaiterClick = () => {
    if (waiterCallPending) {
      setShowActiveCallAlert(true);
      setTimeout(() => setShowActiveCallAlert(false), 3000);
      return;
    }
    onCallWaiter();
  };

  const numericOrderNumber = orderNumber.replace("ORD-", "");

  // Paid / Thank You Screen
  if (orderStatus === "paid") {
    return (
      <div className="w-full max-w-md mx-auto bg-card border border-border rounded-2xl p-6 text-center shadow-xl my-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="py-10 flex flex-col items-center justify-center gap-6"
        >
          <div className="w-20 h-20 rounded-full bg-[#10B981]/10 border-4 border-[#10B981]/30 flex items-center justify-center text-[#10B981] text-4xl">
            ✓
          </div>
          <h2 className="font-serif font-bold text-2xl text-foreground leading-snug">
            {t.thankYouVisit}
          </h2>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {t.seeYouSoon}
          </p>
          <button
            onClick={onNewOrder}
            className="w-full bg-primary hover:opacity-90 text-foreground font-bold rounded-xl text-xs py-3.5 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
          >
            <RefreshCw size={14} />
            <span>{t.newOrder}</span>
          </button>
        </motion.div>
      </div>
    );
  }

  // Particle list for local served celebration
  const particles = [
    { id: 1, color: "#D4A017", tx: -90, ty: -120, scale: 1.4 },
    { id: 2, color: "#C8102E", tx: 90, ty: -100, scale: 1.1 },
    { id: 3, color: "#D4A017", tx: -30, ty: -160, scale: 1.6 },
    { id: 4, color: "#C8102E", tx: 40, ty: -140, scale: 1.3 },
  ];

  return (
    <div className="w-full max-w-md mx-auto bg-card border border-border rounded-2xl p-6 shadow-xl my-6 relative overflow-hidden">
      
      {/* Celebration Particle Effect */}
      <AnimatePresence>
        {showCelebration && !shouldReduceMotion && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 bg-card/90">
            <div className="relative flex flex-col items-center justify-center">
              {particles.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
                  animate={{ 
                    opacity: 0, 
                    x: p.tx, 
                    y: p.ty, 
                    scale: p.scale 
                  }}
                  transition={{ duration: 1.8, ease: "easeOut" }}
                  className="absolute w-4 h-4 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
              ))}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <h3 className="font-serif font-black text-3xl text-accent mb-2">
                  {t.bonAppetit}
                </h3>
                <p className="text-xs text-foreground font-mono tracking-widest uppercase">
                  {t.enjoyMeal}
                </p>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Header Info */}
      <div className="flex justify-between items-start border-b border-border pb-4 mb-6">
        <div>
          <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase">
            {t.orderSummary}
          </span>
          <h2 className="text-3xl font-mono font-bold text-foreground mt-1">
            #{numericOrderNumber}
          </h2>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            {t.table} {tableId} — {area}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase">
            Total
          </span>
          <div className="text-xl font-bold text-accent mt-1">
            {totalPrice.toFixed(2)}€
          </div>
        </div>
      </div>

      {/* Stepper Progress Section */}
      <div className="relative mb-8 pt-2">
        {/* Horizontal Line (Desktop) */}
        <div className="hidden sm:block absolute top-[18px] left-[12%] right-[12%] h-[3px] bg-[#2A1E15] z-0">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ 
              scaleX: activeIndex === 0 ? 0 : activeIndex === 1 ? 0.33 : activeIndex === 2 ? 0.66 : 1 
            }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4 }}
            className="h-full bg-primary origin-left"
          />
        </div>

        {/* Vertical Line (Mobile) */}
        <div className="sm:hidden absolute top-[28px] bottom-[28px] left-[18px] w-[3px] bg-[#2A1E15] z-0">
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ 
              scaleY: activeIndex === 0 ? 0 : activeIndex === 1 ? 0.33 : activeIndex === 2 ? 0.66 : 1 
            }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4 }}
            className="w-full bg-primary origin-top"
          />
        </div>

        {/* Steps List */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 sm:gap-2 relative z-10">
          {steps.map((step, idx) => {
            const isCompleted = idx < activeIndex;
            const isActive = idx === activeIndex;
            
            return (
              <div 
                key={step.key} 
                className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2 flex-1"
              >
                {/* Circle Indicator */}
                <div className="relative shrink-0">
                  {isCompleted ? (
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-foreground border border-primary">
                      <Check className="w-5 h-5 stroke-[3]" />
                    </div>
                  ) : isActive ? (
                    <motion.div
                      animate={shouldReduceMotion ? {} : { 
                        borderColor: ["#D4A017", "#C8102E", "#D4A017"],
                        boxShadow: [
                          "0 0 0 0px rgba(212,160,23,0.2)",
                          "0 0 0 6px rgba(212,160,23,0)",
                          "0 0 0 0px rgba(212,160,23,0.2)"
                        ]
                      }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="w-9 h-9 rounded-full bg-card border-2 border-accent flex items-center justify-center text-accent"
                    >
                      <Clock className="w-4 h-4 animate-spin-slow" />
                    </motion.div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-card border-2 border-border flex items-center justify-center text-[#5A4E42]" />
                  )}
                </div>

                {/* Label text */}
                <div className="flex flex-col sm:items-center">
                  <span 
                    className={`text-xs font-bold leading-tight ${
                      isActive ? "text-foreground font-black" : isCompleted ? "text-muted-foreground" : "text-[#5A4E42]"
                    }`}
                  >
                    {step.label}
                  </span>
                  
                  {/* Elapsed Timer (Active Step Only) */}
                  {isActive && (
                    <span className="text-[9px] font-mono text-accent mt-0.5 tracking-wider bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20 uppercase">
                      {getElapsedTimeText()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bill Requested Banner */}
      {orderStatus === "bill_requested" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/10 border border-primary/30 text-foreground rounded-xl p-3.5 text-center text-xs font-medium mb-6 flex items-center justify-center gap-2"
        >
          <span>{t.billRequestedDesc}</span>
        </motion.div>
      )}

      {/* Items Summary list */}
      <div className="border-t border-border pt-5 pb-4 mb-6">
        <ul className="space-y-3.5 max-h-48 overflow-y-auto pr-1">
          {items.map((item, idx) => (
            <li key={idx} className="text-xs text-foreground">
              <div className="flex justify-between font-mono">
                <span>{item.quantity}× {item.name}</span>
                <span>{(item.price * item.quantity).toFixed(2)}€</span>
              </div>
              {item.customizations && Object.keys(item.customizations).length > 0 && (
                <div className="text-[10px] text-[#5A4E42] mt-0.5 font-sans pl-4">
                  {Object.entries(item.customizations)
                    .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(", ") : val}`)
                    .join(" | ")}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Call Waiter Footer Button */}
      {orderStatus !== "paid" && orderStatus !== "served" && orderStatus !== "bill_requested" && (
        <div className="border-t border-border pt-5">
          <button
            onClick={handleCallWaiterClick}
            disabled={waiterCallPending}
            className={`w-full font-bold rounded-xl text-xs py-3.5 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all ${
              waiterCallPending
                ? "bg-transparent border-2 border-primary text-primary animate-pulse cursor-not-allowed"
                : "bg-primary hover:opacity-90 text-foreground"
            }`}
          >
            <Bell size={14} className={waiterCallPending ? "animate-bounce" : ""} />
            <span>
              {waiterCallPending ? t.waiterOnTheWay : t.callWaiter}
            </span>
          </button>
          
          {showActiveCallAlert && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-[10px] text-accent font-mono mt-2 uppercase tracking-wider animate-pulse"
            >
              {t.callAlreadyActive}
            </motion.p>
          )}
        </div>
      )}
    </div>
  );
}
