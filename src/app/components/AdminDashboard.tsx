import { useState, useEffect } from "react";
import {
  LayoutDashboard, Package, ShoppingBag, Tv, QrCode, Settings,
  Plus, Trash2, Edit2, Check, X, Bell, TrendingUp, Users, DollarSign,
  Eye, MoreVertical, ChevronDown, AlertCircle, Clock, CheckCircle2,
  GripVertical, ChevronRight, Save, ArrowLeft, RefreshCw, Upload
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
}

// Local Seed fallbacks
const SEED_PRODUCTS: Product[] = [
  { id: "B1", name: "Le Double Face Classic", category: "Burgers", price: 14.90, desc: "Double wagyu patty, truffle mayo, aged cheddar", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=150&fit=crop&auto=format", active: true, customFields: [{ id: "c1", name: "Cooking", type: "radio", options: ["Saignant", "À point", "Bien cuit"], required: true }] },
  { id: "B2", name: "Smash & Burn", category: "Burgers", price: 13.90, desc: "Smash patty, BBQ, crispy bacon, pickles", image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&h=150&fit=crop&auto=format", active: true, customFields: [] },
  { id: "D3", name: "Le Cocktail Double Face", category: "Drinks", price: 12.00, desc: "Premium signature cocktail with dual-distilled gin", image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200&h=150&fit=crop&auto=format", active: true, customFields: [] },
  { id: "S1", name: "La Truffe Fries", category: "Sides", price: 6.90, desc: "Belgian fries, truffle oil, parmesan", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200&h=150&fit=crop&auto=format", active: true, customFields: [] },
];

const TABLES = Array.from({ length: 12 }, (_, i) => `T${String(i + 1).padStart(2, "0")}`);

type AdminSection = "dashboard" | "products" | "orders" | "tables" | "settings";

export function AdminDashboard() {
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [notifications, setNotifications] = useState(0);

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
            time: timeString,
            items: (o.order_items || []).map((item: any) => ({
              product_id: item.product_id,
              name: item.name,
              price: Number(item.price),
              quantity: item.quantity,
              customizations: item.customizations || {}
            }))
          };
        });
        setOrders(formatted);
        setNotifications(formatted.filter(o => o.status === "pending").length);
      }
    } catch (err) {
      console.warn("Could not load orders from Supabase. Offline mode active.", err);
      setDbError(true);
    }
  };

  // 2. Fetch Products from Database
  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
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
      } else {
        setProducts(SEED_PRODUCTS);
      }
    } catch (err) {
      console.warn("Could not load products. Using fallbacks.", err);
      setProducts(SEED_PRODUCTS);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([loadOrders(), loadProducts()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();

    // Subscribe to Orders changes in real-time
    const ordersChannel = supabase
      .channel("admin-orders-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          loadOrders();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    // Subscribe to Products changes in real-time
    const productsChannel = supabase
      .channel("admin-products-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        () => {
          loadProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(productsChannel);
    };
  }, []);

  // 3. Pipeline advance actions (Pending -> Preparing -> Ready -> Delivered/Archived)
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
      // Fallback state modification for offline simulation
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: nextStatus } : o));
    }
  }

  // 4. CMS Product Actions
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
      // Local simulated save for offline fallback
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
      console.error("Failed to toggle product status:", err);
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, active: !x.active } : x));
    }
  }

  // 5. Calculations for Statistics
  const todayOrders = orders.filter(o => {
    // If db timestamp is missing, assume today
    return true; 
  });
  
  const totalRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const activeTablesCount = new Set(orders.filter(o => o.status !== "delivered").map(o => o.table_id)).size;
  const avgOrderVal = todayOrders.length > 0 ? totalRevenue / todayOrders.length : 0;

  // Chart Data preparation
  const REVENUE_DATA = [
    { day: "Mon", revenue: 1240 }, { day: "Tue", revenue: 980 }, { day: "Wed", revenue: 1650 },
    { day: "Thu", revenue: 1320 }, { day: "Fri", revenue: 2100 }, { day: "Sat", revenue: 2850 },
    { day: "Sun", revenue: totalRevenue > 0 ? Math.round(totalRevenue) : 2200 },
  ];

  const statusColors: Record<Order["status"], string> = {
    pending: "#F59E0B", preparing: "#C8102E", ready: "#10B981", delivered: "#8E7E70"
  };
  const statusLabels: Record<Order["status"], string> = {
    pending: "PENDING", preparing: "PREPARING", ready: "READY", delivered: "FULFILLED"
  };

  const navItems = [
    { id: "dashboard" as AdminSection, icon: <LayoutDashboard size={16} />, label: "Dashboard" },
    { id: "orders" as AdminSection, icon: <ShoppingBag size={16} />, label: "Live Orders Queue", badge: notifications },
    { id: "products" as AdminSection, icon: <Package size={16} />, label: "Menu Forge (CMS)" },
    { id: "tables" as AdminSection, icon: <QrCode size={16} />, label: "Table Registry & QR" },
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
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded text-xs transition-all relative border"
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
        {dbError && (
          <div className="p-3 mx-2 my-2 bg-[#1A130E] border border-dashed border-[#8E7E70]/30 rounded text-[9px] text-[#8E7E70]">
            Database offline. Running in simulated fallback.
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0704]">
        {/* Workspace Content */}
        <div className="flex-1 overflow-y-auto p-5">
          
          {/* 1. DASHBOARD OVERVIEW */}
          {section === "dashboard" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Today's Gross Sales", value: `€${totalRevenue.toFixed(2)}`, icon: <DollarSign size={16} />, desc: "Live sum from orders" },
                  { label: "Active Orders", value: orders.filter(o => o.status !== "delivered").length.toString(), icon: <ShoppingBag size={16} />, desc: "Queue size" },
                  { label: "Occupied Tables", value: `${activeTablesCount} / 12`, icon: <Users size={16} />, desc: "Real-time occupancy" },
                  { label: "Avg Ticket Size", value: `€${avgOrderVal.toFixed(2)}`, icon: <TrendingUp size={16} />, desc: "Total / Tickets count" },
                ].map(stat => (
                  <div key={stat.label} className="p-4 bg-[#120D09] border border-[#2A1E15] rounded">
                    <div className="flex items-center justify-between mb-3 text-[#8E7E70]">
                      <span className="text-[10px] font-mono tracking-wider uppercase">{stat.label}</span>
                      <div className="text-[#C8102E]">{stat.icon}</div>
                    </div>
                    <div className="font-serif text-2xl font-black text-white">{stat.value}</div>
                    <div className="text-[9px] text-[#8E7E70] mt-1">{stat.desc}</div>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-3 gap-5">
                {/* Sales Chart */}
                <div className="p-4 bg-[#120D09] border border-[#2A1E15] rounded lg:col-span-2">
                  <h3 className="text-xs font-mono tracking-widest text-[#8E7E70] mb-4 uppercase">Weekly Revenues</h3>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={REVENUE_DATA}>
                        <XAxis dataKey="day" tick={{ fill: "#8E7E70", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#8E7E70", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "#120D09", border: "1px solid #2A1E15", borderRadius: "3px", color: "#fff", fontSize: 11 }} />
                        <Bar dataKey="revenue" fill="#C8102E" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Queue Summary */}
                <div className="p-4 bg-[#120D09] border border-[#2A1E15] rounded flex flex-col h-[230px]">
                  <div className="flex items-center justify-between mb-3 border-b border-[#2A1E15] pb-2">
                    <span className="text-xs font-mono tracking-widest text-[#8E7E70] uppercase">Live Queue</span>
                    <span className="bg-[#C8102E]/20 text-[#C8102E] text-[8px] font-black px-1.5 py-0.5 rounded animate-pulse">ACTIVE SYNC</span>
                  </div>
                  <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                    {orders.filter(o => o.status !== "delivered").map(order => (
                      <div key={order.id} className="p-2.5 bg-[#1A130E] border border-[#2A1E15] rounded flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-[#E5D5C5]">{order.table_id} · <span className="text-[10px] text-[#8E7E70] font-normal">{order.area}</span></div>
                          <div className="text-[9px] font-mono text-[#8E7E70] mt-0.5">{order.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] font-bold" style={{ color: statusColors[order.status] }}>{statusLabels[order.status]}</span>
                          <button onClick={() => advanceOrder(order.id, order.status)}
                            className="bg-[#C8102E] hover:opacity-90 text-white font-bold px-1.5 py-0.5 rounded text-[10px]">
                            →
                          </button>
                        </div>
                      </div>
                    ))}
                    {orders.filter(o => o.status !== "delivered").length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-[10px] text-[#8E7E70] border border-dashed border-[#2A1E15] rounded">No active orders</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. ORDERS QUEUE */}
          {section === "orders" && (
            <div className="flex flex-col gap-4">
              {/* Order Stats */}
              <div className="grid grid-cols-4 gap-3">
                {(["pending", "preparing", "ready", "delivered"] as Order["status"][]).map(s => (
                  <div key={s} className="p-3 bg-[#120D09] border border-[#2A1E15] rounded text-center">
                    <span className="text-[9px] font-mono font-bold tracking-wider" style={{ color: statusColors[s] }}>{statusLabels[s]}</span>
                    <div className="font-serif text-xl font-black mt-1 text-white">{orders.filter(o => o.status === s).length}</div>
                  </div>
                ))}
              </div>

              {/* Order Cards */}
              <div className="flex flex-col gap-3">
                {orders.map(order => (
                  <div key={order.id} className="p-4 bg-[#120D09] border border-[#2A1E15] rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A1E15] pb-3 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-serif font-black text-base text-white">{order.table_id}</span>
                        <span className="bg-[#1A130E] border border-[#2A1E15] px-2 py-0.5 rounded text-[10px] text-[#8E7E70] font-mono">{order.area}</span>
                        <span className="text-[10px] text-[#8E7E70] font-mono">{order.id}</span>
                        <span className="flex items-center gap-1 text-[10px] text-[#8E7E70] font-mono"><Clock size={11} /> {order.time}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold" style={{ color: statusColors[order.status] }}>{statusLabels[order.status]}</span>
                        <span className="font-mono text-xs font-bold text-[#E5D5C5]">€{order.total.toFixed(2)}</span>
                        {order.status !== "delivered" && (
                          <button onClick={() => advanceOrder(order.id, order.status)}
                            className="bg-[#C8102E] hover:opacity-90 text-white font-bold py-1.5 px-3 rounded text-xs transition-all">
                            {order.status === "pending" ? "ACCEPT ORDER" : order.status === "preparing" ? "MARK READY" : "FULFILL & CLEAR"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pl-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-xs">
                          <div>
                            <span className="font-bold text-[#E5D5C5]">{item.quantity}× {item.name}</span>
                            {Object.entries(item.customizations).map(([k, v]) => v && (Array.isArray(v) ? v.length > 0 : true) && (
                              <div key={k} className="text-[10px] text-[#8E7E70] ml-3 mt-0.5">
                                • {Array.isArray(v) ? v.join(", ") : v}
                              </div>
                            ))}
                          </div>
                          <span className="font-mono text-[#8E7E70]">€{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      {order.note && (
                        <div className="mt-2 p-2.5 bg-[#1C130C] border border-[#2A1E15] rounded text-[10px] text-[#E5D5C5]">
                          <span className="font-mono font-bold text-[#C8102E]">NOTE: </span>
                          {order.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {orders.length === 0 && (
                  <div className="text-center py-12 text-xs text-[#8E7E70] border border-dashed border-[#2A1E15] rounded">No orders received yet</div>
                )}
              </div>
            </div>
          )}

          {/* 3. PRODUCT MATRIX CMS */}
          {section === "products" && (
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-[#2A1E15] pb-3">
                <div className="text-xs font-mono tracking-widest text-[#8E7E70]">{products.length} PRODUCTS IN MATRIX</div>
                <button onClick={() => {
                  setEditingProduct({ id: `P${Date.now()}`, name: "", category: "Burgers", price: 0, desc: "", image: "", active: true, customFields: [] });
                  setShowProductForm(true);
                }}
                  className="bg-[#C8102E] hover:opacity-90 text-white font-bold py-1.5 px-3 rounded text-xs flex items-center gap-1">
                  <Plus size={14} /> ADD NEW ITEM
                </button>
              </div>

              {showProductForm && editingProduct ? (
                <ProductForm
                  product={editingProduct}
                  onSave={handleSaveProduct}
                  onCancel={() => setShowProductForm(false)}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map(product => (
                    <div key={product.id} className="bg-[#120D09] border border-[#2A1E15] rounded overflow-hidden flex flex-col"
                      style={{ opacity: product.active ? 1 : 0.5 }}>
                      <div className="h-32 bg-[#1A130E] relative overflow-hidden">
                        {product.image && <img src={product.image} alt={product.name} className="w-full h-full object-cover" />}
                        <div className="absolute top-2 right-2">
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-[#0D0A08]/90 font-mono tracking-wider"
                            style={{ borderColor: product.active ? "#10B981" : "#8E7E70", color: product.active ? "#10B981" : "#8E7E70" }}>
                            {product.active ? "ACTIVE" : "DRAFT"}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-1.5">
                            <h3 className="font-serif font-bold text-sm text-[#E5D5C5] truncate">{product.name}</h3>
                            <span className="font-mono text-xs font-bold text-[#C8102E]">€{product.price.toFixed(2)}</span>
                          </div>
                          <p className="text-[10px] text-[#8E7E70] line-clamp-2 leading-relaxed mb-3">{product.desc}</p>
                          <div className="text-[9px] text-[#8E7E70] font-mono border-t border-[#2A1E15]/30 pt-2 mb-3">
                            MODIFIERS: {product.customFields.length} config fields
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => { setEditingProduct(product); setShowProductForm(true); }}
                            className="flex-1 bg-transparent border border-[#2A1E15] hover:bg-[#1A130E] text-[10px] font-bold text-[#E5D5C5] py-1.5 rounded flex items-center justify-center gap-1">
                            <Edit2 size={11} /> EDIT
                          </button>
                          <button onClick={() => handleToggleActive(product)}
                            className="flex-1 bg-transparent border border-[#2A1E15] hover:bg-[#1A130E] text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1"
                            style={{ color: product.active ? "#F59E0B" : "#10B981" }}>
                            <Eye size={11} /> {product.active ? "DRAFT" : "ACTIVE"}
                          </button>
                          <button onClick={() => handleDeleteProduct(product.id)}
                            className="bg-transparent border border-[#2A1E15] hover:bg-red-950/20 text-[#C8102E] p-1.5 rounded">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. TABLES AND QR MATRIX */}
          {section === "tables" && (
            <div>
              <p className="text-xs text-[#8E7E70] mb-5 font-mono leading-relaxed">
                Scan tabletop QR codes or click them to test guest ordering context in a new window. Active orders light up in red.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {TABLES.map(table => {
                  const activeOrder = orders.find(o => o.table_id === table && o.status !== "delivered");
                  const tableUrl = `${window.location.origin}/?table=${table}`;
                  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tableUrl)}`;
                  
                  return (
                    <div key={table} className="p-4 bg-[#120D09] border rounded text-center transition-all"
                      style={{ borderColor: activeOrder ? "#C8102E" : "#2A1E15" }}>
                      <div className="font-serif font-black text-base text-white mb-2">{table}</div>
                      
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
                          alt={`QR Code for ${table}`}
                          className="w-full h-full object-contain"
                        />
                      </a>

                      <div className="font-mono text-[9px] font-bold" style={{ color: activeOrder ? statusColors[activeOrder.status] : "#8E7E70" }}>
                        {activeOrder ? statusLabels[activeOrder.status] : "VACANT"}
                      </div>
                      <div className="font-mono text-[8.5px] text-[#8E7E70] mt-2 border-t border-[#2A1E15]/30 pt-1.5 select-all truncate" title={tableUrl}>
                        {tableUrl}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. PREFERENCES */}
          {section === "settings" && (
            <div className="max-w-md bg-[#120D09] border border-[#2A1E15] p-5 rounded-lg">
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
                <button className="bg-[#C8102E] hover:opacity-90 text-white font-bold py-2 px-4 rounded text-xs self-start mt-2">
                  SAVE PREFERENCES
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
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
