import { useState, useEffect } from "react";
import { supabase as oe } from "../../lib/supabase";
import { toast } from "sonner";
import { Bell, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

interface WaiterCall {
  id: string;
  order_id: string;
  table_id: string;
  area: string;
  called_at: string;
  status: "pending" | "acknowledged";
  acknowledged_at?: string;
}

// Global shared state for hooks and components
const listeners = new Set<() => void>();
let globalPendingCalls: WaiterCall[] = [];

const subscribeToCallsStore = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifySubscribers = () => {
  listeners.forEach((l) => l());
};

const setPendingCallsStore = (calls: WaiterCall[]) => {
  globalPendingCalls = calls;
  notifySubscribers();
};

const addCallToStore = (call: WaiterCall) => {
  if (!globalPendingCalls.some((c) => c.id === call.id)) {
    globalPendingCalls = [call, ...globalPendingCalls];
    notifySubscribers();
  }
};

const removeCallFromStore = (id: string) => {
  globalPendingCalls = globalPendingCalls.filter((c) => c.id !== id);
  notifySubscribers();
};

// Hook: Returns the count of pending calls from shared state
export function usePendingCallsCount(): number {
  const [count, setCount] = useState(globalPendingCalls.length);

  useEffect(() => {
    const handleUpdate = () => {
      setCount(globalPendingCalls.length);
    };
    handleUpdate();
    return subscribeToCallsStore(handleUpdate);
  }, []);

  return count;
}

export default function WaiterCallAlert({ language }: { language: "fr" | "en" }) {
  const [calls, setCalls] = useState<WaiterCall[]>(globalPendingCalls);
  const [timeNow, setTimeNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  
  const shouldReduceMotion = useReducedMotion();
  const isMock = !oe || oe.isMock;

  const T = {
    fr: {
      activeCallsTitle: "Appels de Table Actifs 🛎️",
      tableIsCalling: "Table {tableId} appelle un serveur",
      acknowledge: "ACQUITTER",
      noActiveCalls: "Aucun appel en cours",
      minutesAgo: "Il y a {n} min",
    },
    en: {
      activeCallsTitle: "Active Table Calls 🛎️",
      tableIsCalling: "Table {tableId} is calling",
      acknowledge: "ACKNOWLEDGE",
      noActiveCalls: "No active calls",
      minutesAgo: "{n} min ago",
    },
  };

  const t = T[language] || T.fr;

  // Web Audio API beep synthesizer
  const playAlertBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (err) {
      console.warn("Audio Alert beep failed to play:", err);
    }
  };

  // Sync state with global store
  useEffect(() => {
    const handleUpdate = () => {
      setCalls([...globalPendingCalls]);
    };
    return subscribeToCallsStore(handleUpdate);
  }, []);

  // Fetch pending calls and subscribe to Realtime
  useEffect(() => {
    const fetchPendingCalls = async () => {
      setLoading(true);
      try {
        const { data, error } = await oe
          .from("waiter_calls")
          .select("*")
          .eq("status", "pending")
          .order("called_at", { ascending: false });

        if (error) throw error;
        if (data) {
          setPendingCallsStore(data);
        }
      } catch (err) {
        console.error("WaiterCallAlert: Failed to fetch calls:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingCalls();

    // Subscribe to INSERT / UPDATE on waiter_calls
    const channel = oe
      .channel("waiter_calls_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waiter_calls" },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            const newCall = payload.new as WaiterCall;
            if (newCall.status === "pending") {
              addCallToStore(newCall);
              
              // Trigger alerts
              toast(`🛎️ Table ${newCall.table_id} : ${newCall.area || ""}`, {
                description: language === "fr" ? "Un client demande de l'aide !" : "Table requires assistance!",
                duration: 8000,
                position: "top-right",
              });

              if ("vibrate" in navigator) {
                navigator.vibrate([200, 100, 200, 100, 200]);
              }
              playAlertBeep();
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedCall = payload.new as WaiterCall;
            if (updatedCall.status === "acknowledged") {
              removeCallFromStore(updatedCall.id);
            } else {
              addCallToStore(updatedCall);
            }
          } else if (payload.eventType === "DELETE") {
            removeCallFromStore(payload.old.id);
          }
        }
      )
      .subscribe();

    // Mock sync support (when operating locally without supabase DB)
    if (isMock) {
      const handleStorageUpdate = () => {
        try {
          const localCalls = JSON.parse(localStorage.getItem("ldf_waiter_calls") || "[]");
          const pending = localCalls.filter((c: any) => c.status === "pending");
          
          // Check for any newly added calls to trigger chime/toast
          pending.forEach((c: any) => {
            if (!globalPendingCalls.some(g => g.id === c.id)) {
              toast(`🛎️ Table ${c.table_id} : ${c.area || ""}`, {
                description: language === "fr" ? "Un client demande de l'aide !" : "Table requires assistance!",
                duration: 8000,
                position: "top-right",
              });
              playAlertBeep();
            }
          });
          
          setPendingCallsStore(pending);
        } catch (_) {}
      };
      window.addEventListener("storage", handleStorageUpdate);
      window.addEventListener("ldf-db-update", handleStorageUpdate);
      return () => {
        window.removeEventListener("storage", handleStorageUpdate);
        window.removeEventListener("ldf-db-update", handleStorageUpdate);
      };
    }

    const clockInterval = setInterval(() => setTimeNow(Date.now()), 30000);

    return () => {
      oe.removeChannel(channel);
      clearInterval(clockInterval);
    };
  }, [isMock, language]);

  const handleAcknowledge = async (callId: string) => {
    setSyncingId(callId);
    try {
      const timestamp = new Date().toISOString();
      if (isMock) {
        const localCalls = JSON.parse(localStorage.getItem("ldf_waiter_calls") || "[]");
        const idx = localCalls.findIndex((c: any) => c.id === callId);
        if (idx > -1) {
          localCalls[idx].status = "acknowledged";
          localCalls[idx].acknowledged_at = timestamp;
          localStorage.setItem("ldf_waiter_calls", JSON.stringify(localCalls));
          window.dispatchEvent(new Event("ldf-db-update"));
        }
      } else {
        await oe
          .from("waiter_calls")
          .update({
            status: "acknowledged",
            acknowledged_at: timestamp,
          })
          .eq("id", callId);
      }

      if ("vibrate" in navigator) {
        navigator.vibrate([50]);
      }
      
      removeCallFromStore(callId);
    } catch (err) {
      console.error("Failed to acknowledge waiter call:", err);
    } finally {
      setSyncingId(null);
    }
  };

  const getElapsedTime = (calledAt: string) => {
    const diffMs = timeNow - new Date(calledAt).getTime();
    const diffMins = Math.max(0, Math.floor(diffMs / 60000));
    return t.minutesAgo.replace("{n}", String(diffMins));
  };

  // Render calls list panel in AdminDashboard
  if (calls.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-md">
      <h3 
        style={{ fontFamily: "Georgia, serif" }}
        className="font-bold text-base text-foreground mb-4 flex items-center gap-2"
      >
        <Bell className="w-5 h-5 text-primary animate-pulse" />
        <span>{t.activeCallsTitle}</span>
      </h3>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {calls.map((call) => (
            <motion.div
              layout={!shouldReduceMotion}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
              key={call.id}
              className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center justify-between gap-3 shadow-inner"
            >
              <div>
                <div style={{ fontFamily: "Georgia, serif" }} className="font-bold text-foreground text-sm">
                  🛎️ Table {call.table_id}
                </div>
                <div className="text-muted-foreground font-mono text-[10px] mt-0.5 uppercase tracking-wider flex items-center gap-2">
                  <span>{call.area}</span>
                  <span>•</span>
                  <span className="text-accent">{getElapsedTime(call.called_at)}</span>
                </div>
              </div>

              <button
                onClick={() => handleAcknowledge(call.id)}
                disabled={syncingId === call.id}
                className="bg-[#10B981]/10 border border-[#10B981]/30 hover:bg-[#10B981]/20 text-[#10B981] font-mono text-[9px] font-bold px-3 py-2 rounded-lg cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                {syncingId === call.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                <span>{t.acknowledge}</span>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
