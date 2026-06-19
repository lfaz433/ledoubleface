import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Package, ShoppingBag, Tv, QrCode, Settings,
  Plus, Trash2, Edit2, Check, X, Bell, TrendingUp, Users, DollarSign,
  Eye, MoreVertical, ChevronDown, AlertCircle, Clock, CheckCircle2,
  GripVertical, ChevronRight, Save, ArrowLeft, RefreshCw, Upload, Award, Bike,
  LogOut
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../../lib/supabase";
import WaiterCallAlert, { usePendingCallsCount } from "./WaiterCallAlert";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { ConfirmButton } from "./ConfirmButton";
import { LiveOrdersQueue } from "./LiveOrdersQueue";
import { toast } from "sonner";

// — TypeScript Interfaces
interface CustomField {
  id: string;
  name: string;
  type: "radio" | "checkbox" | "text";
  options: string[];
  required: boolean;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  desc: string;
  image: string;
  active: boolean;
  customFields: CustomField[];
}

interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  customizations: Record<string, string | string[]>;
}

interface Order {
  id: string;
  table_id: string;
  area: string;
  items: OrderItem[];
  status: "pending" | "preparing" | "ready" | "delivered";
  /** Waiter-granular status from order_status DB column */
  order_status?: string;
  time: string;
  total: number;
  note?: string;
  paid?: boolean;
  /** ISO 8601 timestamp — needed by LiveOrdersQueue elapsed timer */
  created_at?: string;
}


interface RestaurantTable {
  id: string;
  area: string;
  is_terrace: boolean;
  waiter_called: boolean;
  active?: boolean;
}

interface Show {
  id: string;
  title: string;
  description: string;
  date: string;
  price: number;
  image: string;
  available_tickets: number;
}

const STATIC_TABLE_IDS = ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10", "T11", "T12", "T13", "T14", "T15", "T16", "T17", "T18", "T19", "T20"];

type AdminSection = "dashboard" | "products" | "orders" | "tables" | "settings" | "shows" | "counter" | "delivery" | "staff";

