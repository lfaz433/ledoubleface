import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { 
  Bike, 
  CheckCircle, 
  Clock, 
  LogOut, 
  Phone, 
  MapPin, 
  User, 
  DollarSign, 
  AlertCircle, 
  Loader2, 
  Activity, 
  FileText, 
  RefreshCw,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  customizations?: any;
}

interface Order {
  id: string;
  table_id: string;
  status: string;
  order_status: string;
  paid: boolean;
  total: number;
  note?: string;
  created_at: string;
  assigned_driver_id?: string | null;
  delivery_status: "pending" | "assigned" | "shipping" | "delivered";
  order_items?: OrderItem[];
}

interface DriverDashboardProps {
  driverId: string;
  driverName: string;
  driverEmail: string;
  onLogout: () => void;
}

export function DriverDashboard({ driverId, driverName, driverEmail, onLogout }: DriverDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<"available" | "my-deliveries" | "history">("available");
  const [timeNow, setTimeNow] = useState(Date.now());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMock = !supabase || supabase.isMock || !supabase.auth;

  // Sound notification setup
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav");
    }
  }, []);

  // Main real-time synchronization hook
  useEffect(() => {
    loadDeliveryOrders();

    // 1. Live Supabase subscription
    let subscription: any = null;
    if (!isMock) {
      subscription = supabase
        .channel("driver_orders_channel")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            // Play alert sound if a new delivery order becomes available
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const order = payload.new as Order;
              if (
                order.table_id === "DELIVERY" &&
                order.delivery_status === "pending" &&
                payload.eventType === "INSERT"
              ) {
                audioRef.current?.play().catch(() => {});
                toast.info("Nouvelle livraison disponible !");
              }
            }
            loadDeliveryOrders();
          }
        )
        .subscribe((status) => {
          setOnline(status === "SUBSCRIBED");
        });
    } else {
      // Local simulation updates
      const handleStorageUpdate = (e: any) => {
        if (e.key && (e.key === "ldf_orders" || e.key === "ldf_order_items")) {
          loadDeliveryOrders();
        }
      };
      window.addEventListener("storage", handleStorageUpdate);
      window.addEventListener("ldf-db-update", loadDeliveryOrders);
      return () => {
        window.removeEventListener("storage", handleStorageUpdate);
        window.removeEventListener("ldf-db-update", loadDeliveryOrders);
      };
    }

    // fallback polling
    const pollInterval = setInterval(loadDeliveryOrders, 20000);
    // heartbeat updater
    const heartbeatInterval = setInterval(sendHeartbeat, 30000);
    sendHeartbeat(); // initial check-in
    // clock timer
    const clockInterval = setInterval(() => setTimeNow(Date.now()), 30000);

    return () => {
      if (subscription) supabase.removeChannel(subscription);
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
      clearInterval(clockInterval);
    };
  }, [isMock]);

  // Online status heartbeat reporter
  const sendHeartbeat = async () => {
    try {
      const now = new Date().toISOString();
      if (isMock) {
        const localDrivers = JSON.parse(localStorage.getItem("ldf_drivers") || "[]");
        const updated = localDrivers.map((d: any) => 
          d.id === driverId ? { ...d, last_seen: now } : d
        );
        localStorage.setItem("ldf_drivers", JSON.stringify(updated));
      } else {
        await supabase
          .from("drivers")
          .update({ last_seen: now })
          .eq("id", driverId);
      }
    } catch (_) {
      // suppress heartbeat reporting errors silently
    }
  };

  // Main order loading logic
  const loadDeliveryOrders = async () => {
    try {
      let data: any[] | null = null;
      let error: any = null;

      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const todayStr = todayMidnight.toISOString();

      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const localItems = JSON.parse(localStorage.getItem("ldf_order_items") || "[]");
        
        // Filter only delivery orders created today
        const deliveryOrders = localOrders.filter(
          (o: any) => o.table_id === "DELIVERY" && o.created_at >= todayStr
        );

        // Attach order items
        data = deliveryOrders.map((o: any) => ({
          ...o,
          order_items: localItems.filter((i: any) => i.order_id === o.id)
        }));
      } else {
        const response = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("table_id", "DELIVERY")
          .gte("created_at", todayStr)
          .order("created_at", { ascending: false });
        data = response.data;
        error = response.error;
      }

      if (error) throw error;
      if (data) setOrders(data);
    } catch (err: any) {
      console.error("Failed to load delivery orders:", err);
    } finally {
      setLoading(false);
    }
  };

  // Accept a pending delivery order
  const handleAcceptOrder = async (orderId: string) => {
    try {
      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const updated = localOrders.map((o: any) => 
          o.id === orderId 
            ? { ...o, assigned_driver_id: driverId, delivery_status: "assigned" }
            : o
        );
        localStorage.setItem("ldf_orders", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: "orders" } }));
        toast.success("Livraison acceptée !");
      } else {
        const { error } = await supabase
          .from("orders")
          .update({ assigned_driver_id: driverId, delivery_status: "assigned" })
          .eq("id", orderId);
        if (error) throw error;
        toast.success("Livraison acceptée !");
      }
      loadDeliveryOrders();
    } catch (err: any) {
      toast.error("Erreur lors de l'acceptation.");
    }
  };

  // Start shipping an order
  const handleStartShipping = async (orderId: string) => {
    try {
      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const updated = localOrders.map((o: any) => 
          o.id === orderId ? { ...o, delivery_status: "shipping" } : o
        );
        localStorage.setItem("ldf_orders", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: "orders" } }));
        toast.success("Livraison commencée. En route !");
      } else {
        const { error } = await supabase
          .from("orders")
          .update({ delivery_status: "shipping" })
          .eq("id", orderId);
        if (error) throw error;
        toast.success("Livraison commencée. En route !");
      }
      loadDeliveryOrders();
    } catch (err: any) {
      toast.error("Erreur lors du démarrage.");
    }
  };

  // Complete a delivery order (mark delivered, paid: true, trigger receipt download)
  const handleCompleteDelivery = async (order: Order) => {
    try {
      if (isMock) {
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const updated = localOrders.map((o: any) => 
          o.id === order.id 
            ? { 
                ...o, 
                delivery_status: "delivered", 
                paid: true, 
                order_status: "paid", 
                status: "delivered" 
              } 
            : o
        );
        localStorage.setItem("ldf_orders", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: "orders" } }));
        toast.success("Livraison terminée & payée !");
      } else {
        const { error } = await supabase
          .from("orders")
          .update({ 
            delivery_status: "delivered", 
            paid: true, 
            order_status: "paid", 
            status: "delivered" 
          })
          .eq("id", order.id);
        if (error) throw error;
        toast.success("Livraison terminée & payée !");
      }
      
      // Auto download invoice receipt canvas
      downloadInvoicePNG({ ...order, paid: true });
      loadDeliveryOrders();
    } catch (err: any) {
      toast.error("Erreur lors de la validation.");
    }
  };

  // Render invoice receipt to canvas and trigger browser download
  const downloadInvoicePNG = (order: any) => {
    const id = order.id;
    const table = order.table_id;

    const canvasWidth = 360;
    const canvasHeight = 480;

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Load QR code image first
    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(id)}`;

    const drawAndDownload = () => {
      // Background
      ctx.fillStyle = "#120D09";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Border styling
      ctx.strokeStyle = "#2A1E15";
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, canvasWidth - 10, canvasHeight - 10);
      ctx.strokeStyle = "#D4A017";
      ctx.lineWidth = 1;
      ctx.strokeRect(12, 12, canvasWidth - 24, canvasHeight - 24);

      // Header Title
      ctx.fillStyle = "#D4A017";
      ctx.font = "bold 26px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("LE DOUBLE FACE", canvasWidth / 2, 70);

      // Subtitle
      ctx.fillStyle = "#8E7E70";
      ctx.font = "10px monospace";
      ctx.fillText("COMMANDE & QR CODE", canvasWidth / 2, 95);

      // Elegant divider
      ctx.strokeStyle = "#2A1E15";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, 115);
      ctx.lineTo(canvasWidth - 30, 115);
      ctx.stroke();

      // Order Info Label
      ctx.fillStyle = "#8E7E70";
      ctx.font = "11px monospace";
      ctx.fillText("CODE DE LA FACTURE", canvasWidth / 2, 145);

      // Actual order code
      ctx.fillStyle = "#E5D5C5";
      ctx.font = "bold 20px monospace";
      ctx.fillText(id, canvasWidth / 2, 175);

      // Delivery Badge details
      ctx.fillStyle = "#D4A017";
      ctx.font = "bold 15px monospace";
      ctx.fillText("🛵 LIVRAISON À DOMICILE", canvasWidth / 2, 210);

      // Draw QR Code frame
      ctx.strokeStyle = "#D4A017";
      ctx.lineWidth = 1;
      ctx.strokeRect((canvasWidth - 158) / 2, 235, 158, 158);

      // Draw QR Code Image
      try {
        ctx.drawImage(qrImg, (canvasWidth - 150) / 2, 239, 150, 150);
      } catch (err) {
        console.error("Failed to draw QR code on canvas:", err);
        ctx.fillStyle = "#C8102E";
        ctx.font = "11px monospace";
        ctx.fillText("QR CODE ERROR", canvasWidth / 2, 315);
      }

      // Footer instructions
      ctx.fillStyle = "#8E7E70";
      ctx.font = "9px monospace";
      ctx.fillText("SCANNABLE PAR L'ADMINISTRATEUR POUR SUIVI", canvasWidth / 2, 420);

      ctx.fillStyle = "#D4A017";
      ctx.font = "italic 11px Georgia, serif";
      ctx.fillText("Merci pour votre confiance !", canvasWidth / 2, 445);

      // Trigger automatic file download
      try {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `Facture-${id}.png`;
        link.href = dataUrl;
        link.click();
      } catch (e) {
        console.error("Failed to export canvas as PNG (CORS tainted?):", e);
      }
    };

    qrImg.onload = drawAndDownload;
    // Fallback if loading QR code fails/times out
    qrImg.onerror = drawAndDownload;
    setTimeout(() => {
      if (qrImg.complete) return;
      drawAndDownload();
    }, 2000);
  };

  // Helper parser for custom delivery fields from the note text
  const parseDeliveryInfo = (note: string | undefined | null) => {
    const result = {
      name: "Client Anonyme",
      phone: "Non renseigné",
      address: "Non renseignée",
      email: "",
      userNote: ""
    };
    if (!note) return result;

    const lines = note.split("\n");
    let isDeliveryInfo = false;
    const noteParts: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith("DELIVERY INFO:")) {
        isDeliveryInfo = true;
        continue;
      }
      if (isDeliveryInfo) {
        if (line.startsWith("Name:")) {
          result.name = line.replace("Name:", "").trim();
        } else if (line.startsWith("Phone:")) {
          result.phone = line.replace("Phone:", "").trim();
        } else if (line.startsWith("Address:")) {
          result.address = line.replace("Address:", "").trim();
        } else if (line.startsWith("Email:")) {
          result.email = line.replace("Email:", "").trim();
        } else if (line.startsWith("Note:")) {
          result.userNote = line.replace("Note:", "").trim();
        } else if (line.trim() === "") {
          // spacer line
        } else {
          noteParts.push(line);
        }
      } else {
        noteParts.push(line);
      }
    }

    const remaining = noteParts.join("\n").trim();
    if (remaining) {
      result.userNote = result.userNote ? `${result.userNote}\n${remaining}` : remaining;
    }
    return result;
  };

  // Filter orders by tab
  const getFilteredOrders = () => {
    switch (activeTab) {
      case "available":
        return orders.filter(
          (o) => o.delivery_status === "pending" && o.order_status !== "paid"
        );
      case "my-deliveries":
        return orders.filter(
          (o) => 
            o.assigned_driver_id === driverId && 
            (o.delivery_status === "assigned" || o.delivery_status === "shipping")
        );
      case "history":
        return orders.filter(
          (o) => o.assigned_driver_id === driverId && o.delivery_status === "delivered"
        );
      default:
        return [];
    }
  };

  const getRelativeTimeString = (createdAt: string) => {
    const elapsedMs = timeNow - new Date(createdAt).getTime();
    const min = Math.floor(elapsedMs / 60000);
    if (min < 1) return "À l'instant";
    return `Il y a ${min} min`;
  };

  const filteredOrders = getFilteredOrders();
  const availableCount = orders.filter((o) => o.delivery_status === "pending" && o.order_status !== "paid").length;
  const myDeliveriesCount = orders.filter((o) => o.assigned_driver_id === driverId && (o.delivery_status === "assigned" || o.delivery_status === "shipping")).length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none">
      {/* Premium Header */}
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 border border-accent/20 rounded-xl">
            <Bike className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="font-serif font-black text-sm text-foreground flex items-center gap-1.5 leading-none">
              Le Double Face <Sparkles size={11} className="text-accent animate-pulse" />
            </h1>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1">
              Livreur: <span className="text-foreground font-bold">{driverName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-muted border border-border px-2.5 py-1.5 rounded-xl">
            <span className={`w-2.5 h-2.5 rounded-full ${online ? "bg-[#10B981] animate-pulse" : "bg-primary"}`} />
            <span className="text-[9px] font-mono font-bold tracking-wider text-muted-foreground uppercase">
              {online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          <button
            onClick={onLogout}
            className="p-2.5 bg-primary/10 hover:bg-primary/25 text-primary border border-primary/20 rounded-xl transition-all cursor-pointer"
            title="Se déconnecter"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Tab Switcher Panel */}
      <nav className="bg-card/50 border-b border-border px-2 py-1 flex items-center justify-around">
        <button
          onClick={() => setActiveTab("available")}
          className={`flex-1 py-3 text-center transition-all border-b-2 flex flex-col items-center gap-1 cursor-pointer ${
            activeTab === "available" 
              ? "border-accent text-foreground" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-[10px] font-mono tracking-wider uppercase font-bold">Disponible</span>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
            availableCount > 0 ? "bg-accent text-black" : "bg-muted text-muted-foreground"
          }`}>
            {availableCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("my-deliveries")}
          className={`flex-1 py-3 text-center transition-all border-b-2 flex flex-col items-center gap-1 cursor-pointer ${
            activeTab === "my-deliveries" 
              ? "border-accent text-foreground" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-[10px] font-mono tracking-wider uppercase font-bold">Mes Livraisons</span>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
            myDeliveriesCount > 0 ? "bg-[#10B981] text-black" : "bg-muted text-muted-foreground"
          }`}>
            {myDeliveriesCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 text-center transition-all border-b-2 flex flex-col items-center gap-1 cursor-pointer ${
            activeTab === "history" 
              ? "border-accent text-foreground" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-[10px] font-mono tracking-wider uppercase font-bold">Historique</span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            ✓
          </span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
            <span className="text-xs font-mono tracking-wider">CHARGEMENT DES COMMANDES...</span>
          </div>
        ) : (
          <div className="space-y-4 pb-12">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order) => {
                const info = parseDeliveryInfo(order.note);
                
                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="bg-card border border-border rounded-2xl p-4 shadow-md flex flex-col gap-3 relative overflow-hidden"
                  >
                    {/* Header Info */}
                    <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase block">CODE COMMANDE</span>
                        <span className="font-bold text-foreground font-mono text-sm tracking-wide">{order.id}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-right flex-col">
                        <span className="text-[9px] font-mono text-accent bg-accent/10 px-2 py-0.5 border border-accent/20 rounded-md font-bold uppercase">
                          🛵 DELIVERY
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                          <Clock size={11} />
                          <span>{getRelativeTimeString(order.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Customer Info Card */}
                    <div className="bg-muted border border-border rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-start gap-3">
                        <User className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground uppercase leading-none mb-1">Destinataire</p>
                          <p className="text-xs text-foreground font-bold">{info.name}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 border-t border-border/50 pt-2">
                        <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground uppercase leading-none mb-1">Adresse de livraison</p>
                          <p className="text-xs text-foreground font-medium leading-relaxed select-text">{info.address}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 border-t border-border/50 pt-2">
                        <Phone className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground uppercase leading-none mb-1">Téléphone</p>
                          <a 
                            href={`tel:${info.phone}`} 
                            className="text-xs text-foreground font-bold hover:underline flex items-center gap-1"
                          >
                            {info.phone}
                          </a>
                        </div>
                      </div>

                      {info.userNote && (
                        <div className="border-t border-b border-border/50 py-2 mt-1 bg-background/40 px-2 rounded-lg">
                          <p className="text-[8px] font-mono text-muted-foreground uppercase mb-0.5">Instructions de livraison</p>
                          <p className="text-[11px] text-accent italic leading-relaxed">"{info.userNote}"</p>
                        </div>
                      )}
                    </div>

                    {/* Order Items list */}
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-mono text-muted-foreground uppercase px-1">Détail des Plats</p>
                      <div className="bg-muted/40 rounded-xl border border-border/30 p-3 space-y-1.5">
                        {order.order_items?.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-accent font-bold">{item.quantity}x</span>
                              <span className="text-foreground font-medium">{item.name}</span>
                            </div>
                            <span className="font-mono text-muted-foreground">€{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer price and actions */}
                    <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-1">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase block">TOTAL DU</span>
                        <span className="text-base font-bold text-foreground font-mono flex items-center">
                          <DollarSign size={14} className="text-[#10B981] -mt-0.5" />
                          {order.total.toFixed(2)}€
                        </span>
                      </div>

                      {/* Action buttons mapping */}
                      <div className="flex-1 max-w-[200px] flex justify-end">
                        {order.delivery_status === "pending" && (
                          <button
                            onClick={() => handleAcceptOrder(order.id)}
                            className="w-full py-2.5 bg-accent hover:bg-accent/90 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#D4A017]/10 active:scale-95 transition-all cursor-pointer"
                          >
                            <span>🤝 ACCEPTER & PRENDRE</span>
                            <ChevronRight size={13} />
                          </button>
                        )}

                        {order.assigned_driver_id === driverId && order.delivery_status === "assigned" && (
                          <button
                            onClick={() => handleStartShipping(order.id)}
                            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#C8102E]/10 active:scale-95 transition-all cursor-pointer"
                          >
                            <span>🏍️ COMMENCER LA LIVRAISON</span>
                            <ChevronRight size={13} />
                          </button>
                        )}

                        {order.assigned_driver_id === driverId && order.delivery_status === "shipping" && (
                          <button
                            onClick={() => handleCompleteDelivery(order)}
                            className="w-full py-2.5 bg-[#10B981] hover:bg-[#10B981]/90 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#10B981]/10 active:scale-95 transition-all cursor-pointer"
                          >
                            <span>✅ MARQUER COMME LIVRÉ & PAYÉ</span>
                          </button>
                        )}

                        {order.delivery_status === "delivered" && (
                          <div className="flex items-center gap-1.5 text-[#10B981] bg-[#10B981]/15 px-3.5 py-1.5 rounded-xl border border-[#10B981]/25 text-xs font-mono font-bold">
                            <CheckCircle size={13} />
                            <span>LIVRÉ ET PAYÉ</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-3xl p-6 bg-card/20">
                <Bike className="w-12 h-12 text-[#2A1E15] mb-3" />
                <p className="text-xs font-mono tracking-wider uppercase mb-1">Aucune Commande</p>
                <p className="text-[11px] text-muted-foreground text-center max-w-[240px]">
                  {activeTab === "available" 
                    ? "Aucune commande de livraison disponible pour le moment." 
                    : activeTab === "my-deliveries"
                    ? "Vous n'avez aucune livraison active en cours."
                    : "Votre historique de livraison aujourd'hui est vide."}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
