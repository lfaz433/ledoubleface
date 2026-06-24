import { useState, useEffect } from "react";
import { supabase as oe } from "../../lib/supabase";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface OrderStatusBadgeProps {
  orderId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

const statusCycle = ["pending", "seen", "preparing", "served", "bill_requested", "paid"];

const statusStyles: Record<string, { bg: string; border: string; text: string; label: string; next: string }> = {
  pending: {
    bg: "bg-accent/10",
    border: "border-accent/30",
    text: "text-accent",
    label: "En attente ⏳",
    next: "Vu 👀",
  },
  seen: {
    bg: "bg-[#8E7E70]/10",
    border: "border-[#8E7E70]/30",
    text: "text-muted-foreground",
    label: "Vu 👀",
    next: "Préparation 🍳",
  },
  preparing: {
    bg: "bg-[#F59E0B]/10",
    border: "border-[#F59E0B]/30",
    text: "text-[#F59E0B]",
    label: "Préparation 🍳",
    next: "Servi ✅",
  },
  served: {
    bg: "bg-[#10B981]/10",
    border: "border-[#10B981]/30",
    text: "text-[#10B981]",
    label: "Servi ✅",
    next: "Addition requested 🧾",
  },
  bill_requested: {
    bg: "bg-primary/10",
    border: "border-primary/30",
    text: "text-primary",
    label: "Addition requested 🧾",
    next: "Payé 💵",
  },
  paid: {
    bg: "bg-secondary",
    border: "border-border",
    text: "text-[#5A4E42]",
    label: "Payé 💵",
    next: "Terminal",
  },
};

export function OrderStatusBadge({ orderId, currentStatus, onStatusChange }: OrderStatusBadgeProps) {
  const [status, setStatus] = useState(currentStatus);
  const [syncing, setSyncing] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Sync local state if prop changes (e.g. from realtime update)
  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const isMock = !oe || oe.isMock;

  const handleBadgeClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening order details card
    if (status === "paid" || syncing) return;

    const currentIdx = statusCycle.indexOf(status);
    if (currentIdx === -1) return;
    const nextStatus = statusCycle[currentIdx + 1];

    // Optimistic Update
    const prevStatus = status;
    setStatus(nextStatus);
    if (onStatusChange) {
      onStatusChange(nextStatus);
    }
    
    setSyncing(true);
    try {
      if (isMock) {
        // Mock DB implementation
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

        const { error } = await oe
          .from("orders")
          .update(payload)
          .eq("id", orderId);

        if (error) throw error;
      }
      toast.success(`Statut mis à jour : ${statusStyles[nextStatus].label}`, { duration: 2000 });
    } catch (err) {
      // Revert on error
      setStatus(prevStatus);
      if (onStatusChange) {
        onStatusChange(prevStatus);
      }
      toast.error("Échec de la mise à jour du statut");
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const style = statusStyles[status] || statusStyles.pending;
  const isPaid = status === "paid";

  return (
    <div 
      className="relative inline-block select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={handleBadgeClick}
        disabled={isPaid || syncing}
        className={`px-2.5 py-1 text-[10px] font-bold font-mono tracking-wider rounded-lg border uppercase transition-all flex items-center gap-1.5 ${
          style.bg
        } ${style.border} ${style.text} ${
          isPaid ? "cursor-default" : "cursor-pointer hover:brightness-125 hover:scale-[1.03] active:scale-[0.97]"
        }`}
      >
        {syncing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : isPaid ? (
          <Lock className="w-3 h-3 text-[#5A4E42]" />
        ) : null}
        <span>{style.label}</span>
      </button>

      {/* Tooltip on Hover */}
      <AnimatePresence>
        {hovered && !isPaid && !syncing && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2 py-1 bg-black text-foreground border border-border text-[9px] font-mono tracking-wider uppercase rounded shadow-lg whitespace-nowrap z-50 pointer-events-none"
          >
            Avancer → {style.next}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