export function AdminDashboard({ onLogout, language = "fr" }: { onLogout?: () => void; language?: "fr" | "en" } = {}) {
  const pendingCount = usePendingCallsCount();
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  // Waiter & Staff Management States
  const [waiters, setWaiters] = useState<any[]>([]);
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [newWaiterName, setNewWaiterName] = useState("");
  const [newWaiterEmail, setNewWaiterEmail] = useState("");
  const [newWaiterPin, setNewWaiterPin] = useState("");
  const [newWaiterTables, setNewWaiterTables] = useState("");
  const [waiterSubmitting, setWaiterSubmitting] = useState(false);
  const [waiterError, setWaiterError] = useState<string | null>(null);

  // Edit Waiter States
  const [editingWaiter, setEditingWaiter] = useState<any | null>(null);
  const [editWaiterName, setEditWaiterName] = useState("");
  const [editWaiterEmail, setEditWaiterEmail] = useState("");
  const [editWaiterPin, setEditWaiterPin] = useState("");
  const [editWaiterTables, setEditWaiterTables] = useState("");
  const [editWaiterIsActive, setEditWaiterIsActive] = useState(true);
  const [editWaiterSubmitting, setEditWaiterSubmitting] = useState(false);
  const [editWaiterError, setEditWaiterError] = useState<string | null>(null);

  // Delete Waiter States
  const [deletingWaiter, setDeletingWaiter] = useState<any | null>(null);
  const [deleteWaiterSubmitting, setDeleteWaiterSubmitting] = useState(false);
  const [deleteWaiterError, setDeleteWaiterError] = useState<string | null>(null);

  // KDS / TV Display states
  const [showQRModal, setShowQRModal] = useState(false);

  const isMock = !supabase || supabase.isMock || !supabase.auth;

  const forceReload = async () => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
      } catch (err) {
        console.error("Failed to unregister service worker / clear cache:", err);
      }
    }
    window.location.href = window.location.origin + window.location.pathname + "?t=" + Date.now();
  };

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [liveNotifications, setLiveNotifications] = useState(0);
  const [deliveryNotifications, setDeliveryNotifications] = useState(0);

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

      // Border
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

      // Subtitle separator or small text
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

      // Actual order code (id)
      ctx.fillStyle = "#E5D5C5";
      ctx.font = "bold 20px monospace";
      ctx.fillText(id, canvasWidth / 2, 175);

      // Table or Delivery details
      ctx.fillStyle = "#D4A017";
      ctx.font = "bold 15px monospace";
      const destText = table?.toUpperCase() === "DELIVERY" ? "🛵 LIVRAISON À DOMICILE" : `🍽️ TABLE: ${table}`;
      ctx.fillText(destText, canvasWidth / 2, 210);

      // Draw QR Code frame
      ctx.strokeStyle = "#D4A017";
      ctx.lineWidth = 1;
      // Centered frame for QR: QR is 150x150. Frame is 158x158.
      ctx.strokeRect((canvasWidth - 158) / 2, 235, 158, 158);

      // Draw QR Code Image (centered at 105, 239)
      try {
        ctx.drawImage(qrImg, (canvasWidth - 150) / 2, 239, 150, 150);
      } catch (err) {
        console.error("Failed to draw QR code on canvas:", err);
        // Draw placeholder text if image fails
        ctx.fillStyle = "#C8102E";
        ctx.font = "11px monospace";
        ctx.fillText("QR CODE ERROR", canvasWidth / 2, 315);
      }

      // Footer instruction
      ctx.fillStyle = "#8E7E70";
      ctx.font = "9px monospace";
      ctx.fillText("SCANNABLE PAR L'ADMINISTRATEUR POUR SUIVI", canvasWidth / 2, 420);

      ctx.fillStyle = "#D4A017";
      ctx.font = "italic 11px Georgia, serif";
      ctx.fillText("Merci pour votre confiance !", canvasWidth / 2, 445);

      // Download
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
    qrImg.onerror = () => {
      console.warn("QR code image failed to load, drawing receipt without QR code");
      drawAndDownload();
    };
  };

  // Table Registry & waiter call states
  const [dbTables, setDbTables] = useState<RestaurantTable[]>([]);

  // Coordinates/Preferences states
  const [prefVesselName, setPrefVesselName] = useState("Le Double Face Lounge");
  const [prefAddress, setPrefAddress] = useState("14 Rue du Faubourg Saint-Antoine, Paris");
  const [prefHotline, setPrefHotline] = useState("+33 1 42 74 31 00");
  const [prefOpSlots, setPrefOpSlots] = useState("Mon–Sun 11:30–23:30");
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Shows manager states
  const [shows, setShows] = useState<Show[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [showShowForm, setShowShowForm] = useState(false);
  const [editingShow, setEditingShow] = useState<Show | null>(null);

  // Counter Sale Cart States
  const [counterCart, setCounterCart] = useState<OrderItem[]>([]);
  const [counterNote, setCounterNote] = useState("");
  const [activeCategory, setActiveCategory] = useState("");

  const [heroConfig, setHeroConfig] = useState<any>({
    title1_fr: "Deux Visages.",
    title2_fr: "Une Légende.",
    subtitle_fr: "Saveurs audacieuses rencontrent l'élégance parisienne. Chaque bouchée est un double voyage — l'âme de la rue alliée au savoir-faire gastronomique.",
    title1_en: "Two Faces.",
    title2_en: "One Legend.",
    subtitle_en: "Bold flavors meet Parisian elegance. Every bite is a double experience — street soul with fine dining craft.",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&h=900&fit=crop&auto=format",
    front_image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=750&fit=crop&auto=format",
    logo_image: "",
    show_in_menu: false
  });
  const [uploadingHero, setUploadingHero] = useState(false);

  const loadHeroConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("hero_config")
        .select("*")
        .eq("id", "current")
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        setHeroConfig(data[0]);
        return;
      }
      throw new Error("Empty db");
    } catch (err) {
      console.warn("AdminDashboard: could not load hero configuration from DB, using fallback:", err);
      if (typeof window !== "undefined") {
        const local = localStorage.getItem("ldf_hero_config");
        if (local) {
          try {
            const parsed = JSON.parse(local);
            setHeroConfig(parsed[0]);
          } catch (e) {}
        }
      }
    }
  };

  async function handleSaveHero() {
    try {
      const { error } = await supabase
        .from("hero_config")
        .upsert({
          id: "current",
          ...heroConfig
        });
      if (error) throw error;
      toast.success("Paramètres de la bannière enregistrés avec succès !");
      loadHeroConfig();
    } catch (err) {
      console.error("Failed to save hero config to database, saving to local storage fallback:", err);
      if (typeof window !== "undefined") {
        localStorage.setItem("ldf_hero_config", JSON.stringify([heroConfig]));
        window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: "hero_config" } }));
      }
      toast.success("Enregistré localement avec succès (mode simulation suite à une erreur base de données).");
    }
  }

  const handleHeroImageUpload = (field: "image" | "front_image" | "logo_image") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingHero(true);
    try {
      const isMock = !supabase || supabase.isMock || !supabase.storage || typeof supabase.storage.from !== "function";
      if (isMock) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setHeroConfig((p: any) => ({ ...p, [field]: base64String }));
          setUploadingHero(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const exists = buckets?.some((b: any) => b.name === 'menu-images');
        if (!exists) {
          await supabase.storage.createBucket('menu-images', { public: true, allowedMimeTypes: ['image/*'] });
        }
      } catch (_) {}

      const fileExt = file.name.split('.').pop();
      const fileName = `hero-${field}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      if (data?.publicUrl) {
        setHeroConfig((p: any) => ({ ...p, [field]: data.publicUrl }));
      }
    } catch (err: any) {
      console.warn("Hero Image upload to Supabase failed, falling back to local base64:", err);
      try {
        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setHeroConfig((p: any) => ({ ...p, [field]: base64String }));
      } catch (fallbackErr) {
        console.error("Local image fallback failed:", fallbackErr);
        toast.error(`Impossible de charger l'image localement : ${err.message || err}`);
      }
    } finally {
      setUploadingHero(false);
    }
  };

  // 1. Fetch Orders from Database (Real-time Joined Query)
  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          table_id,
          area,
          status,
          total,
          note,
          paid,
          created_at,
          order_items (
            product_id,
            name,
            price,
            quantity,
            customizations
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      let dbOrders: Order[] = [];
      if (data) {
        dbOrders = data.map((o: any) => {
          const timestamp = new Date(o.created_at);
          const timeString = timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          
          return {
            id: o.id,
            table_id: o.table_id,
            area: o.area,
            status: o.status,
            order_status: o.order_status,
            total: Number(o.total),
            note: o.note,
            paid: o.paid,
            time: timeString,
            created_at: o.created_at,
            items: o.order_items || []
          };
        });
      }

      let localOrders: Order[] = [];
      if (typeof window !== "undefined") {
        try {
          const localRaw = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
          const localItems = JSON.parse(localStorage.getItem("ldf_order_items") || "[]");
          
          localOrders = localRaw.map((o: any) => {
            const timestamp = new Date(o.created_at);
            const timeString = timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return {
              id: o.id,
              table_id: o.table_id,
              area: o.area,
              status: o.status,
              order_status: o.order_status,
              total: Number(o.total),
              note: o.note,
              paid: o.paid,
              time: timeString,
              created_at: o.created_at,
              items: localItems.filter((i: any) => i.order_id === o.id) || []
            };
          });
        } catch (e) {}
      }

      const merged = [...dbOrders];
      localOrders.forEach(lo => {
        if (!merged.some(o => o.id === lo.id)) {
          merged.push(lo);
        }
      });

      setOrders(merged);

    } catch (err) {
      console.warn("Could not load orders from Supabase. Trying offline fallback.", err);
      if (typeof window !== "undefined") {
        try {
          const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
          const localItems = JSON.parse(localStorage.getItem("ldf_order_items") || "[]");
          
          const formatted = localOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((o: any) => {
            const timestamp = new Date(o.created_at);
            const timeString = timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return {
              id: o.id,
              table_id: o.table_id,
              area: o.area,
              status: o.status,
              total: Number(o.total),
              note: o.note,
              paid: o.paid,
              time: timeString,
              items: localItems.filter((i: any) => i.order_id === o.id) || []
            };
          });
          setOrders(formatted);
        } catch (e) {}
      }
      setDbError(true);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Products
  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      let dbProducts: Product[] = [];
      if (data) {
        dbProducts = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: Number(p.price),
          desc: p.desc || "",
          image: p.image || "",
          active: p.active,
          customFields: p.custom_fields || []
        }));
      }

      let localProducts: Product[] = [];
      if (typeof window !== "undefined") {
        try {
          const localRaw = JSON.parse(localStorage.getItem("ldf_menu_items") || "[]");
          localProducts = localRaw.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: Number(p.price),
            desc: p.desc || "",
            image: p.image || "",
            active: p.active,
            customFields: p.custom_fields || []
          }));
        } catch (e) {}
      }

      const merged = [...dbProducts];
      localProducts.forEach(lp => {
        if (!merged.some(p => p.id === lp.id)) {
          merged.push(lp);
        }
      });

      setProducts(merged);
    } catch (err) {
      console.warn("Could not load products from Supabase. Trying local storage fallback.", err);
      if (typeof window !== "undefined") {
        try {
          const localRaw = JSON.parse(localStorage.getItem("ldf_menu_items") || "[]");
          const formatted = localRaw.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: Number(p.price),
            desc: p.desc || "",
            image: p.image || "",
            active: p.active,
            customFields: p.custom_fields || []
          }));
          setProducts(formatted);
        } catch (e) {}
      }
    }
  };

  // 3. Fetch Tables Registry
  const loadTables = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .order("id", { ascending: true });
      if (!error && data) {
        const settingsRow = data.find(t => t.id === "SETTINGS");
        if (settingsRow) {
          try {
            const parsed = JSON.parse(settingsRow.area);
            setPrefVesselName(parsed.vessel_name || "Le Double Face Lounge");
            setPrefAddress(parsed.address || "14 Rue du Faubourg Saint-Antoine, Paris");
            setPrefHotline(parsed.hotline || "+33 1 42 74 31 00");
            setPrefOpSlots(parsed.operation_slots || "Mon–Sun 11:30–23:30");
          } catch (_) {}
        }
        setDbTables(data.filter(t => t.id !== "SETTINGS"));
      }
    } catch (err) {
      console.warn("Could not load tables registry:", err);
    }
  };

  async function handleSavePreferences() {
    setSavingPrefs(true);
    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .upsert({
          id: "SETTINGS",
          area: JSON.stringify({
            vessel_name: prefVesselName,
            address: prefAddress,
            hotline: prefHotline,
            operation_slots: prefOpSlots
          })
        });
      if (error) throw error;
      toast.success("Coordonnées du restaurant enregistrées avec succès !");
      loadTables();
    } catch (err) {
      console.error("Failed to save restaurant preferences:", err);
      toast.error("Erreur lors de l'enregistrement des préférences.");
    } finally {
      setSavingPrefs(false);
    }
  }

  // 4. Fetch Shows & Tickets
  const loadShows = async () => {
    try {
      const { data, error } = await supabase
        .from("shows")
        .select("*")
        .order("date", { ascending: true });
      if (!error && data) {
        setShows(data);
      }
    } catch (err) {
      console.warn("Could not load shows list:", err);
    }
  };

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, shows(title)")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setTickets(data);
      }
    } catch (err) {
      console.warn("Could not load tickets list:", err);
    }
  };

  const loadWaiters = async () => {
    try {
      let data: any[] | null = null;
      let error: any = null;

      if (isMock) {
        data = JSON.parse(localStorage.getItem("ldf_waiters") || "[]");
      } else {
        const response = await supabase
          .from("waiters")
          .select("*")
          .order("created_at", { ascending: false });
        data = response.data;
        error = response.error;
      }
      if (error) throw error;
      if (data) setWaiters(data);
    } catch (err) {
      console.error("Error loading waiters:", err);
    }
  };

  const toggleWaiterActive = async (waiter: any) => {
    const nextActive = !waiter.is_active;
    try {
      if (isMock) {
        const localWaiters = JSON.parse(localStorage.getItem("ldf_waiters") || "[]");
        const updated = localWaiters.map((w: any) => w.id === waiter.id ? { ...w, is_active: nextActive } : w);
        localStorage.setItem("ldf_waiters", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: "waiters" } }));
      } else {
        const { error } = await supabase
          .from("waiters")
          .update({ is_active: nextActive })
          .eq("id", waiter.id);
        if (error) throw error;
      }
      loadWaiters();
    } catch (err) {
      console.error("Failed to toggle waiter status:", err);
    }
  };

  const handleCreateWaiter = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaiterError(null);
    setWaiterSubmitting(true);

    const assigned_tables = newWaiterTables
      .split(",")
      .map(x => x.trim().toUpperCase())
      .filter(x => x.length > 0);

    if (isMock) {
      setTimeout(() => {
        const localWaiters = JSON.parse(localStorage.getItem("ldf_waiters") || "[]");
        const newId = `mock-waiter-${Date.now()}`;
        const newRec = {
          id: newId,
          name: newWaiterName,
          email: newWaiterEmail,
          assigned_tables,
          is_active: true,
          created_at: new Date().toISOString(),
          last_seen: new Date().toISOString()
        };
        localStorage.setItem("ldf_waiters", JSON.stringify([...localWaiters, newRec]));
        setWaiterSubmitting(false);
        setShowWaiterModal(false);
        setNewWaiterName("");
        setNewWaiterEmail("");
        setNewWaiterPin("");
        setNewWaiterTables("");
        loadWaiters();
        window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: "waiters" } }));
      }, 800);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-waiter", {
        body: {
          name: newWaiterName,
          email: newWaiterEmail,
          pin: newWaiterPin,
          assigned_tables
        }
      });

      if (error) throw error;

      if (data?.error) {
        setWaiterError(data.error);
      } else {
        setShowWaiterModal(false);
        setNewWaiterName("");
        setNewWaiterEmail("");
        setNewWaiterPin("");
        setNewWaiterTables("");
        loadWaiters();
      }
    } catch (err: any) {
      setWaiterError(err?.message || "Failed to create waiter.");
    } finally {
      setWaiterSubmitting(false);
    }
  };

  const openEditWaiter = (waiter: any) => {
    setEditingWaiter(waiter);
    setEditWaiterName(waiter.name || "");
    setEditWaiterEmail(waiter.email || "");
    setEditWaiterPin(""); // Keep empty so they don't have to re-enter it unless they want to change it
    setEditWaiterTables(waiter.assigned_tables?.join(", ") || "");
    setEditWaiterIsActive(waiter.is_active !== false);
    setEditWaiterError(null);
  };

  const handleUpdateWaiter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWaiter) return;
    setEditWaiterError(null);
    setEditWaiterSubmitting(true);

    const assigned_tables = editWaiterTables
      .split(",")
      .map(x => x.trim().toUpperCase())
      .filter(x => x.length > 0);

    if (isMock) {
      setTimeout(() => {
        const localWaiters = JSON.parse(localStorage.getItem("ldf_waiters") || "[]");
        const updated = localWaiters.map((w: any) => 
          w.id === editingWaiter.id 
            ? { 
                ...w, 
                name: editWaiterName, 
                email: editWaiterEmail, 
                assigned_tables, 
                is_active: editWaiterIsActive 
              } 
            : w
        );
        localStorage.setItem("ldf_waiters", JSON.stringify(updated));
        setEditWaiterSubmitting(false);
        setEditingWaiter(null);
        setEditWaiterName("");
        setEditWaiterEmail("");
        setEditWaiterPin("");
        setEditWaiterTables("");
        loadWaiters();
        window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: "waiters" } }));
      }, 800);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-waiter", {
        body: {
          action: "update",
          waiter_id: editingWaiter.id,
          name: editWaiterName,
          email: editWaiterEmail,
          pin: editWaiterPin || undefined,
          assigned_tables,
          is_active: editWaiterIsActive
        }
      });

      if (error) throw error;

      if (data?.error) {
        setEditWaiterError(data.error);
      } else {
        setEditingWaiter(null);
        setEditWaiterName("");
        setEditWaiterEmail("");
        setEditWaiterPin("");
        setEditWaiterTables("");
        loadWaiters();
      }
    } catch (err: any) {
      setEditWaiterError(err?.message || "Failed to update waiter.");
    } finally {
      setEditWaiterSubmitting(false);
    }
  };

  const handleDeleteWaiter = async () => {
    if (!deletingWaiter) return;
    setDeleteWaiterError(null);
    setDeleteWaiterSubmitting(true);

    if (isMock) {
      setTimeout(() => {
        const localWaiters = JSON.parse(localStorage.getItem("ldf_waiters") || "[]");
        const updated = localWaiters.filter((w: any) => w.id !== deletingWaiter.id);
        localStorage.setItem("ldf_waiters", JSON.stringify(updated));
        setDeleteWaiterSubmitting(false);
        setDeletingWaiter(null);
        loadWaiters();
        window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: "waiters" } }));
      }, 800);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-waiter", {
        body: {
          action: "delete",
          waiter_id: deletingWaiter.id
        }
      });

      if (error) throw error;

      if (data?.error) {
        setDeleteWaiterError(data.error);
      } else {
        setDeletingWaiter(null);
        loadWaiters();
      }
    } catch (err: any) {
      setDeleteWaiterError(err?.message || "Failed to delete waiter.");
    } finally {
      setDeleteWaiterSubmitting(false);
    }
  };

  useEffect(() => {
    const liveCount = orders.filter((o: any) => o.status === "pending" && o.table_id?.toUpperCase() !== "DELIVERY").length;
    const deliveryCount = orders.filter((o: any) => o.status === "pending" && o.table_id?.toUpperCase() === "DELIVERY").length;
    setLiveNotifications(liveCount);
    setDeliveryNotifications(deliveryCount);
  }, [orders]);

  useEffect(() => {
    loadOrders();
    loadProducts();
    loadTables();
    loadShows();
    loadTickets();
    loadHeroConfig();
    loadWaiters();

    // Subscribe to waiters table in real-time
    const waitersChannel = supabase
      .channel("waiters-admin-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waiters" },
        () => {
          loadWaiters();
        }
      )
      .subscribe();

    // Subscribe to orders changes in real-time
    const ordersChannel = supabase
      .channel("orders-admin-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    // Subscribe to table update events (waiter calls)
    const tablesChannel = supabase
      .channel("tables-admin-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurant_tables" },
        () => {
          loadTables();
        }
      )
      .subscribe();

    // Subscribe to hero configuration changes
    const heroChannel = supabase
      .channel("hero-admin-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hero_config" },
        () => {
          loadHeroConfig();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(heroChannel);
      supabase.removeChannel(waitersChannel);
    };
  }, []);

  // Pipeline advance actions (Pending -> Preparing -> Ready -> Delivered)
  async function advanceOrder(id: string, currentStatus: Order["status"]) {
    const statusSequence: Order["status"][] = ["pending", "preparing", "ready", "delivered"];
    const currentIndex = statusSequence.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex === 3) return;
    
    const nextStatus = statusSequence[currentIndex + 1];

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", id);

      if (error) throw error;
      loadOrders();
    } catch (err) {
      console.error("Failed to advance order:", err);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: nextStatus } : o));
    }
  }

  // Reset/Payment action
  async function markOrderPaid(id: string) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ paid: true })
        .eq("id", id);

      if (error) throw error;
      loadOrders();
    } catch (err) {
      console.error("Failed to mark order as paid:", err);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, paid: true } : o));
    }
  }

  // Dismiss Waiter Call
  async function dismissWaiterCall(tableId: string) {
    setDbTables(prev => prev.map(t => t.id === tableId ? { ...t, waiter_called: false } : t));
    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ waiter_called: false })
        .eq("id", tableId);
      if (error) throw error;
    } catch (err) {
      console.warn("Could not dismiss waiter call in DB:", err);
    }
  }

  // Toggle Terrace status
  async function toggleTerrace(tableId: string, currentVal: boolean) {
    const newVal = !currentVal;
    const newArea = newVal ? "Terrace Patio" : "Inside Lounge";
    
    setDbTables(prev => prev.map(t => t.id === tableId ? { ...t, is_terrace: newVal, area: newArea } : t));
    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ is_terrace: newVal, area: newArea })
        .eq("id", tableId);
      if (error) throw error;
    } catch (err) {
      console.warn("Could not toggle terrace status in DB:", err);
    }
  }

  async function turnOffAllTerrace() {
    const terraceTableIds = dbTables.filter(t => t.is_terrace).map(t => t.id);
    if (terraceTableIds.length === 0) return;

    try {
      const { error } = await supabase.from("restaurant_tables").update({ active: false }).in("id", terraceTableIds);
      if (error) throw error;
      setDbTables(prev => prev.map(t => t.is_terrace ? { ...t, active: false } : t));
      toast.success("Terrasse désactivée avec succès !");
    } catch (err) {
      console.warn("Offline fallback for turning off terrace", err);
      setDbTables(prev => prev.map(t => t.is_terrace ? { ...t, active: false } : t));
    }
  }

  // Print counter sale invoice/receipt
  const printCounterInvoice = (orderId: string, total: number, items: any[], note: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 6px 0; font-family: monospace; font-size: 11px;">${item.name} x${item.quantity}</td>
        <td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 11px;">€${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join("");

    const dateStr = new Date().toLocaleString("fr-FR");

    printWindow.document.write(`
      <html>
        <head>
          <title>Facture #${orderId}</title>
          <style>
            @media print {
              body { margin: 0; padding: 5mm; }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              color: #000;
              background-color: #fff;
              width: 76mm;
              margin: 0 auto;
              padding: 15px;
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              margin-bottom: 12px;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }
            .total {
              font-size: 14px;
              font-weight: bold;
              display: flex;
              justify-content: space-between;
              margin-top: 8px;
            }
            .item-table {
              width: 100%;
              border-collapse: collapse;
            }
            .footer {
              text-align: center;
              font-size: 9px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h3 style="margin: 0 0 4px 0; font-family: sans-serif; font-weight: 900; letter-spacing: 0.5px;">LE DOUBLE FACE</h3>
            <div style="font-size: 9px;">14 RUE DU FAUBOURG SAINT-ANTOINE</div>
            <div style="font-size: 9px;">75011 PARIS · TÉL: 01 43 24 56 78</div>
          </div>
          <div class="divider"></div>
          <div style="font-size: 10px; margin-bottom: 8px;">
            <div>DATE: ${dateStr}</div>
            <div>TICKET: ${orderId}</div>
            <div>CAISSIER: Admin</div>
            <div>MODE: Au Comptoir</div>
          </div>
          <div class="divider"></div>
          <table class="item-table">
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="divider"></div>
          ${note ? `<div style="font-size: 9px; font-style: italic; margin-bottom: 8px;">Note: ${note}</div><div class="divider"></div>` : ""}
          <div class="total">
            <span>TOTAL:</span>
            <span>€${total.toFixed(2)}</span>
          </div>
          <div style="font-size: 10px; font-weight: bold; text-align: center; margin-top: 12px; border: 1px solid #000; padding: 4px;">
            RÈGLEMENT COMPTOIR - PAYÉ
          </div>
          <div class="footer">
            <p style="margin: 3px 0;">MERCI DE VOTRE VISITE !</p>
            <p style="margin: 3px 0; font-family: sans-serif; font-size: 7px; letter-spacing: 0.5px;">EST. 2019 · PARIS</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Process counter checkout sale
  async function handleCounterCheckout() {
    if (counterCart.length === 0) {
      toast.error("Votre panier est vide.");
      return;
    }

    const orderId = `ORD-CPT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const cartTotal = counterCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    try {
      const { error: orderError } = await supabase
        .from("orders")
        .insert({
          id: orderId,
          table_id: "Comptoir",
          area: "Counter",
          status: "delivered",
          total: cartTotal,
          note: counterNote || null,
          paid: true,
          invoice_no: orderId
        });

      if (orderError) throw orderError;

      const lineItems = counterCart.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        customizations: item.customizations || {}
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(lineItems);

      if (itemsError) throw itemsError;
      toast.success("Vente enregistrée avec succès !", {
        description: "Imprimez le ticket si nécessaire.",
        action: {
          label: "Imprimer 🖨️",
          onClick: () => printCounterInvoice(orderId, cartTotal, lineItems, counterNote)
        },
        duration: 8000
      });
      setCounterCart([]);
      setCounterNote("");
      loadOrders();
    } catch (err) {
      console.error("Counter checkout failed:", err);
      const simulatedItems = counterCart.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        customizations: item.customizations || {}
      }));
      toast.success("Ticket enregistré en mode simulation hors-ligne.", {
        description: "Imprimez le ticket de simulation si nécessaire.",
        action: {
          label: "Imprimer 🖨️",
          onClick: () => printCounterInvoice(orderId, cartTotal, simulatedItems, counterNote)
        },
        duration: 8000
      });
      setCounterCart([]);
      setCounterNote("");
    }
  }

  // Print QR Template
  const printQrCode = (tableId: string, area: string) => {
    const tableUrl = `${window.location.origin}/?view=order&table=${tableId}&area=${encodeURIComponent(area)}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableUrl)}`;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code - Table ${tableId}</title>
          <style>
            body {
              font-family: 'Playfair Display', serif;
              background-color: #ffffff;
              color: #0A0704;
              text-align: center;
              margin: 0;
              padding: 40px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 90vh;
            }
            .qr-container {
              border: 4px double #C8102E;
              padding: 40px;
              border-radius: 15px;
              max-width: 400px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .logo {
              font-size: 28px;
              font-weight: 900;
              color: #C8102E;
              margin-bottom: 5px;
            }
            .restaurant-name {
              font-size: 22px;
              font-weight: 700;
              margin-bottom: 25px;
              letter-spacing: 1px;
            }
            .qr-image {
              width: 250px;
              height: 250px;
              margin-bottom: 25px;
            }
            .table-id {
              font-size: 36px;
              font-weight: 900;
              margin-bottom: 10px;
              letter-spacing: -0.5px;
            }
            .area {
              font-size: 14px;
              color: #8E7E70;
              margin-bottom: 15px;
              text-transform: uppercase;
              font-family: monospace;
            }
            .instruction {
              font-size: 12px;
              color: #555;
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="logo">LF</div>
            <div class="restaurant-name">LE DOUBLE FACE</div>
            <img class="qr-image" src="${qrImageUrl}" alt="Table QR" />
            <div class="table-id">TABLE ${tableId}</div>
            <div class="area">${area}</div>
            <div class="instruction">Scan to order drinks, dishes & request waiter service</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const downloadQrCode = (tableId: string, area: string) => {
    const tableUrl = `${window.location.origin}/?view=order&table=${tableId}&area=${encodeURIComponent(area)}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableUrl)}`;
    
    const link = document.createElement("a");
    link.href = qrImageUrl;
    link.target = "_blank";
    link.download = `QR_Table_${tableId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CMS Product Actions
  async function handleSaveProduct(p: Product) {
    try {
      const { error } = await supabase
        .from("menu_items")
        .upsert({
          id: p.id,
          name: p.name,
          category: p.category,
          price: p.price,
          desc: p.desc,
          image: p.image,
          active: p.active,
          custom_fields: p.customFields
        });

      if (error) throw error;
      loadProducts();
      setShowProductForm(false);
    } catch (err) {
      console.error("Failed to save product:", err);
      setProducts(prev => {
        const exists = prev.some(x => x.id === p.id);
        if (exists) return prev.map(x => x.id === p.id ? p : x);
        return [...prev, p];
      });
      setShowProductForm(false);
    }
  }

  async function handleDeleteProduct(id: string) {
    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      loadProducts();
      toast.success("Produit supprimé avec succès !");
    } catch (err) {
      console.error("Failed to delete product:", err);
      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success("Produit supprimé localement (mode simulation).");
    }
  }

  async function handleToggleActive(p: Product) {
    try {
      const { error } = await supabase
        .from("menu_items")
        .update({ active: !p.active })
        .eq("id", p.id);

      if (error) throw error;
      loadProducts();
    } catch (err) {
      console.error("Failed to toggle active state:", err);
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, active: !x.active } : x));
    }
  }

  async function addTable(isTerrace: boolean) {
    const nextNum = tablesToRender.length + 1;
    const newId = `T${nextNum.toString().padStart(2, "0")}`;
    const newTable = {
      id: newId,
      area: isTerrace ? "La Terrasse" : "Le Salon Intérieur",
      is_terrace: isTerrace,
      waiter_called: false,
      active: true
    };

    try {
      const { error } = await supabase.from("restaurant_tables").insert(newTable);
      if (error) throw error;
      setDbTables(prev => {
        const next = [...prev, newTable];
        if (typeof window !== "undefined") localStorage.setItem("ldf_restaurant_tables", JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.warn("Offline: adding table to local storage", err);
      setDbTables(prev => {
        const next = [...prev, newTable];
        if (typeof window !== "undefined") localStorage.setItem("ldf_restaurant_tables", JSON.stringify(next));
        return next;
      });
    }
  }

  async function deleteTable(id: string) {
    try {
      const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
      if (error) throw error;
      setDbTables(prev => {
        const next = prev.filter(t => t.id !== id);
        if (typeof window !== "undefined") localStorage.setItem("ldf_restaurant_tables", JSON.stringify(next));
        return next;
      });
      toast.success("Table supprimée avec succès !");
    } catch (err) {
      console.warn("Offline: deleting table from local storage", err);
      setDbTables(prev => {
        const next = prev.filter(t => t.id !== id);
        if (typeof window !== "undefined") localStorage.setItem("ldf_restaurant_tables", JSON.stringify(next));
        return next;
      });
      toast.success("Table supprimée localement (mode simulation).");
    }
  }

  // Shows manager actions
  async function saveShow() {
    if (!editingShow) return;
    try {
      const isNew = !editingShow.id;
      const payload: any = {
        title: editingShow.title,
        description: editingShow.description,
        date: editingShow.date,
        price: editingShow.price,
        image: editingShow.image,
        available_tickets: editingShow.available_tickets
      };
      if (editingShow.id) {
        payload.id = editingShow.id;
      }
      
      const { error } = await supabase
        .from("shows")
        .upsert(payload);

      if (error) throw error;
      loadShows();
      setShowShowForm(false);
    } catch (err) {
      console.error("Failed to save show:", err);
      // fallback
      setShows(prev => {
        if (!editingShow.id) {
          const item = { ...editingShow, id: `S-${Date.now()}` };
          return [...prev, item];
        }
        return prev.map(s => s.id === editingShow.id ? editingShow : s);
      });
      setShowShowForm(false);
    }
  }

  async function clearRevenue() {
    try {
      const deliveredIds = orders.filter(o => o.status === "delivered").map(o => o.id);
      if (deliveredIds.length === 0) {
        toast.error("Aucune commande livrée à effacer.");
        return;
      }
      const { error } = await supabase.from("orders").delete().in("id", deliveredIds);
      if (error) throw error;
      setOrders(prev => prev.filter(o => o.status !== "delivered"));
      toast.success("Historique des commandes livrées effacé !");
    } catch (err) {
      console.warn("Offline: clearing local delivered orders", err);
      if (typeof window !== "undefined") {
        const local = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const next = local.filter((o: any) => o.status !== "delivered");
        localStorage.setItem("ldf_orders", JSON.stringify(next));
        setOrders(prev => prev.filter(o => o.status !== "delivered"));
      }
      toast.success("Commandes effacées localement (simulation).");
    }
  }

  async function deleteShow(id: string) {
    try {
      const { error } = await supabase
        .from("shows")
        .delete()
        .eq("id", id);
      if (error) throw error;
      loadShows();
      toast.success("Spectacle supprimé avec succès !");
    } catch (err) {
      console.error("Failed to delete show:", err);
      setShows(prev => prev.filter(s => s.id !== id));
      toast.success("Spectacle supprimé localement (simulation).");
    }
  }

  // Calculations
  const completedOrders = orders.filter(o => o.status === "delivered");
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const activeOrdersCount = orders.filter(o => o.status !== "delivered").length;
  
  const activeWaiterCalls = dbTables.filter(t => t.waiter_called);

  const tablesToRender = dbTables.length > 0 ? dbTables : STATIC_TABLE_IDS.map(id => ({
    id,
    area: id >= "T11" ? "Terrace Patio" : "Inside Lounge",
    is_terrace: id >= "T11",
    waiter_called: false,
    active: true
  }));

  const REVENUE_DATA = [
    { day: "Mon", revenue: 1240 }, { day: "Tue", revenue: 980 }, { day: "Wed", revenue: 1650 },
    { day: "Thu", revenue: 1320 }, { day: "Fri", revenue: 2100 }, { day: "Sat", revenue: 2850 },
    { day: "Sun", revenue: totalRevenue > 0 ? Math.round(totalRevenue) : 2200 },
  ];

  const statusColors: Record<Order["status"], string> = {
    pending: "#F59E0B", preparing: "#C8102E", ready: "#10B981", delivered: "#8E7E70"
  };
  const statusLabels: Record<Order["status"], string> = {
    pending: "PENDING", preparing: "PREPARING", ready: "READY", delivered: "DELIVERED"
  };

  const navItems = [
    { id: "dashboard" as AdminSection, icon: <LayoutDashboard size={16} />, label: "Dashboard" },
    { id: "orders" as AdminSection, icon: <ShoppingBag size={16} />, label: "Live Orders Queue", badge: liveNotifications },
    { id: "delivery" as AdminSection, icon: <Bike size={16} />, label: "Delivery", badge: deliveryNotifications },
    { id: "counter" as AdminSection, icon: <DollarSign size={16} />, label: "Vente au Comptoir" },
    { id: "products" as AdminSection, icon: <Package size={16} />, label: "Menu Forge (CMS)" },
    { id: "tables" as AdminSection, icon: <QrCode size={16} />, label: "Table Registry & QR" },
    { id: "shows" as AdminSection, icon: <Award size={16} />, label: "Shows Manager" },
    { id: "staff" as AdminSection, icon: <Users size={16} />, label: "Staff (Équipe)" },
    { id: "settings" as AdminSection, icon: <Settings size={16} />, label: "Preferences" },
  ];

  // ── Mobile nav state ──────────────────────────────────────────────────────
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#0A0704] text-[#8E7E70] p-6">
        <div className="relative w-12 h-12 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-t-[#C8102E] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-xs font-mono tracking-widest animate-pulse">LOADING WORKSPACE...</p>
      </div>
    );
  }

  const NavContent = () => (
    <>
      <div className="px-4 py-4 border-b border-[#2A1E15] flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-[#C8102E] flex items-center justify-center font-serif font-black text-xs text-white">L</div>
        <div>
          <div className="font-serif font-bold text-xs">Le Double Face</div>
          <div className="font-mono text-[8px] text-[#8E7E70] tracking-widest">KITCHEN WORKSPACE</div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4 flex flex-col gap-1 overflow-y-auto">
        {navItems.map(item => {
          const active = section === item.id;
          return (
            <button key={item.id} onClick={() => { setSection(item.id); closeNav(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left rounded text-xs transition-all relative border cursor-pointer"
              style={{
                background: active ? "rgba(200,16,46,0.12)" : "transparent",
                borderColor: active ? "rgba(200,16,46,0.2)" : "transparent",
                color: active ? "#fff" : "#8E7E70",
                fontWeight: active ? 700 : 500,
              }}>
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="bg-[#C8102E] text-white font-mono font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>
      {onLogout && (
        <div className="p-3 border-t border-[#2A1E15]">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded text-xs transition-all text-[#8E7E70] hover:text-white hover:bg-white/5 border border-transparent cursor-pointer"
          >
            <LogOut size={16} className="text-[#C8102E]" />
            <span className="font-mono uppercase tracking-wider text-[10px]">Log Out</span>
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-full bg-[#0A0704] text-white relative">

      {/* ── Desktop Sidebar (md+) ─────────────────────────────── */}
      <div className="hidden md:flex w-56 flex-shrink-0 flex-col bg-[#120D09] border-r border-[#2A1E15]">
        <NavContent />
      </div>

      {/* ── Mobile Drawer Overlay ─────────────────────────────── */}
      {navOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          onClick={closeNav}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          {/* Drawer */}
          <div
            className="relative z-10 w-64 max-w-[80vw] flex flex-col bg-[#120D09] border-r border-[#2A1E15] h-full"
            onClick={e => e.stopPropagation()}
          >
            <NavContent />
          </div>
        </div>
      )}

      {/* ── Main Panel Content ────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="px-4 md:px-6 py-3 md:py-4 bg-[#120D09] border-b border-[#2A1E15] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setNavOpen(o => !o)}
              className="md:hidden flex-shrink-0 p-1.5 rounded border border-[#2A1E15] bg-[#1A130E] text-[#E5D5C5] cursor-pointer active:scale-95 transition-all"
              aria-label="Open navigation"
            >
              <span className="block w-4 h-0.5 bg-current mb-1" />
              <span className="block w-4 h-0.5 bg-current mb-1" />
              <span className="block w-4 h-0.5 bg-current" />
            </button>

            <span className="text-[#8E7E70] font-mono text-[10px] md:text-xs uppercase tracking-widest truncate">{section}</span>
            {pendingCount > 0 && (
              <span className="bg-[#C8102E] text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full animate-pulse flex-shrink-0">
                {pendingCount}
              </span>
            )}

            {/* Kitchen / Board shortcuts — icon-only on mobile */}
            <button
              onClick={() => window.open("?view=kitchen", "_blank")}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#1A130E] border border-[#2A1E15] hover:bg-white/5 hover:border-[#C8102E]/40 text-[#E5D5C5] rounded text-[9.5px] font-mono font-bold transition-all cursor-pointer"
              title="Kitchen Screen"
            >
              🍳 <span className="hidden lg:inline">KITCHEN SCREEN</span>
            </button>
            <button
              onClick={() => setShowQRModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#1A130E] border border-[#2A1E15] hover:bg-white/5 hover:border-[#C8102E]/40 text-[#E5D5C5] rounded text-[9.5px] font-mono font-bold transition-all cursor-pointer"
              title="Customer Board"
            >
              📺 <span className="hidden lg:inline">CUSTOMER BOARD</span>
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs font-mono flex-shrink-0">
            {/* DB status dot — always visible */}
            {(!supabase || supabase.isMock || dbError) ? (
              <span className="flex items-center gap-1 font-bold text-[#EF4444]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                <span className="hidden sm:inline">OFFLINE</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-[#10B981]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span className="hidden sm:inline">ONLINE</span>
              </span>
            )}
            <button
              onClick={forceReload}
              className="px-2 py-1 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 text-[#E5D5C5] rounded text-[9px] font-mono transition-all cursor-pointer"
              title="Refresh"
            >
              🔄
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {dbError && (
            <div className="mb-6 p-4 bg-red-950/20 border border-[#C8102E]/30 rounded-lg text-xs text-[#8E7E70] flex items-center gap-2">
              <AlertCircle size={14} className="text-[#C8102E]" />
              <span>Warning: Could not sync from Supabase. Running in isolated fallback simulation.</span>
            </div>
          )}

          {/* 1. DASHBOARD OVERVIEW */}
          {section === "dashboard" && (
            <div className="flex flex-col gap-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "DELIVERED REVENUE (TODAY)", value: `€${totalRevenue.toFixed(2)}`, trend: "+12.4% vs yesterday", icon: <DollarSign size={18} className="text-[#10B981]" /> },
                  { label: "ACTIVE TICKETS IN PIPELINE", value: String(activeOrdersCount), trend: "Live kitchen load", icon: <ShoppingBag size={18} className="text-[#C8102E]" /> },
                  { label: "TABLE OCCUPANCY / COUNT", value: `${orders.filter(o => o.status !== "delivered").map(o => o.table_id).filter((v, i, a) => a.indexOf(v) === i).length} / 12`, trend: "Active guest sessions", icon: <Users size={18} className="text-[#8E7E70]" /> },
                ].map(stat => (
                  <div key={stat.label} className="p-4 bg-[#120D09] border border-[#2A1E15] rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-mono tracking-widest text-[#8E7E70] uppercase mb-1">{stat.label}</div>
                      <div className="text-xl font-bold font-serif mb-1">{stat.value}</div>
                      <div className="text-[9px] font-mono text-[#8E7E70]">{stat.trend}</div>
                    </div>
                    <div className="w-10 h-10 rounded bg-[#1A130E] border border-[#2A1E15] flex items-center justify-center">{stat.icon}</div>
                  </div>
                ))}
              </div>

              {/* Chart & Queue summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-5 bg-[#120D09] border border-[#2A1E15] rounded-xl">
                  <h4 className="text-xs font-mono tracking-widest text-[#8E7E70] mb-4 uppercase">Weekly Revenue Projection</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={REVENUE_DATA}>
                        <XAxis dataKey="day" stroke="#8E7E70" fontSize={10} tickLine={false} />
                        <YAxis stroke="#8E7E70" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: "#120D09", borderColor: "#2A1E15", fontSize: "11px", color: "#fff" }} />
                        <Bar dataKey="revenue" fill="#C8102E" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="p-5 bg-[#120D09] border border-[#2A1E15] rounded-xl">
                  <h4 className="text-xs font-mono tracking-widest text-[#8E7E70] mb-4 uppercase">Recent activity log</h4>
                  <div className="flex flex-col gap-3.5 max-h-64 overflow-y-auto pr-1">
                    {orders.slice(0, 5).map(o => (
                      <div key={o.id} className="flex items-start gap-3 text-xs border-b border-[#2A1E15]/30 pb-3 last:border-0 last:pb-0">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: statusColors[o.status] }} />
                        <div className="flex-1">
                          <div className="flex justify-between font-bold text-white mb-0.5">
                            <span>Ticket {o.id}</span>
                            <span className="text-[9px] font-mono text-[#8E7E70]">{o.time}</span>
                          </div>
                          <div className="text-[10px] text-[#8E7E70] font-mono">
                            Table {o.table_id} · {o.items.length} items · €{o.total.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {orders.length === 0 && (
                      <div className="text-center py-12 text-[#8E7E70] text-xs">No orders logged today.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. LIVE ORDERS PIPELINE — redesigned 3-step kanban */}
          {section === "orders" && (
            <LiveOrdersQueue
              orders={orders}
              setOrders={setOrders}
              language={language}
              downloadInvoicePNG={downloadInvoicePNG}
            />
          )}

          {/* 2.5 DELIVERY PIPELINE */}
          {section === "delivery" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {(["pending", "preparing", "ready", "delivered"] as const).map(stage => {
                  const stageOrders = orders.filter(o => o.status === stage && o.table_id?.toUpperCase() === "DELIVERY");
                  return (
                    <div key={stage} className="flex flex-col min-h-[500px] bg-[#120D09]/50 border border-[#2A1E15]/60 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-4 border-b border-[#2A1E15]/30 pb-3">
                        <h3 className="font-mono text-xs font-bold tracking-widest text-[#E5D5C5] uppercase">{statusLabels[stage] || stage}</h3>
                        <span className="bg-[#1A130E] text-[#8E7E70] text-[10px] px-2 py-0.5 rounded font-mono">
                          {stageOrders.length}
                        </span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {stageOrders.map(order => (
                          <div key={order.id} className="bg-[#1A130E] border border-[#2A1E15] rounded-lg p-3 hover:border-[#C8102E]/30 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[#C8102E] font-bold text-sm tracking-wider">#{order.id.slice(-6)}</span>
                                <OrderStatusBadge
                                  orderId={order.id}
                                  currentStatus={order.order_status || order.status}
                                  onStatusChange={loadOrders}
                                />
                              </div>
                              <span className="text-[#8E7E70] text-[10px] font-mono">{order.time}</span>
                            </div>
                            
                            <div className="mb-3">
                              <span className="text-white text-[11px] font-bold block mb-1">DELIVERY</span>
                              <p className="text-[#8E7E70] text-[9px] uppercase tracking-wide">
                                Total: €{order.total.toFixed(2)} | {order.paid ? <span className="text-[#10B981]">PAID</span> : <span className="text-[#F59E0B]">UNPAID</span>}
                              </p>
                            </div>

                            <div className="space-y-1.5 mb-3 border-t border-[#2A1E15]/30 pt-3">
                              {order.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-[11px]">
                                  <span className="text-[#E5D5C5]">{item.quantity}x {item.name}</span>
                                  <span className="text-[#8E7E70]">€{(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>

                            {order.note && (
                              <div className="mb-3 p-2 bg-[#120D09] rounded text-[10px] text-[#C8102E] border border-[#C8102E]/20 whitespace-pre-wrap">
                                {order.note}
                              </div>
                            )}

                            <div className="flex gap-2 mt-2">
                              <button onClick={() => downloadInvoicePNG(order)}
                                className="flex-1 py-1.5 bg-[#D4A017] text-[#0A0704] font-bold rounded text-[10px] cursor-pointer">
                                RECEIPT
                              </button>
                              {stage !== "delivered" && (
                                <button onClick={() => advanceOrder(order.id, order.status)}
                                  className="flex-1 py-1.5 bg-[#C8102E] hover:opacity-95 text-white font-bold rounded text-[10px] cursor-pointer">
                                  {stage === "pending" ? "PREPARE" : stage === "preparing" ? "READY" : "DELIVER"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. MENU FORGE (CMS) */}
          {section === "products" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-black text-lg text-white">Product Catalog Matrix</h3>
                  <p className="text-xs text-[#8E7E70] mt-1 font-mono">Add new products, adjust base prices, or customize option builders.</p>
                </div>
                {!showProductForm && (
                  <button
                    onClick={() => {
                      setEditingProduct({ id: `P${Date.now()}`, name: "", category: "Burgers", price: 0, desc: "", image: "", active: true, customFields: [] });
                      setShowProductForm(true);
                    }}
                    className="bg-[#C8102E] hover:opacity-90 text-white font-bold py-2 px-4 rounded text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} /> FORGE NEW ITEM
                  </button>
                )}
              </div>

              {showProductForm && editingProduct && (
                <div className="max-w-3xl mb-6">
                  <ProductForm
                    product={editingProduct}
                    onSave={handleSaveProduct}
                    onCancel={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                  />
                </div>
              )}

              {/* Products Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(p => (
                  <div key={p.id} className="p-4 bg-[#120D09] border border-[#2A1E15] rounded-xl flex gap-3.5 items-start">
                    <div className="w-16 h-16 rounded overflow-hidden bg-[#1A130E] border border-[#2A1E15] flex-shrink-0">
                      {p.image && <img src={p.image} alt={p.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-serif font-bold text-sm text-white">{p.name}</h4>
                          <span className="font-mono text-xs font-bold text-[#C8102E]">€{p.price.toFixed(2)}</span>
                        </div>
                        <p className="text-[10px] text-[#8E7E70] line-clamp-2 mt-1 leading-snug">{p.desc}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="bg-[#1A130E] border border-[#2A1E15] text-[#8E7E70] text-[9px] font-mono px-2 py-0.5 rounded uppercase">{p.category}</span>
                          <span className="text-[9px] font-mono text-[#8E7E70]">
                            {p.customFields.length} options
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#2A1E15]/30 pt-2 mt-3.5">
                        <button onClick={() => handleToggleActive(p)}
                          className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider cursor-pointer border ${
                            p.active ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30" : "bg-[#1A130E] text-[#8E7E70] border-[#2A1E15]"
                          }`}>
                          {p.active ? "ACTIVE" : "DRAFT"}
                        </button>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            setEditingProduct(p);
                            setShowProductForm(true);
                          }}
                            className="p-1 border border-[#2A1E15] hover:bg-[#1A130E] rounded text-white cursor-pointer">
                            <Edit2 size={12} />
                          </button>
                          <ConfirmButton
                            label={<Trash2 size={12} />}
                            onConfirm={() => handleDeleteProduct(p.id)}
                            confirmLabel="Oui"
                            cancelLabel="Non"
                            className="p-1 border border-[#2A1E15] hover:bg-red-950/20 text-[#C8102E] rounded cursor-pointer"
                            confirmClassName="px-2 py-0.5 bg-[#C8102E] text-white text-[10px] font-bold rounded"
                            cancelClassName="px-2 py-0.5 bg-transparent border border-[#2A1E15] text-[#8E7E70] text-[10px] font-bold rounded"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. TABLES AND QR MATRIX */}
          {/* 4. TABLES AND QR MATRIX */}
          {section === "tables" && (
            <div>
              <p className="text-xs text-[#8E7E70] mb-5 font-mono leading-relaxed">
                Scan tabletop QR codes or click them to test guest ordering context in a new window. Active orders light up in red.
              </p>

              {/* Le Salon Intérieur */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#2A1E15]/30">
                  <h3 className="text-xs font-mono tracking-widest text-[#C8102E] uppercase font-bold flex items-center gap-2">
                    🛋️ Le Salon Intérieur ({tablesToRender.filter(t => !t.is_terrace).length})
                  </h3>
                  <button onClick={() => addTable(false)}
                    className="bg-[#C8102E] hover:opacity-90 text-white font-bold py-1.5 px-3 rounded text-[10px] flex items-center gap-1 cursor-pointer">
                    <Plus size={12} /> ADD TABLE
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {tablesToRender.filter(t => !t.is_terrace).map(table => {
                    const activeOrder = orders.find(o => o.table_id === table.id && o.status !== "delivered");
                    const tableUrl = `${window.location.origin}/?view=order&table=${table.id}&area=${encodeURIComponent(table.area)}`;
                    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tableUrl)}`;
                    
                    return (
                      <div key={table.id} className="p-4 bg-[#120D09] border rounded text-center transition-all flex flex-col justify-between"
                        style={{ borderColor: activeOrder ? "#C8102E" : table.waiter_called ? "#F59E0B" : "#2A1E15" }}>
                        
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-serif font-black text-base text-white">{table.id}</span>
                            <span className="text-[9px] text-[#8E7E70] font-mono uppercase">{table.area}</span>
                          </div>
                          
                          {/* Scannable & Clickable QR Code */}
                          <a
                            href={tableUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-16 h-16 mx-auto mb-3 bg-white p-1 rounded overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                            title="Click to open menu for this table in a new tab"
                          >
                            <img
                              src={qrImageUrl}
                              alt={`QR Code for ${table.id}`}
                              className="w-full h-full object-contain"
                            />
                          </a>

                          <div className="font-mono text-[9px] font-bold" style={{ color: activeOrder ? statusColors[activeOrder.status] : table.waiter_called ? "#F59E0B" : "#8E7E70" }}>
                            {table.waiter_called ? "🛎️ WAITER CALLED" : activeOrder ? statusLabels[activeOrder.status] : "VACANT"}
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-2.5 border-t border-[#2A1E15]/30">
                          {/* La Terrasse Toggle button */}
                          <div className="flex items-center justify-between text-[10px] mb-2 font-mono">
                            <span className="text-[#8E7E70]">La Terrasse:</span>
                            <button
                              onClick={() => toggleTerrace(table.id, table.is_terrace)}
                              className="w-7 h-4 relative rounded-full transition-all border cursor-pointer"
                              style={{ background: table.is_terrace ? "#C8102E" : "#1A130E", borderColor: table.is_terrace ? "#C8102E" : "#2A1E15" }}
                            >
                              <div className="absolute top-[1px] w-2.5 h-2.5 rounded-full bg-white transition-all"
                                style={{ left: table.is_terrace ? "13px" : "1px" }} />
                            </button>
                          </div>
                          
                          <div className="flex gap-1">
                            <button
                              onClick={() => printQrCode(table.id, table.area)}
                              className="flex-1 py-1 border border-[#2A1E15] hover:bg-[#1A130E] text-white rounded text-[8px] font-bold cursor-pointer"
                            >
                              PRINT
                            </button>
                            <button
                              onClick={() => downloadQrCode(table.id, table.area)}
                              className="flex-1 py-1 border border-[#2A1E15] hover:bg-[#1A130E] text-[#8E7E70] hover:text-white rounded text-[8px] font-bold cursor-pointer"
                            >
                              DL
                            </button>
                            <ConfirmButton
                              label="DEL"
                              onConfirm={() => deleteTable(table.id)}
                              confirmLabel="Oui"
                              cancelLabel="Non"
                              className="flex-1 py-1 border border-[#2A1E15] hover:bg-red-950/20 text-[#C8102E] rounded text-[8px] font-bold cursor-pointer text-center"
                              confirmClassName="px-2 py-0.5 bg-[#C8102E] text-white text-[9px] font-bold rounded"
                              cancelClassName="px-2 py-0.5 bg-transparent border border-[#2A1E15] text-[#8E7E70] text-[9px] font-bold rounded"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* La Terrasse */}
              <div>
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#2A1E15]/30">
                  <h3 className="text-xs font-mono tracking-widest text-[#C8102E] uppercase font-bold flex items-center gap-2">
                    ☀️ La Terrasse ({tablesToRender.filter(t => t.is_terrace).length})
                  </h3>
                  <div className="flex gap-2">
                    {tablesToRender.filter(t => t.is_terrace).length > 0 && (
                      <ConfirmButton
                        label={
                          <span className="flex items-center gap-1">
                            <X size={10} /> Désactiver
                          </span>
                        }
                        onConfirm={turnOffAllTerrace}
                        confirmLabel="Confirmer"
                        cancelLabel="Annuler"
                        className="px-2.5 py-1 bg-[#C8102E]/10 hover:bg-[#C8102E]/20 text-[#C8102E] border border-[#C8102E]/30 rounded text-[9px] font-mono font-bold tracking-wider transition-all uppercase flex items-center gap-1 cursor-pointer"
                        confirmClassName="px-2 py-0.5 bg-[#C8102E] text-white text-[9px] font-mono rounded"
                        cancelClassName="px-2 py-0.5 bg-transparent border border-[#2A1E15] text-[#8E7E70] text-[9px] font-mono rounded"
                      />
                    )}
                    <button onClick={() => addTable(true)}
                      className="bg-[#C8102E] hover:opacity-90 text-white font-bold py-1 px-3 rounded text-[10px] flex items-center gap-1 cursor-pointer">
                      <Plus size={12} /> ADD TABLE
                    </button>
                  </div>
                </div>

                {tablesToRender.filter(t => t.is_terrace).length === 0 ? (
                  <div className="p-8 text-center bg-[#120D09]/50 border border-dashed border-[#2A1E15] rounded-xl text-xs text-[#8E7E70] font-mono">
                    Aucune table n'est actuellement assignée à la terrasse.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {tablesToRender.filter(t => t.is_terrace).map(table => {
                      const activeOrder = orders.find(o => o.table_id === table.id && o.status !== "delivered");
                      const tableUrl = `${window.location.origin}/?view=order&table=${table.id}&area=${encodeURIComponent(table.area)}`;
                      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tableUrl)}`;
                      
                      return (
                        <div key={table.id} className="p-4 bg-[#120D09] border rounded text-center transition-all flex flex-col justify-between"
                          style={{ borderColor: activeOrder ? "#C8102E" : table.waiter_called ? "#F59E0B" : "#2A1E15" }}>
                          
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-serif font-black text-base text-white">{table.id}</span>
                              <span className="text-[9px] text-[#8E7E70] font-mono uppercase">{table.area}</span>
                            </div>
                            
                            {/* Scannable & Clickable QR Code */}
                            <a
                              href={tableUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-16 h-16 mx-auto mb-3 bg-white p-1 rounded overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                              title="Click to open menu for this table in a new tab"
                            >
                              <img
                                src={qrImageUrl}
                                alt={`QR Code for ${table.id}`}
                                className="w-full h-full object-contain"
                              />
                            </a>

                            <div className="font-mono text-[9px] font-bold" style={{ color: activeOrder ? statusColors[activeOrder.status] : table.waiter_called ? "#F59E0B" : "#8E7E70" }}>
                              {table.waiter_called ? "🛎️ WAITER CALLED" : activeOrder ? statusLabels[activeOrder.status] : "VACANT"}
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-2.5 border-t border-[#2A1E15]/30">
                            {/* La Terrasse Toggle button */}
                            <div className="flex items-center justify-between text-[10px] mb-2 font-mono">
                              <span className="text-[#8E7E70]">La Terrasse:</span>
                              <button
                                onClick={() => toggleTerrace(table.id, table.is_terrace)}
                                className="w-7 h-4 relative rounded-full transition-all border cursor-pointer"
                                style={{ background: table.is_terrace ? "#C8102E" : "#1A130E", borderColor: table.is_terrace ? "#C8102E" : "#2A1E15" }}
                              >
                                <div className="absolute top-[1px] w-2.5 h-2.5 rounded-full bg-white transition-all"
                                  style={{ left: table.is_terrace ? "13px" : "1px" }} />
                              </button>
                            </div>
                            
                            <div className="flex gap-1">
                              <button
                                onClick={() => printQrCode(table.id, table.area)}
                                className="flex-1 py-1 border border-[#2A1E15] hover:bg-[#1A130E] text-white rounded text-[8px] font-bold cursor-pointer"
                              >
                                PRINT
                              </button>
                              <button
                                onClick={() => downloadQrCode(table.id, table.area)}
                                className="flex-1 py-1 border border-[#2A1E15] hover:bg-[#1A130E] text-[#8E7E70] hover:text-white rounded text-[8px] font-bold cursor-pointer"
                              >
                                DL
                              </button>
                            <ConfirmButton
                              label="DEL"
                              onConfirm={() => deleteTable(table.id)}
                              confirmLabel="Oui"
                              cancelLabel="Non"
                              className="flex-1 py-1 border border-[#2A1E15] hover:bg-red-950/20 text-[#C8102E] rounded text-[8px] font-bold cursor-pointer text-center"
                              confirmClassName="px-2 py-0.5 bg-[#C8102E] text-white text-[9px] font-bold rounded"
                              cancelClassName="px-2 py-0.5 bg-transparent border border-[#2A1E15] text-[#8E7E70] text-[9px] font-bold rounded"
                            />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COUNTER DIRECT SALE TAB */}
          {section === "counter" && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fade-in">
              {/* Product Catalog */}
              <div className="xl:col-span-2 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-serif font-black text-lg text-white">Vente au Comptoir</h3>
                    <p className="text-xs text-[#8E7E70] mt-1 font-mono">Enregistrez des ventes directes et générez des factures tickets de caisse imprimables.</p>
                  </div>
                </div>

                {/* Category Selector */}
                <div className="flex flex-wrap gap-1.5 py-2 border-b border-[#2A1E15]/30">
                  {["All", "Burgers", "Chicken", "Sides", "Drinks", "Vegan"].map((cat) => {
                    const active = (cat === "All" && !activeCategory) || activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat === "All" ? "" : cat)}
                        className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider rounded transition-all cursor-pointer border uppercase"
                        style={{
                          background: active ? "#C8102E" : "#120D09",
                          borderColor: active ? "#C8102E" : "#2A1E15",
                          color: active ? "#white" : "#8E7E70",
                        }}
                      >
                        {cat === "All" ? "TOUT" : cat}
                      </button>
                    );
                  })}
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[60vh] pr-1">
                  {products
                    .filter((p) => p.active && (!activeCategory || p.category === activeCategory))
                    .map((product) => (
                      <div
                        key={product.id}
                        onClick={() => {
                          setCounterCart((prev) => {
                            const existing = prev.find((item) => item.product_id === product.id);
                            if (existing) {
                              return prev.map((item) =>
                                item.product_id === product.id
                                  ? { ...item, quantity: item.quantity + 1 }
                                  : item
                              );
                            }
                            return [
                              ...prev,
                              {
                                product_id: product.id,
                                name: product.name,
                                price: product.price,
                                quantity: 1,
                                customizations: {},
                              },
                            ];
                          });
                        }}
                        className="p-3 bg-[#120D09] border border-[#2A1E15] hover:border-[#C8102E]/60 rounded-xl transition-all flex flex-col justify-between cursor-pointer group"
                      >
                        <div className="relative h-28 rounded-lg overflow-hidden mb-2.5">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-1.5 right-1.5 px-2 py-0.5 bg-[#0A0704]/80 border border-[#2A1E15] rounded text-[9px] font-mono font-bold text-[#C8102E]">
                            €{product.price.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <span className="text-[8px] font-mono tracking-widest text-[#8E7E70] uppercase">{product.category}</span>
                          <h4 className="font-serif font-black text-sm text-white mt-0.5 line-clamp-1">{product.name}</h4>
                          <p className="text-[9px] text-[#8E7E70] font-mono mt-1 line-clamp-2 leading-relaxed">{product.desc}</p>
                        </div>
                        <button
                          type="button"
                          className="mt-3 w-full py-1.5 bg-[#2A1E15] hover:bg-[#C8102E] text-white rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Ajouter +
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* Cash Cart Register */}
              <div className="bg-[#120D09] border border-[#2A1E15] p-5 rounded-xl flex flex-col justify-between min-h-[500px]">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#2A1E15]/30 mb-4">
                    <span className="font-mono text-xs font-black text-[#C8102E] tracking-wider uppercase">Panier Comptoir</span>
                    <span className="bg-[#C8102E] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded-full">
                      {counterCart.reduce((sum, item) => sum + item.quantity, 0)} articles
                    </span>
                  </div>

                  {/* Cart Items list */}
                  <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-1 mb-4">
                    {counterCart.length === 0 ? (
                      <div className="text-center py-12 text-[#8E7E70] font-mono text-xs leading-relaxed">
                        Le panier est vide.<br />Cliquez sur des articles pour les ajouter.
                      </div>
                    ) : (
                      counterCart.map((item) => (
                        <div key={item.product_id} className="flex justify-between items-center bg-[#1A130E]/30 p-2 border border-[#2A1E15]/50 rounded-lg">
                          <div className="flex-1 min-w-0 pr-2">
                            <h5 className="font-serif font-bold text-xs text-white truncate">{item.name}</h5>
                            <span className="font-mono text-[9px] text-[#8E7E70]">€{item.price.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Decrement */}
                            <button
                              onClick={() => {
                                setCounterCart((prev) =>
                                  prev
                                    .map((i) =>
                                      i.product_id === item.product_id
                                        ? { ...i, quantity: i.quantity - 1 }
                                        : i
                                    )
                                    .filter((i) => i.quantity > 0)
                                );
                              }}
                              className="w-5 h-5 bg-[#2A1E15] hover:bg-[#C8102E] rounded flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-5 text-center font-mono text-xs text-white font-bold">{item.quantity}</span>
                            {/* Increment */}
                            <button
                              onClick={() => {
                                setCounterCart((prev) =>
                                  prev.map((i) =>
                                    i.product_id === item.product_id
                                      ? { ...i, quantity: i.quantity + 1 }
                                      : i
                                  )
                                );
                              }}
                              className="w-5 h-5 bg-[#2A1E15] hover:bg-[#C8102E] rounded flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                            >
                              +
                            </button>
                            {/* Remove */}
                            <button
                              onClick={() => {
                                setCounterCart((prev) => prev.filter((i) => i.product_id !== item.product_id));
                              }}
                              className="ml-1 w-5 h-5 bg-red-950/20 hover:bg-red-900/50 text-[#C8102E] border border-red-950/40 rounded flex items-center justify-center transition-colors cursor-pointer"
                              title="Retirer"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Notes Field */}
                  <div className="mt-4 pt-4 border-t border-[#2A1E15]/30">
                    <label className="text-[9px] font-mono text-[#8E7E70] block mb-1 uppercase">Notes pour la cuisine</label>
                    <textarea
                      value={counterNote}
                      onChange={(e) => setCounterNote(e.target.value)}
                      placeholder="ex: Bien cuit, sans sel, etc."
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E] resize-none"
                    />
                  </div>
                </div>

                {/* Subtotals & Pay Action */}
                <div className="mt-5 pt-4 border-t border-[#2A1E15]/40 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-[#8E7E70]">Total Hors Taxes:</span>
                    <span>€{(counterCart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 0.909).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono border-b border-[#2A1E15]/20 pb-2">
                    <span className="text-[#8E7E70]">TVA (10% incluse):</span>
                    <span>€{(counterCart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 0.091).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-base font-serif font-black">
                    <span className="text-white">TOTAL À PAYER:</span>
                    <span className="text-[#C8102E]">
                      €{counterCart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={handleCounterCheckout}
                    disabled={counterCart.length === 0}
                    className="w-full py-3 bg-[#C8102E] hover:opacity-90 disabled:opacity-40 text-white font-bold rounded-xl text-xs mt-2 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#C8102E]/10 font-mono tracking-wider font-bold"
                  >
                    <DollarSign size={14} /> VALIDER & IMPRIMER TICKET
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. SHOWS MANAGER CMS */}
          {section === "shows" && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-black text-lg text-white">Live Show Matrix</h3>
                  <p className="text-xs text-[#8E7E70] mt-1 font-mono">Create live performances, manage seating capacities, and track ticket bookings.</p>
                </div>
                {!showShowForm && (
                  <button
                    onClick={() => {
                      setEditingShow({ id: "", title: "", description: "", price: 0, date: new Date().toISOString(), image: "", available_tickets: 50 });
                      setShowShowForm(true);
                    }}
                    className="bg-[#C8102E] hover:opacity-90 text-white font-bold py-2 px-4 rounded text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} /> NEW PERFORMANCE
                  </button>
                )}
              </div>

              {showShowForm && editingShow && (
                <div className="p-5 bg-[#120D09] border border-[#2A1E15] rounded-xl mb-4">
                  <h4 className="font-serif font-black text-sm text-white mb-4 border-b border-[#2A1E15]/40 pb-2">
                    {editingShow.id ? `EDIT PERFORMANCE: ${editingShow.title}` : "FORGE NEW SHOW"}
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1">SHOW TITLE</label>
                      <input
                        type="text"
                        value={editingShow.title}
                        onChange={e => setEditingShow(p => p ? { ...p, title: e.target.value } : null)}
                        placeholder="Live Concert Night"
                        className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1">TICKET PRICE (€)</label>
                      <input
                        type="number"
                        value={editingShow.price}
                        onChange={e => setEditingShow(p => p ? { ...p, price: Number(e.target.value) } : null)}
                        placeholder="25.00"
                        className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1">DATE & TIME</label>
                      <input
                        type="datetime-local"
                        value={editingShow.date ? new Date(editingShow.date).toISOString().slice(0, 16) : ""}
                        onChange={e => setEditingShow(p => p ? { ...p, date: new Date(e.target.value).toISOString() } : null)}
                        className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1">CAPACITY SEATS</label>
                      <input
                        type="number"
                        value={editingShow.available_tickets}
                        onChange={e => setEditingShow(p => p ? { ...p, available_tickets: Number(e.target.value) } : null)}
                        placeholder="50"
                        className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                      />
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1">SHOW IMAGE</label>
                      <div className="flex flex-col gap-2">
                        <label className="flex flex-col items-center justify-center h-16 w-full rounded border border-dashed border-[#2A1E15] hover:border-[#C8102E]/50 transition-colors cursor-pointer bg-[#1A130E]/30">
                          <span className="text-[9px] font-mono text-[#8E7E70]">Upload image file</span>
                          <input type="file" accept="image/*" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onloadend = () => setEditingShow((p: any) => p ? { ...p, image: reader.result as string } : null);
                            reader.readAsDataURL(file);
                          }} className="hidden" />
                        </label>
                        {editingShow.image && (
                          <div className="h-16 w-28 rounded border border-[#2A1E15] overflow-hidden">
                            <img src={editingShow.image} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1">DESCRIPTION DETAILS</label>
                      <textarea
                        value={editingShow.description}
                        onChange={e => setEditingShow(p => p ? { ...p, description: e.target.value } : null)}
                        rows={3}
                        className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E] resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={saveShow}
                      className="bg-[#C8102E] hover:opacity-90 text-white font-bold py-2 px-4 rounded text-xs flex items-center gap-1.5 cursor-pointer">
                      <Save size={13} /> COMMIT SHOW
                    </button>
                    <button onClick={() => setShowShowForm(false)}
                      className="border border-[#2A1E15] hover:bg-[#1A130E] text-[#8E7E70] hover:text-white py-2 px-4 rounded text-xs cursor-pointer">
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Shows List */}
                <div className="lg:col-span-2 flex flex-col gap-3">
                  <h4 className="font-mono text-[9px] text-[#8E7E70] tracking-widest uppercase">ACTIVE SHOWS ({shows.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {shows.map(show => (
                      <div key={show.id} className="p-4 bg-[#120D09] border border-[#2A1E15] rounded-xl flex gap-3 flex-col justify-between">
                        <div className="flex gap-3">
                          <div className="w-14 h-14 bg-[#1A130E] rounded overflow-hidden flex-shrink-0">
                            <img src={show.image} alt={show.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <h5 className="font-bold text-xs text-white truncate">{show.title}</h5>
                            <p className="text-[10px] text-[#8E7E70] line-clamp-2 mt-1 leading-snug">{show.description}</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-[#2A1E15]/30 flex justify-between items-center text-[10px] font-mono">
                          <span className="text-[#C8102E] font-bold">€{show.price?.toFixed(2)}</span>
                          <span className="text-[#8E7E70]">Cap: {show.available_tickets} seats</span>
                        </div>
                        <div className="flex justify-end gap-3 mt-2 border-t border-[#2A1E15]/10 pt-2.5">
                          <button onClick={() => {
                            setEditingShow(show);
                            setShowShowForm(true);
                          }} className="text-[#8E7E70] hover:text-white text-[10px] font-bold cursor-pointer">Edit</button>
                          <ConfirmButton
                            label="Delete"
                            onConfirm={() => deleteShow(show.id)}
                            confirmLabel="Oui"
                            cancelLabel="Non"
                            className="text-[#C8102E] hover:text-red-500 text-[10px] font-bold cursor-pointer"
                            confirmClassName="px-2 py-0.5 bg-[#C8102E] text-white text-[9px] font-bold rounded"
                            cancelClassName="px-2 py-0.5 bg-transparent border border-[#2A1E15] text-[#8E7E70] text-[9px] font-bold rounded"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {shows.length === 0 && (
                    <div className="text-center py-12 text-xs text-[#8E7E70] border border-[#2A1E15] border-dashed rounded">No active shows found.</div>
                  )}
                </div>

                {/* Sold Tickets Registry */}
                <div className="flex flex-col gap-3">
                  <h4 className="font-mono text-[9px] text-[#8E7E70] tracking-widest uppercase">SOLD TICKETS ({tickets.length})</h4>
                  <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {tickets.map(ticket => (
                      <div key={ticket.id} className="p-3 bg-[#120D09] border border-[#2A1E15] rounded-xl">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-xs text-[#E5D5C5] truncate w-32">{ticket.customer_name}</span>
                          <span className="bg-[#C8102E]/10 text-[#C8102E] font-mono text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0">
                            {ticket.quantity} ticket{ticket.quantity > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#8E7E70] font-mono mb-1 truncate">{ticket.customer_email}</div>
                        <div className="text-[10px] text-white/80 truncate">
                          Show: <span className="font-serif italic font-bold text-[#E5D5C5]">{ticket.shows?.title || "Unknown Event"}</span>
                        </div>
                      </div>
                    ))}
                    {tickets.length === 0 && (
                      <div className="text-center py-12 text-xs text-[#8E7E70] border border-[#2A1E15] border-dashed rounded">No tickets sold yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. PREFERENCES */}
          {section === "settings" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
              {/* Coordinates Card */}
              <div className="bg-[#120D09] border border-[#2A1E15] p-5 rounded-xl self-start relative">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-xs font-mono tracking-widest text-[#C8102E] uppercase">Restaurant Coordinates</h3>
                  <ConfirmButton
                    label={
                      <span className="flex items-center gap-1">
                        <Trash2 size={10} /> Reset Balance
                      </span>
                    }
                    onConfirm={clearRevenue}
                    confirmLabel="Confirmer"
                    cancelLabel="Annuler"
                    className="bg-red-950/40 hover:bg-red-900/60 text-[#C8102E] border border-[#C8102E]/30 font-bold py-1 px-3 rounded text-[9px] uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                    confirmClassName="px-2 py-0.5 bg-[#C8102E] text-white text-[9px] font-mono rounded"
                    cancelClassName="px-2 py-0.5 bg-transparent border border-[#2A1E15] text-[#8E7E70] text-[9px] font-mono rounded"
                  />
                </div>
                <div className="flex flex-col gap-4">
                  {[
                    { label: "Vessel Name", value: prefVesselName, onChange: (e: any) => setPrefVesselName(e.target.value) },
                    { label: "Coordinates/Address", value: prefAddress, onChange: (e: any) => setPrefAddress(e.target.value) },
                    { label: "Hotline", value: prefHotline, onChange: (e: any) => setPrefHotline(e.target.value) },
                    { label: "Operation Slots", value: prefOpSlots, onChange: (e: any) => setPrefOpSlots(e.target.value) },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1.5 uppercase">{f.label}</label>
                      <input
                        value={f.value}
                        onChange={f.onChange}
                        className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                      />
                    </div>
                  ))}
                  <button 
                    onClick={handleSavePreferences}
                    disabled={savingPrefs}
                    className="bg-[#C8102E] hover:opacity-90 disabled:opacity-50 text-white font-bold py-2 px-4 rounded text-xs self-start mt-2 cursor-pointer transition-opacity"
                  >
                    {savingPrefs ? "SAVING..." : "SAVE PREFERENCES"}
                  </button>
                </div>
              </div>

              {/* Hero Banner CMS Card */}
              <div className="bg-[#120D09] border border-[#2A1E15] p-5 rounded-xl flex flex-col gap-4">
                <h3 className="text-xs font-mono tracking-widest text-[#C8102E] mb-1 uppercase">Hero Banner CMS Matrix</h3>
                <p className="text-[10px] text-[#8E7E70] font-mono leading-relaxed">
                  Configure the landing page hero background, customizable bilingual text slogans, and client menu toggle status.
                </p>

                <div className="flex flex-col gap-4 mt-2">
                  {/* Image Uploader */}
                  {/* Image Uploader */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Background Image */}
                    <div>
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1.5 uppercase">Hero Background Image</label>
                      {heroConfig.image ? (
                        <div className="relative h-28 w-full rounded-xl border border-[#2A1E15] overflow-hidden group">
                          <img src={heroConfig.image} alt="Hero Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <label className="cursor-pointer bg-[#C8102E] hover:opacity-90 text-white font-mono text-[9px] font-bold px-2.5 py-1.5 rounded">
                              {uploadingHero ? "UPLOADING..." : "REPLACE IMAGE"}
                              <input type="file" accept="image/*" onChange={handleHeroImageUpload("image")} disabled={uploadingHero} className="hidden" />
                            </label>
                            <button 
                              type="button"
                              onClick={() => setHeroConfig((p: any) => ({ ...p, image: "" }))} 
                              className="bg-zinc-850 hover:bg-zinc-750 text-white font-mono text-[9px] font-bold px-2.5 py-1.5 rounded cursor-pointer"
                            >
                              REMOVE
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-28 w-full rounded-xl border border-dashed border-[#2A1E15] hover:border-[#C8102E]/50 transition-colors cursor-pointer bg-[#1A130E]/30">
                          {uploadingHero ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-4 h-4 border-2 border-t-[#C8102E] border-r-transparent animate-spin rounded-full" />
                              <span className="text-[9px] font-mono text-[#8E7E70]">Uploading...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <Upload size={16} className="text-[#8E7E70]" />
                              <span className="text-[9px] font-mono text-[#8E7E70]">Upload banner image</span>
                            </div>
                          )}
                          <input type="file" accept="image/*" onChange={handleHeroImageUpload("image")} disabled={uploadingHero} className="hidden" />
                        </label>
                      )}
                    </div>

                    {/* Front Image */}
                    <div>
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1.5 uppercase">Hero Front Image</label>
                      {heroConfig.front_image ? (
                        <div className="relative h-28 w-full rounded-xl border border-[#2A1E15] overflow-hidden group">
                          <img src={heroConfig.front_image} alt="Hero Front Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <label className="cursor-pointer bg-[#C8102E] hover:opacity-90 text-white font-mono text-[9px] font-bold px-2.5 py-1.5 rounded">
                              {uploadingHero ? "UPLOADING..." : "REPLACE IMAGE"}
                              <input type="file" accept="image/*" onChange={handleHeroImageUpload("front_image")} disabled={uploadingHero} className="hidden" />
                            </label>
                            <button 
                              type="button"
                              onClick={() => setHeroConfig((p: any) => ({ ...p, front_image: "" }))} 
                              className="bg-zinc-850 hover:bg-zinc-750 text-white font-mono text-[9px] font-bold px-2.5 py-1.5 rounded cursor-pointer"
                            >
                              REMOVE
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-28 w-full rounded-xl border border-dashed border-[#2A1E15] hover:border-[#C8102E]/50 transition-colors cursor-pointer bg-[#1A130E]/30">
                          {uploadingHero ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-4 h-4 border-2 border-t-[#C8102E] border-r-transparent animate-spin rounded-full" />
                              <span className="text-[9px] font-mono text-[#8E7E70]">Uploading...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <Upload size={16} className="text-[#8E7E70]" />
                              <span className="text-[9px] font-mono text-[#8E7E70]">Upload front image</span>
                            </div>
                          )}
                          <input type="file" accept="image/*" onChange={handleHeroImageUpload("front_image")} disabled={uploadingHero} className="hidden" />
                        </label>
                      )}
                    </div>

                    {/* Logo Image */}
                    <div>
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1.5 uppercase">Navbar Logo Image</label>
                      {heroConfig.logo_image ? (
                        <div className="relative h-28 w-full rounded-xl border border-[#2A1E15] overflow-hidden group">
                          <img src={heroConfig.logo_image} alt="Logo Preview" className="w-full h-full object-contain bg-[#0A0704]" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <label className="cursor-pointer bg-[#C8102E] hover:opacity-90 text-white font-mono text-[9px] font-bold px-2.5 py-1.5 rounded">
                              {uploadingHero ? "UPLOADING..." : "REPLACE"}
                              <input type="file" accept="image/*" onChange={handleHeroImageUpload("logo_image")} disabled={uploadingHero} className="hidden" />
                            </label>
                            <button 
                              type="button"
                              onClick={() => setHeroConfig((p: any) => ({ ...p, logo_image: "" }))} 
                              className="bg-zinc-850 hover:bg-zinc-750 text-white font-mono text-[9px] font-bold px-2.5 py-1.5 rounded cursor-pointer"
                            >
                              REMOVE
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-28 w-full rounded-xl border border-dashed border-[#2A1E15] hover:border-[#C8102E]/50 transition-colors cursor-pointer bg-[#1A130E]/30">
                          {uploadingHero ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-4 h-4 border-2 border-t-[#C8102E] border-r-transparent animate-spin rounded-full" />
                              <span className="text-[9px] font-mono text-[#8E7E70]">Uploading...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <Upload size={16} className="text-[#8E7E70]" />
                              <span className="text-[9px] font-mono text-[#8E7E70]">Upload logo</span>
                            </div>
                          )}
                          <input type="file" accept="image/*" onChange={handleHeroImageUpload("logo_image")} disabled={uploadingHero} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Menu Visibility Toggle */}
                  <div className="flex items-center justify-between p-3.5 bg-[#1A130E]/55 border border-[#2A1E15] rounded-xl select-none">
                    <div>
                      <span className="text-[10px] font-mono tracking-wider text-[#8E7E70] block uppercase">Show Hero in Client Menu</span>
                      <span className="text-[9px] text-[#8E7E70] leading-snug">Toggle banner display at the top of guest table menus.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setHeroConfig((p: any) => ({ ...p, show_in_menu: !p.show_in_menu }))}
                        className="w-10 h-5 relative rounded-full transition-all border cursor-pointer"
                        style={{ background: heroConfig.show_in_menu ? "#C8102E" : "#1A130E", borderColor: heroConfig.show_in_menu ? "#C8102E" : "#2A1E15" }}>
                        <div className="absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all"
                          style={{ left: heroConfig.show_in_menu ? "23px" : "3px" }} />
                      </button>
                      <span className="font-mono text-[9px] font-bold min-w-[20px] text-center">{heroConfig.show_in_menu ? "YES" : "NO"}</span>
                    </div>
                  </div>

                  {/* French Slogans */}
                  <div className="border-t border-[#2A1E15]/30 pt-3">
                    <span className="text-[10px] font-mono font-black text-[#C8102E] tracking-wider block mb-2">FRENCH TRANSLATIONS (FR)</span>
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-mono text-[#8E7E70] block mb-1">TITLE LINE 1</label>
                          <input
                            type="text"
                            value={heroConfig.title1_fr}
                            onChange={e => setHeroConfig((p: any) => ({ ...p, title1_fr: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-mono text-[#8E7E70] block mb-1">TITLE LINE 2 (ITALIC)</label>
                          <input
                            type="text"
                            value={heroConfig.title2_fr}
                            onChange={e => setHeroConfig((p: any) => ({ ...p, title2_fr: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-mono text-[#8E7E70] block mb-1">HERO SUBTITLE DESCRIPTION</label>
                        <textarea
                          value={heroConfig.subtitle_fr}
                          onChange={e => setHeroConfig((p: any) => ({ ...p, subtitle_fr: e.target.value }))}
                          rows={2}
                          className="w-full px-2.5 py-1.5 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E] resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* English Slogans */}
                  <div className="border-t border-[#2A1E15]/30 pt-3">
                    <span className="text-[10px] font-mono font-black text-[#C8102E] tracking-wider block mb-2">ENGLISH TRANSLATIONS (EN)</span>
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-mono text-[#8E7E70] block mb-1">TITLE LINE 1</label>
                          <input
                            type="text"
                            value={heroConfig.title1_en}
                            onChange={e => setHeroConfig((p: any) => ({ ...p, title1_en: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-mono text-[#8E7E70] block mb-1">TITLE LINE 2 (ITALIC)</label>
                          <input
                            type="text"
                            value={heroConfig.title2_en}
                            onChange={e => setHeroConfig((p: any) => ({ ...p, title2_en: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-mono text-[#8E7E70] block mb-1">HERO SUBTITLE DESCRIPTION</label>
                        <textarea
                          value={heroConfig.subtitle_en}
                          onChange={e => setHeroConfig((p: any) => ({ ...p, subtitle_en: e.target.value }))}
                          rows={2}
                          className="w-full px-2.5 py-1.5 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E] resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveHero}
                    disabled={uploadingHero}
                    className="bg-[#C8102E] hover:opacity-90 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs mt-2 cursor-pointer shadow-md shadow-[#C8102E]/20"
                  >
                    {uploadingHero ? "UPLOADING IMAGE..." : "SAVE HERO BANNER CONFIG"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 7. STAFF MANAGEMENT (ÉQUIPE) */}
          {section === "staff" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-black text-lg text-white">Waiter Registry</h3>
                  <p className="text-xs text-[#8E7E70] mt-1 font-mono">Manage floor service credentials and table assignments.</p>
                </div>
                <button
                  onClick={() => setShowWaiterModal(true)}
                  className="bg-[#C8102E] hover:opacity-90 text-white font-bold py-2 px-4 rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#C8102E]/20"
                >
                  <Plus size={14} /> ADD NEW WAITER
                </button>
              </div>

              {/* Waiters Registry Table */}
              <div className="bg-[#120D09] border border-[#2A1E15] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#2A1E15] bg-[#1A130E]/30">
                      <th className="px-4 py-3 text-[10px] font-mono text-[#8E7E70] uppercase">Waiter Details</th>
                      <th className="px-4 py-3 text-[10px] font-mono text-[#8E7E70] uppercase">Assigned Tables</th>
                      <th className="px-4 py-3 text-[10px] font-mono text-[#8E7E70] uppercase">Online Status</th>
                      <th className="px-4 py-3 text-[10px] font-mono text-[#8E7E70] uppercase text-center">Service Status</th>
                      <th className="px-4 py-3 text-[10px] font-mono text-[#8E7E70] uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A1E15]/50">
                    {waiters.map((w) => {
                      const isOnline = w.last_seen && (Date.now() - new Date(w.last_seen).getTime() < 300000);
                      const timeStr = w.last_seen ? new Date(w.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A";
                      
                      return (
                        <tr key={w.id} className="hover:bg-white/[0.01]">
                          <td className="px-4 py-3.5 text-xs">
                            <div className="font-bold text-white">{w.name}</div>
                            <div className="text-[10px] text-[#8E7E70] font-mono mt-0.5">{w.email}</div>
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            {w.assigned_tables && w.assigned_tables.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {w.assigned_tables.map((t: string) => (
                                  <span key={t} className="bg-[#1A130E] border border-[#2A1E15] text-[#E5D5C5] text-[9px] font-mono px-2 py-0.5 rounded">{t}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-[9px] font-mono font-bold px-2.5 py-0.5 rounded tracking-wide uppercase">All Tables</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-[#10B981] animate-pulse" : "bg-[#8E7E70]/30"}`} />
                              <span className="font-bold text-white text-[10px] font-mono">{isOnline ? "ONLINE" : "OFFLINE"}</span>
                              {w.last_seen && (
                                <span className="text-[10px] text-[#8E7E70] font-mono">({timeStr})</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-center">
                            <button
                              onClick={() => toggleWaiterActive(w)}
                              className={`px-2.5 py-1 rounded text-[9px] font-mono font-bold tracking-wider cursor-pointer border ${
                                w.is_active 
                                  ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/25" 
                                  : "bg-[#1A130E] text-[#8E7E70] border-[#2A1E15] hover:text-white"
                              }`}
                            >
                              {w.is_active ? "ACTIVE" : "INACTIVE"}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEditWaiter(w)}
                                className="p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg transition-colors cursor-pointer"
                                title="Modify Waiter"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => setDeletingWaiter(w)}
                                className="p-1.5 bg-[#C8102E]/15 border border-[#C8102E]/30 hover:bg-[#C8102E]/25 text-[#C8102E] rounded-lg transition-colors cursor-pointer"
                                title="Delete Waiter"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {waiters.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-xs text-[#8E7E70] italic">
                          No floor waiters registered in system yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add Waiter Modal */}
              {showWaiterModal && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-white select-none">
                  <div className="bg-[#120D09] border border-[#2A1E15] p-8 rounded-2xl max-w-md w-full shadow-2xl relative">
                    <h4 className="font-serif font-bold text-xl mb-1 text-white">Register Floor Waiter</h4>
                    <p className="text-[10px] text-[#8E7E70] uppercase font-mono mb-6">Staff Access Credentials</p>

                    {waiterError && (
                      <div className="mb-5 p-3.5 bg-[#C8102E]/10 border border-[#C8102E]/30 rounded-xl text-xs text-white">
                        {waiterError}
                      </div>
                    )}

                    <form onSubmit={handleCreateWaiter} className="space-y-4">
                      <div>
                        <label className="block text-[9px] font-mono text-[#8E7E70] uppercase mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          value={newWaiterName}
                          onChange={(e) => setNewWaiterName(e.target.value)}
                          placeholder="e.g. Jean Dupont"
                          className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded-xl text-white outline-none focus:border-[#C8102E]"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-[#8E7E70] uppercase mb-1">Email Address</label>
                        <input
                          type="email"
                          required
                          value={newWaiterEmail}
                          onChange={(e) => setNewWaiterEmail(e.target.value)}
                          placeholder="e.g. jean@ledoubleface.com"
                          className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded-xl text-white outline-none focus:border-[#C8102E]"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-[#8E7E70] uppercase mb-1">4-Digit Access PIN</label>
                        <input
                          type="password"
                          required
                          maxLength={4}
                          value={newWaiterPin}
                          onChange={(e) => setNewWaiterPin(e.target.value.replace(/\D/g, ""))}
                          placeholder="e.g. 1234"
                          className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded-xl text-white outline-none focus:border-[#C8102E] tracking-widest font-bold text-center text-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-[#8E7E70] uppercase mb-1">
                          Assigned Tables <span className="text-[8px] text-[#8E7E70] lowercase italic">(leave empty for ALL tables)</span>
                        </label>
                        <input
                          type="text"
                          value={newWaiterTables}
                          onChange={(e) => setNewWaiterTables(e.target.value)}
                          placeholder="e.g. T01, T02, T03 (leave empty to assign all tables)"
                          className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded-xl text-white outline-none focus:border-[#C8102E]"
                        />
                        <span className="text-[9px] text-[#8E7E70] italic mt-1 block">
                          * If left empty, the waiter will be responsible for all tables.
                        </span>
                      </div>

                      <div className="flex gap-3 pt-4 border-t border-[#2A1E15]/30">
                        <button
                          type="button"
                          onClick={() => {
                            setShowWaiterModal(false);
                            setWaiterError(null);
                          }}
                          className="flex-1 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl text-xs cursor-pointer active:scale-95 transition-all text-center"
                        >
                          CANCEL
                        </button>
                        <button
                          type="submit"
                          disabled={waiterSubmitting}
                          className="flex-1 py-2.5 bg-[#C8102E] text-white font-bold rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {waiterSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>CREATING...</span>
                            </>
                          ) : (
                            <span>REGISTER WAITER</span>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Edit Waiter Modal */}
              {editingWaiter && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-white select-none">
                  <div className="bg-[#120D09] border border-[#2A1E15] p-8 rounded-2xl max-w-md w-full shadow-2xl relative">
                    <h4 className="font-serif font-bold text-xl mb-1 text-white">Modify Floor Waiter</h4>
                    <p className="text-[10px] text-[#8E7E70] uppercase font-mono mb-6">Edit Staff Access & Assignments</p>

                    {editWaiterError && (
                      <div className="mb-5 p-3.5 bg-[#C8102E]/10 border border-[#C8102E]/30 rounded-xl text-xs text-white">
                        {editWaiterError}
                      </div>
                    )}

                    <form onSubmit={handleUpdateWaiter} className="space-y-4">
                      <div>
                        <label className="block text-[9px] font-mono text-[#8E7E70] uppercase mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          value={editWaiterName}
                          onChange={(e) => setEditWaiterName(e.target.value)}
                          placeholder="e.g. Jean Dupont"
                          className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded-xl text-white outline-none focus:border-[#C8102E]"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-[#8E7E70] uppercase mb-1">Email Address</label>
                        <input
                          type="email"
                          required
                          value={editWaiterEmail}
                          onChange={(e) => setEditWaiterEmail(e.target.value)}
                          placeholder="e.g. jean@ledoubleface.com"
                          className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded-xl text-white outline-none focus:border-[#C8102E]"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-[#8E7E70] uppercase mb-1">
                          4-Digit Access PIN <span className="text-[8px] text-[#8E7E70] lowercase italic">(leave empty to keep current PIN)</span>
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          value={editWaiterPin}
                          onChange={(e) => setEditWaiterPin(e.target.value.replace(/\D/g, ""))}
                          placeholder="••••"
                          className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded-xl text-white outline-none focus:border-[#C8102E] tracking-widest font-bold text-center text-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-[#8E7E70] uppercase mb-1">
                          Assigned Tables <span className="text-[8px] text-[#8E7E70] lowercase italic">(leave empty for ALL tables)</span>
                        </label>
                        <input
                          type="text"
                          value={editWaiterTables}
                          onChange={(e) => setEditWaiterTables(e.target.value)}
                          placeholder="e.g. T01, T02, T03 (leave empty to assign all tables)"
                          className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded-xl text-white outline-none focus:border-[#C8102E]"
                        />
                        <span className="text-[9px] text-[#8E7E70] italic mt-1 block">
                          * If left empty, the waiter will be responsible for all tables.
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-b border-[#2A1E15]/30">
                        <span className="text-[9px] font-mono text-[#8E7E70] uppercase">Service Status</span>
                        <button
                          type="button"
                          onClick={() => setEditWaiterIsActive(!editWaiterIsActive)}
                          className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider border cursor-pointer ${
                            editWaiterIsActive 
                              ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/25" 
                              : "bg-[#1A130E] text-[#8E7E70] border-[#2A1E15] hover:text-white"
                          }`}
                        >
                          {editWaiterIsActive ? "ACTIVE" : "INACTIVE"}
                        </button>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWaiter(null);
                            setEditWaiterError(null);
                          }}
                          className="flex-1 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl text-xs cursor-pointer active:scale-95 transition-all text-center"
                        >
                          CANCEL
                        </button>
                        <button
                          type="submit"
                          disabled={editWaiterSubmitting}
                          className="flex-1 py-2.5 bg-[#C8102E] text-white font-bold rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {editWaiterSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>SAVING...</span>
                            </>
                          ) : (
                            <span>SAVE CHANGES</span>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Delete Waiter Confirmation Modal */}
              {deletingWaiter && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-white select-none">
                  <div className="bg-[#120D09] border border-[#2A1E15] p-8 rounded-2xl max-w-md w-full shadow-2xl relative">
                    <h4 className="font-serif font-bold text-xl mb-1 text-white flex items-center gap-2">
                      <AlertCircle className="text-[#C8102E] w-5 h-5" /> Delete Staff Member
                    </h4>
                    <p className="text-[10px] text-[#8E7E70] uppercase font-mono mb-6">Dangerous Action</p>

                    {deleteWaiterError && (
                      <div className="mb-5 p-3.5 bg-[#C8102E]/10 border border-[#C8102E]/30 rounded-xl text-xs text-white">
                        {deleteWaiterError}
                      </div>
                    )}

                    <div className="mb-6 space-y-2">
                      <p className="text-xs text-[#E5D5C5]">
                        Are you sure you want to permanently delete <strong className="text-white font-bold">{deletingWaiter.name}</strong> ({deletingWaiter.email})?
                      </p>
                      <p className="text-[11px] text-[#8E7E70] leading-relaxed">
                        This action will immediately revoke their access PIN and remove them from the database. This cannot be undone.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-[#2A1E15]/30">
                      <button
                        type="button"
                        disabled={deleteWaiterSubmitting}
                        onClick={() => {
                          setDeletingWaiter(null);
                          setDeleteWaiterError(null);
                        }}
                        className="flex-1 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl text-xs cursor-pointer active:scale-95 transition-all text-center disabled:opacity-50"
                      >
                        CANCEL
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteWaiter}
                        disabled={deleteWaiterSubmitting}
                        className="flex-1 py-2.5 bg-[#C8102E] text-white font-bold rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {deleteWaiterSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>DELETING...</span>
                          </>
                        ) : (
                          <span>DELETE ACCOUNT</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Display Board QR Code Modal */}
              {showQRModal && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-white select-none">
                  <div className="bg-[#120D09] border border-[#2A1E15] p-8 rounded-2xl max-w-md w-full shadow-2xl relative text-center">
                    <h4 className="font-serif font-bold text-xl mb-1 text-white">Order Display Board</h4>
                    <p className="text-[10px] text-[#8E7E70] uppercase font-mono mb-6">Customer TV Screen Setup</p>

                    {/* QR Code Container */}
                    <div className="bg-white p-4 rounded-xl inline-block mb-6 shadow-md">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.origin + window.location.pathname + "?view=display")}`}
                        alt="Customer Display Board Link"
                        className="w-[180px] h-[180px] object-contain"
                      />
                    </div>

                    <div className="space-y-4 mb-8 text-left">
                      <p className="text-xs text-[#E5D5C5] text-center font-mono break-all font-bold select-text p-2 bg-[#1A130E] border border-[#2A1E15] rounded-lg">
                        {window.location.origin + window.location.pathname + "?view=display"}
                      </p>
                      <div className="text-[11px] text-[#8E7E70] leading-relaxed space-y-2">
                        <p>• Scan this QR code with a phone, tablet, or TV web browser to display the live order number queue.</p>
                        <p>• To display this on a TV, open this link in the TV's browser and toggle fullscreen mode.</p>
                        <p>• No login required. It updates automatically in real-time when order statuses change.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowQRModal(false)}
                        className="flex-1 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl text-xs cursor-pointer active:scale-95 transition-all"
                      >
                        CLOSE
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          window.open("?view=display", "_blank");
                          setShowQRModal(false);
                        }}
                        className="flex-1 py-2.5 bg-[#C8102E] text-white font-bold rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        OPEN VIEW
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Floating Waiter Calls warning notifications */}
      {activeWaiterCalls.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
          {activeWaiterCalls.map(table => (
            <div key={table.id} className="p-4 bg-red-950 border border-[#C8102E] rounded-xl flex items-center justify-between shadow-2xl animate-bounce">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛎️</span>
                <div>
                  <div className="text-xs font-mono font-bold text-white uppercase">WAITER CALLED</div>
                  <div className="text-[10px] text-white/80 font-mono">Table {table.id} · {table.area}</div>
                </div>
              </div>
              <button
                onClick={() => dismissWaiterCall(table.id)}
                className="ml-4 px-3 py-1 bg-white text-[#C8102E] hover:opacity-90 font-mono text-[9px] font-bold rounded cursor-pointer"
              >
                DISMISS
              </button>
            </div>
          ))}
        </div>
      )}

      <WaiterCallAlert language={language} />
    </div>
  );
}

// ProductForm sub-component (custom builders)
interface ProductFormProps {
  product: Product;
  onSave: (p: Product) => void;
  onCancel: () => void;
}

function ProductForm({ product, onSave, onCancel }: ProductFormProps) {
  const [form, setForm] = useState<Product>({ ...product });
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"radio" | "checkbox" | "text">("radio");
  const [newOption, setNewOption] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  async function ensureBucketExists() {
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      const exists = buckets?.some((b: any) => b.name === 'menu-images');
      if (!exists) {
        const { error: createError } = await supabase.storage.createBucket('menu-images', {
          public: true,
          allowedMimeTypes: ['image/*']
        });
        if (createError) {
          console.warn("Could not create bucket programmatically. Make sure it exists in the Supabase Dashboard.", createError);
        }
      }
    } catch (err) {
      console.warn("Bucket existence check failed:", err);
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Offline/local mock support if Supabase keys are missing
      const isMock = !supabase || supabase.isMock || !supabase.storage || typeof supabase.storage.from !== "function";
      if (isMock) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setForm(p => ({ ...p, image: base64String }));
          setUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      await ensureBucketExists();

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('menu-images')
        .getPublicUrl(filePath);

      if (data?.publicUrl) {
        setForm(p => ({ ...p, image: data.publicUrl }));
      }
    } catch (err: any) {
      console.warn("Image upload to Supabase failed, falling back to local base64:", err);
      try {
        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setForm(p => ({ ...p, image: base64String }));
      } catch (fallbackErr) {
        console.error("Local image fallback failed:", fallbackErr);
        toast.error(`Impossible de charger l'image localement : ${err.message || err}`);
      }
    } finally {
      setUploading(false);
    }
  };

  function addField() {
    if (!newFieldName) return;
    const field: CustomField = { id: `cf-${Date.now()}`, name: newFieldName, type: newFieldType, options: [], required: false };
    setForm(p => ({ ...p, customFields: [...p.customFields, field] }));
    setNewFieldName("");
  }

  function addOption(fieldId: string) {
    const opt = newOption[fieldId];
    if (!opt) return;
    setForm(p => ({ ...p, customFields: p.customFields.map(f => f.id === fieldId ? { ...f, options: [...f.options, opt] } : f) }));
    setNewOption(p => ({ ...p, [fieldId]: "" }));
  }

  return (
    <div className="p-5 bg-[#120D09] border border-[#2A1E15] rounded">
      <h3 className="font-serif font-black text-sm text-white mb-4 border-b border-[#2A1E15] pb-2">
        {form.name ? `CMS FORGE: Edit ${form.name}` : "CMS FORGE: New Product Matrix"}
      </h3>
      
      <div className="grid md:grid-cols-2 gap-4 mb-5">
        {[
          { key: "name", label: "Product Name", placeholder: "Le Cocktail Double Face" },
          { key: "category", label: "Category Group", placeholder: "Drinks / Burgers / Sides" },
          { key: "price", label: "Base Pricing (€)", placeholder: "14.90", type: "number" },
        ].map(f => (
          <div key={f.key}>
            <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1">{f.label}</label>
            <input
              type={f.type || "text"}
              value={(form as any)[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
            />
          </div>
        ))}
        
        {/* Custom Image Uploader field */}
        <div>
          <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1">Product Image</label>
          {form.image ? (
            <div className="relative h-20 w-full rounded border border-[#2A1E15] overflow-hidden group">
              <img src={form.image} alt="Upload Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <label className="cursor-pointer bg-[#C8102E] hover:opacity-90 text-white font-mono text-[9px] font-bold px-2 py-1 rounded">
                  {uploading ? "UPLOADING..." : "REPLACE"}
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                </label>
                <button 
                  type="button"
                  onClick={() => setForm(p => ({ ...p, image: "" }))} 
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-[9px] font-bold px-2 py-1 rounded cursor-pointer"
                >
                  REMOVE
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-20 w-full rounded border border-dashed border-[#2A1E15] hover:border-[#C8102E]/50 transition-colors cursor-pointer bg-[#1A130E]/30">
              {uploading ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-4 h-4 border-2 border-t-[#C8102E] border-r-transparent animate-spin rounded-full" />
                  <span className="text-[9px] font-mono text-[#8E7E70]">Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload size={16} className="text-[#8E7E70]" />
                  <span className="text-[9px] font-mono text-[#8E7E70]">Upload image file</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
            </label>
          )}
        </div>
        
        <div className="md:col-span-2">
          <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1">Description Copy</label>
          <textarea
            value={form.desc}
            onChange={e => setForm(p => ({ ...p, desc: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E] resize-none"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono tracking-wider text-[#8E7E70]">Inventory Status:</span>
          <button onClick={() => setForm(p => ({ ...p, active: !p.active }))}
            className="w-10 h-5 relative rounded-full transition-all border cursor-pointer"
            style={{ background: form.active ? "#C8102E" : "#1A130E", borderColor: form.active ? "#C8102E" : "#2A1E15" }}>
            <div className="absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all"
              style={{ left: form.active ? "23px" : "3px" }} />
          </button>
          <span className="text-[10px] font-mono">{form.active ? "ACTIVE" : "DRAFT"}</span>
        </div>
      </div>

      {/* Modifier Schema Builder */}
      <div className="mb-6 border-t border-[#2A1E15] pt-4">
        <h4 className="text-xs font-mono tracking-widest text-[#8E7E70] mb-4 uppercase">Modifier Schema Builder ({form.customFields.length})</h4>
        
        <div className="flex flex-col gap-4 mb-4">
          {form.customFields.map(field => (
            <div key={field.id} className="p-3 bg-[#1A130E] border border-[#2A1E15] rounded">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">{field.name}</span>
                  <span className="bg-[#C8102E]/20 text-[#C8102E] text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide font-mono uppercase">{field.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setForm(p => ({ ...p, customFields: p.customFields.map(f => f.id === field.id ? { ...f, required: !f.required } : f) }))}
                    className="px-2 py-0.5 text-[9px] font-bold rounded-sm transition-all border cursor-pointer"
                    style={{ borderColor: field.required ? "#C8102E" : "#2A1E15", color: field.required ? "#C8102E" : "#8E7E70" }}>
                    {field.required ? "REQUIRED" : "OPTIONAL"}
                  </button>
                  <button onClick={() => setForm(p => ({ ...p, customFields: p.customFields.filter(f => f.id !== field.id) }))}
                    className="text-[#8E7E70] hover:text-white cursor-pointer" title="Remove Field">
                    <X size={12} />
                  </button>
                </div>
              </div>

              {field.type !== "text" && (
                <div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {field.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 text-[10px] bg-[#120D09] border border-[#2A1E15] rounded text-[#E5D5C5]">
                        <span>{opt}</span>
                        <button onClick={() => setForm(p => ({ ...p, customFields: p.customFields.map(f => f.id === field.id ? { ...f, options: f.options.filter((_, idx) => idx !== i) } : f) }))}
                          className="text-[#8E7E70] hover:text-white cursor-pointer">
                          <X size={9} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newOption[field.id] || ""}
                      onChange={e => setNewOption(p => ({ ...p, [field.id]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && addOption(field.id)}
                      placeholder="Add sub-option (e.g., Extra cheese (+€1.50))"
                      className="flex-1 px-3 py-1.5 text-xs bg-[#120D09] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                    />
                    <button onClick={() => addOption(field.id)}
                      className="bg-[#C8102E] hover:opacity-90 text-white font-bold px-3 py-1.5 rounded text-xs cursor-pointer">
                      ADD
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Field Inputs */}
        <div className="flex flex-wrap gap-2 p-3 bg-[#1A130E]/50 border border-[#2A1E15] rounded">
          <input
            value={newFieldName}
            onChange={e => setNewFieldName(e.target.value)}
            placeholder="Modifier title (e.g. Ice Options, Supplements...)"
            className="flex-1 min-w-[200px] px-3 py-2 text-xs bg-[#120D09] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
          />
          <select value={newFieldType} onChange={e => setNewFieldType(e.target.value as any)}
            className="px-3 py-2 text-xs bg-[#120D09] border border-[#2A1E15] rounded text-white outline-none cursor-pointer">
            <option value="radio">Radio Option (single selection)</option>
            <option value="checkbox">Checkbox Option (multi selection)</option>
            <option value="text">Text Input (custom comment)</option>
          </select>
          <button onClick={addField}
            className="bg-[#C8102E] hover:opacity-90 text-white font-bold px-3 py-2 rounded text-xs flex items-center gap-1 cursor-pointer">
            <Plus size={13} /> ADD FIELD
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-3 border-t border-[#2A1E15]">
        <button onClick={() => !uploading && onSave(form)}
          disabled={uploading}
          className={`font-bold py-2 px-4 rounded text-xs flex items-center gap-1.5 text-white transition-all ${
            uploading ? "bg-[#C8102E]/50 cursor-not-allowed opacity-60" : "bg-[#C8102E] hover:opacity-90 cursor-pointer"
          }`}>
          <Save size={13} /> {uploading ? "UPLOADING..." : "COMMIT CHANGES"}
        </button>
        <button onClick={onCancel}
          className="border border-[#2A1E15] hover:bg-[#1A130E] text-[#8E7E70] hover:text-white py-2 px-4 rounded text-xs cursor-pointer">
          CANCEL
        </button>
      </div>
    </div>
  );
}
