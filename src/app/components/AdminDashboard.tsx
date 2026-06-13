import { useState, useEffect } from "react";
import {
  LayoutDashboard, Package, ShoppingBag, Tv, QrCode, Settings,
  Plus, Trash2, Edit2, Check, X, Bell, TrendingUp, Users, DollarSign,
  Eye, MoreVertical, ChevronDown, AlertCircle, Clock, CheckCircle2,
  GripVertical, ChevronRight, Save, ArrowLeft, RefreshCw, Upload, Award
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../../lib/supabase";

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
  time: string;
  total: number;
  note?: string;
  paid?: boolean;
}

interface RestaurantTable {
  id: string;
  area: string;
  is_terrace: boolean;
  waiter_called: boolean;
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

const STATIC_TABLE_IDS = ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10", "T11", "T12"];

type AdminSection = "dashboard" | "products" | "orders" | "tables" | "settings" | "shows";

export function AdminDashboard() {
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [notifications, setNotifications] = useState(0);

  // Table Registry & waiter call states
  const [dbTables, setDbTables] = useState<RestaurantTable[]>([]);

  // Shows manager states
  const [shows, setShows] = useState<Show[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [showShowForm, setShowShowForm] = useState(false);
  const [editingShow, setEditingShow] = useState<Show | null>(null);

  // Hero CMS settings states
  const [heroConfig, setHeroConfig] = useState<any>({
    title1_fr: "Deux Visages.",
    title2_fr: "Une Légende.",
    subtitle_fr: "Saveurs audacieuses rencontrent l'élégance parisienne. Chaque bouchée est un double voyage — l'âme de la rue alliée au savoir-faire gastronomique.",
    title1_en: "Two Faces.",
    title2_en: "One Legend.",
    subtitle_en: "Bold flavors meet Parisian elegance. Every bite is a double experience — street soul with fine dining craft.",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&h=900&fit=crop&auto=format",
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
      if (!error && data && data.length > 0) {
        setHeroConfig(data[0]);
      }
    } catch (err) {
      console.warn("AdminDashboard: could not load hero configuration:", err);
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
      alert("Hero settings saved successfully!");
      loadHeroConfig();
    } catch (err) {
      console.error("Failed to save hero config:", err);
      alert("Failed to save hero config, operating on local simulation.");
    }
  }

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingHero(true);
    try {
      const isMock = !supabase || !supabase.storage || typeof supabase.storage.from !== "function";
      if (isMock) {
        const mockUrl = URL.createObjectURL(file);
        setHeroConfig((p: any) => ({ ...p, image: mockUrl }));
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
      const fileName = `hero-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      if (data?.publicUrl) {
        setHeroConfig((p: any) => ({ ...p, image: data.publicUrl }));
      }
    } catch (err: any) {
      console.error("Hero Image upload failed:", err);
      alert(`Hero Image upload failed: ${err.message || err}`);
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

      if (data) {
        const formatted: Order[] = data.map((o: any) => {
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
            items: o.order_items || []
          };
        });
        setOrders(formatted);
        
        // Count pending orders for badge notifications
        const pendingCount = formatted.filter(o => o.status === "pending").length;
        setNotifications(pendingCount);
      }
    } catch (err) {
      console.warn("Could not load orders from Supabase. Offline mode active.", err);
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

      if (data) {
        const formatted: Product[] = data.map((p: any) => ({
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
      }
    } catch (err) {
      console.warn("Could not load products from Supabase.", err);
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
        setDbTables(data);
      }
    } catch (err) {
      console.warn("Could not load tables registry:", err);
    }
  };

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

  useEffect(() => {
    loadOrders();
    loadProducts();
    loadTables();
    loadShows();
    loadTickets();
    loadHeroConfig();

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

  // Print QR Template
  const printQrCode = (tableId: string, area: string) => {
    const tableUrl = `${window.location.origin}/?table=${tableId}`;
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

  const downloadQrCode = (tableId: string) => {
    const tableUrl = `${window.location.origin}/?table=${tableId}`;
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
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      loadProducts();
    } catch (err) {
      console.error("Failed to delete product:", err);
      setProducts(prev => prev.filter(p => p.id !== id));
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

  async function deleteShow(id: string) {
    if (!confirm("Are you sure you want to delete this show?")) return;
    try {
      const { error } = await supabase
        .from("shows")
        .delete()
        .eq("id", id);
      if (error) throw error;
      loadShows();
    } catch (err) {
      console.error("Failed to delete show:", err);
      setShows(prev => prev.filter(s => s.id !== id));
    }
  }

  // Calculations
  const completedOrders = orders.filter(o => o.status === "delivered");
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const activeOrdersCount = orders.filter(o => o.status !== "delivered").length;
  
  const activeWaiterCalls = dbTables.filter(t => t.waiter_called);

  const tablesToRender = dbTables.length > 0 ? dbTables : STATIC_TABLE_IDS.map(id => ({
    id,
    area: id >= "T07" ? "Terrace Patio" : "Inside Lounge",
    is_terrace: id >= "T07",
    waiter_called: false
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
    { id: "orders" as AdminSection, icon: <ShoppingBag size={16} />, label: "Live Orders Queue", badge: notifications },
    { id: "products" as AdminSection, icon: <Package size={16} />, label: "Menu Forge (CMS)" },
    { id: "tables" as AdminSection, icon: <QrCode size={16} />, label: "Table Registry & QR" },
    { id: "shows" as AdminSection, icon: <Award size={16} />, label: "Shows Manager" },
    { id: "settings" as AdminSection, icon: <Settings size={16} />, label: "Preferences" },
  ];

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

  return (
    <div className="flex h-full bg-[#0A0704] text-white">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 flex flex-col bg-[#120D09] border-r border-[#2A1E15]">
        <div className="px-4 py-4 border-b border-[#2A1E15] flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#C8102E] flex items-center justify-center font-serif font-black text-xs text-white">L</div>
          <div>
            <div className="font-serif font-bold text-xs">Le Double Face</div>
            <div className="font-mono text-[8px] text-[#8E7E70] tracking-widest">KITCHEN WORKSPACE</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
          {navItems.map(item => {
            const active = section === item.id;
            return (
              <button key={item.id} onClick={() => setSection(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded text-xs transition-all relative border cursor-pointer"
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
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 bg-[#120D09] border-b border-[#2A1E15] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#8E7E70] font-mono text-xs uppercase tracking-widest">{section} console</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-[#8E7E70]">SUPABASE STATUS:</span>
            <span className="flex items-center gap-1.5 font-bold text-[#10B981]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> ONLINE
            </span>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto">
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

          {/* 2. LIVE ORDERS PIPELINE */}
          {section === "orders" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(["pending", "preparing", "ready", "delivered"] as const).map(stage => {
                  const stageOrders = orders.filter(o => o.status === stage);
                  return (
                    <div key={stage} className="flex flex-col min-h-[500px] bg-[#120D09]/50 border border-[#2A1E15]/60 rounded-xl p-4">
                      {/* Stage header */}
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2A1E15]">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#E5D5C5]">{stage === "delivered" ? "FULFILLED" : stage.toUpperCase()}</span>
                        <span className="bg-[#1A130E] border border-[#2A1E15] px-2 py-0.5 rounded text-[10px] font-mono text-[#8E7E70]">{stageOrders.length}</span>
                      </div>

                      {/* Stage tickets list */}
                      <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                        {stageOrders.map(order => (
                          <div key={order.id} className="p-4 bg-[#120D09] border border-[#2A1E15] rounded-xl flex flex-col justify-between transition-all hover:border-[#C8102E]/40">
                            <div>
                              <div className="flex justify-between items-start mb-2 pb-2 border-b border-[#2A1E15]/30">
                                <div>
                                  <div className="font-serif font-black text-xs text-white">{order.id}</div>
                                  <div className="font-mono text-[8px] text-[#8E7E70] uppercase mt-0.5">Table {order.table_id} · {order.area}</div>
                                </div>
                                <span className="font-mono text-[9px] text-[#8E7E70]">{order.time}</span>
                              </div>

                              <div className="flex flex-col gap-1.5 mb-4">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="text-xs text-[#E5D5C5]">
                                    <div className="flex justify-between">
                                      <span className="font-bold">{item.quantity}x {item.name}</span>
                                      <span className="font-mono text-[10px] text-[#8E7E70]">€{(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                    {Object.entries(item.customizations).map(([k, v]) => v && (Array.isArray(v) ? v.length > 0 : true) && (
                                      <div key={k} className="text-[10px] text-[#8E7E70] pl-3">
                                        ↳ {Array.isArray(v) ? v.join(", ") : v}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>

                              {order.note && (
                                <div className="p-2 bg-[#1A130E] border border-dashed border-[#2A1E15] text-[10px] text-amber-500 rounded font-mono mb-4">
                                  NOTE: {order.note}
                                </div>
                              )}
                            </div>

                            <div className="pt-2 border-t border-[#2A1E15]/30 flex flex-col gap-2">
                              <div className="flex justify-between items-center text-xs font-mono">
                                <span className="text-[#8E7E70]">Total Bill:</span>
                                <span className="font-bold text-white">€{order.total.toFixed(2)}</span>
                              </div>
                              
                              <div className="flex justify-between items-center text-[10px] font-mono">
                                <span className="text-[#8E7E70]">Payment:</span>
                                <span className={`font-bold ${order.paid ? "text-green-500" : "text-amber-500"}`}>
                                  {order.paid ? "PAID" : "UNPAID"}
                                </span>
                              </div>

                              {/* Operations actions */}
                              <div className="flex gap-2.5 mt-1">
                                {stage !== "delivered" && (
                                  <button onClick={() => advanceOrder(order.id, order.status)}
                                    className="flex-1 py-1.5 bg-[#C8102E] hover:opacity-95 text-white font-bold rounded text-[10px] cursor-pointer">
                                    {stage === "pending" ? "ACCEPT" : stage === "preparing" ? "READY" : "DELIVER"}
                                  </button>
                                )}
                                
                                {stage === "delivered" && !order.paid && (
                                  <button onClick={() => markOrderPaid(order.id)}
                                    className="flex-1 py-1.5 bg-green-700 hover:bg-green-600 text-white font-bold rounded text-[10px] cursor-pointer">
                                    MARK AS PAID
                                  </button>
                                )}
                              </div>
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
                          <button onClick={() => handleDeleteProduct(p.id)}
                            className="p-1 border border-[#2A1E15] hover:bg-red-950/20 text-[#C8102E] rounded cursor-pointer">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. TABLES AND QR MATRIX */}
          {section === "tables" && (
            <div>
              <p className="text-xs text-[#8E7E70] mb-5 font-mono leading-relaxed">
                Scan tabletop QR codes or click them to test guest ordering context in a new window. Active orders light up in red.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {tablesToRender.map(table => {
                  const activeOrder = orders.find(o => o.table_id === table.id && o.status !== "delivered");
                  const tableUrl = `${window.location.origin}/?table=${table.id}`;
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
                            onClick={() => downloadQrCode(table.id)}
                            className="flex-1 py-1 border border-[#2A1E15] hover:bg-[#1A130E] text-[#8E7E70] hover:text-white rounded text-[8px] font-bold cursor-pointer"
                          >
                            DL
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1">SHOW IMAGE LINK</label>
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={editingShow.image}
                          onChange={e => setEditingShow(p => p ? { ...p, image: e.target.value } : null)}
                          placeholder="Paste image link (https://...)"
                          className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                        />
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
                          <button onClick={() => deleteShow(show.id)} className="text-[#C8102E] hover:text-red-500 text-[10px] font-bold cursor-pointer">Delete</button>
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
              <div className="bg-[#120D09] border border-[#2A1E15] p-5 rounded-xl self-start">
                <h3 className="text-xs font-mono tracking-widest text-[#C8102E] mb-5 uppercase">Restaurant Coordinates</h3>
                <div className="flex flex-col gap-4">
                  {[
                    { label: "Vessel Name", value: "Le Double Face Lounge" },
                    { label: "Coordinates/Address", value: "14 Rue du Faubourg Saint-Antoine, Paris" },
                    { label: "Hotline", value: "+33 1 42 74 31 00" },
                    { label: "Operation Slots", value: "Mon–Sun 11:30–23:30" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1.5 uppercase">{f.label}</label>
                      <input
                        defaultValue={f.value}
                        className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                      />
                    </div>
                  ))}
                  <button className="bg-[#C8102E] hover:opacity-90 text-white font-bold py-2 px-4 rounded text-xs self-start mt-2 cursor-pointer">
                    SAVE PREFERENCES
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
                  <div>
                    <label className="text-[10px] font-mono tracking-wider text-[#8E7E70] block mb-1.5 uppercase">Hero Background Image</label>
                    {heroConfig.image ? (
                      <div className="relative h-28 w-full rounded-xl border border-[#2A1E15] overflow-hidden group">
                        <img src={heroConfig.image} alt="Hero Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <label className="cursor-pointer bg-[#C8102E] hover:opacity-90 text-white font-mono text-[9px] font-bold px-2.5 py-1.5 rounded">
                            {uploadingHero ? "UPLOADING..." : "REPLACE IMAGE"}
                            <input type="file" accept="image/*" onChange={handleHeroImageUpload} disabled={uploadingHero} className="hidden" />
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
                        <input type="file" accept="image/*" onChange={handleHeroImageUpload} disabled={uploadingHero} className="hidden" />
                      </label>
                    )}
                    <div className="mt-1.5">
                      <input
                        type="text"
                        value={heroConfig.image}
                        onChange={e => setHeroConfig((p: any) => ({ ...p, image: e.target.value }))}
                        placeholder="Or paste external image URL (https://...)"
                        className="w-full px-2 py-1.5 text-[9px] bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                      />
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
      const isMock = !supabase || !supabase.storage || typeof supabase.storage.from !== "function";
      if (isMock) {
        const mockUrl = URL.createObjectURL(file);
        setForm(p => ({ ...p, image: mockUrl }));
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
      console.error("Image upload failed:", err);
      alert(`Image upload failed: ${err.message || err}. You can still paste an image link or continue offline.`);
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
          {/* Manual URL entry field */}
          <div className="mt-1.5">
            <input
              type="text"
              value={form.image}
              onChange={e => setForm(p => ({ ...p, image: e.target.value }))}
              placeholder="Or paste external image URL (https://...)"
              className="w-full px-2 py-1 text-[9px] bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
            />
          </div>
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
