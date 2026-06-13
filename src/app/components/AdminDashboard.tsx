import { useState } from "react";
import {
  LayoutDashboard, Package, ShoppingBag, Tv, QrCode, Settings, LogOut,
  Plus, Trash2, Edit2, Check, X, Bell, TrendingUp, Users, DollarSign,
  Eye, MoreVertical, ChevronDown, AlertCircle, Clock, CheckCircle2,
  GripVertical, ChevronRight, Save, ArrowLeft
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

// — Types
interface CustomField { id: string; name: string; type: "radio" | "checkbox" | "text"; options: string[]; required: boolean; }
interface Product { id: string; name: string; category: string; price: number; desc: string; image: string; active: boolean; customFields: CustomField[]; }
interface Order { id: string; table: string; items: { name: string; qty: number; price: number; note?: string }[]; status: "pending" | "preparing" | "ready" | "delivered"; time: string; total: number; }
interface Show { id: string; title: string; date: string; time: string; chef: string; seats: number; booked: number; }

// — Seed data
const SEED_PRODUCTS: Product[] = [
  { id: "p1", name: "Le Double Face Classic", category: "Burgers", price: 14.90, desc: "Double wagyu patty, truffle mayo, aged cheddar", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=150&fit=crop&auto=format", active: true, customFields: [{ id: "cf1", name: "Cooking", type: "radio", options: ["Saignant", "À point", "Bien cuit"], required: true }] },
  { id: "p2", name: "Smash & Burn", category: "Burgers", price: 13.90, desc: "Smash patty, BBQ, crispy bacon, pickles", image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&h=150&fit=crop&auto=format", active: true, customFields: [] },
  { id: "p3", name: "La Truffe Fries", category: "Sides", price: 6.90, desc: "Belgian fries, truffle oil, parmesan", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200&h=150&fit=crop&auto=format", active: true, customFields: [{ id: "cf2", name: "Size", type: "radio", options: ["Regular", "Large (+€2)"], required: true }] },
  { id: "p4", name: "Double Shake Vanille", category: "Drinks", price: 7.50, desc: "Thick premium vanilla milkshake", image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=200&h=150&fit=crop&auto=format", active: false, customFields: [] },
];

const SEED_ORDERS: Order[] = [
  { id: "ORD-A1B2", table: "T03", items: [{ name: "Le Double Face Classic", qty: 2, price: 14.90 }, { name: "La Truffe Fries", qty: 1, price: 6.90 }], status: "pending", time: "12:34", total: 36.70 },
  { id: "ORD-C3D4", table: "T07", items: [{ name: "Smash & Burn", qty: 1, price: 13.90 }, { name: "Double Shake Vanille", qty: 2, price: 7.50 }], status: "preparing", time: "12:28", total: 28.90 },
  { id: "ORD-E5F6", table: "T01", items: [{ name: "Le Double Face Classic", qty: 3, price: 14.90 }], status: "ready", time: "12:20", total: 44.70 },
  { id: "ORD-G7H8", table: "T11", items: [{ name: "La Truffe Fries", qty: 2, price: 6.90 }], status: "delivered", time: "12:10", total: 13.80 },
];

const SEED_SHOWS: Show[] = [
  { id: "s1", title: "Burger Masterclass", date: "2026-06-14", time: "19:00", chef: "Chef Marc Dupont", seats: 20, booked: 16 },
  { id: "s2", title: "French Street Food", date: "2026-06-21", time: "19:30", chef: "Chef Amara Diallo", seats: 24, booked: 24 },
  { id: "s3", title: "Smash Session Live", date: "2026-06-28", time: "20:00", chef: "Chef Marc Dupont", seats: 20, booked: 8 },
];

const REVENUE_DATA = [
  { day: "Mon", revenue: 1240 }, { day: "Tue", revenue: 980 }, { day: "Wed", revenue: 1650 },
  { day: "Thu", revenue: 1320 }, { day: "Fri", revenue: 2100 }, { day: "Sat", revenue: 2850 }, { day: "Sun", revenue: 2200 },
];

const TABLES = Array.from({ length: 12 }, (_, i) => `T${String(i + 1).padStart(2, "0")}`);

type AdminSection = "dashboard" | "products" | "orders" | "shows" | "tables" | "settings";

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>(SEED_ORDERS);
  const [shows, setShows] = useState<Show[]>(SEED_SHOWS);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showShowForm, setShowShowForm] = useState(false);
  const [newShow, setNewShow] = useState({ title: "", date: "", time: "", chef: "", seats: 20 });
  const [notifications] = useState(orders.filter(o => o.status === "pending").length);

  function advanceOrder(id: string) {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      const next: Order["status"][] = ["pending", "preparing", "ready", "delivered"];
      const idx = next.indexOf(o.status);
      return { ...o, status: next[Math.min(idx + 1, 3)] };
    }));
  }

  const navItems = [
    { id: "dashboard" as AdminSection, icon: <LayoutDashboard size={18} />, label: "Dashboard" },
    { id: "orders" as AdminSection, icon: <ShoppingBag size={18} />, label: "Orders", badge: notifications },
    { id: "products" as AdminSection, icon: <Package size={18} />, label: "Products" },
    { id: "shows" as AdminSection, icon: <Tv size={18} />, label: "Live Shows" },
    { id: "tables" as AdminSection, icon: <QrCode size={18} />, label: "Tables & QR" },
    { id: "settings" as AdminSection, icon: <Settings size={18} />, label: "Settings" },
  ];

  const statusColors: Record<Order["status"], string> = {
    pending: "#f59e0b", preparing: "var(--primary)", ready: "#10b981", delivered: "var(--muted-foreground)"
  };
  const statusLabels: Record<Order["status"], string> = {
    pending: "PENDING", preparing: "PREPARING", ready: "READY", delivered: "DELIVERED"
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--background)", fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0 flex flex-col" style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}>
        <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--primary)" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: "12px", color: "#fff" }}>LF</span>
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "13px", color: "var(--sidebar-foreground)" }}>Le Double Face</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--sidebar-accent-foreground)", letterSpacing: "0.08em" }}>ADMIN PANEL</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map(item => {
            const active = section === item.id;
            return (
              <button key={item.id} onClick={() => setSection(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all relative"
                style={{
                  background: active ? "rgba(200,16,46,0.15)" : "transparent",
                  color: active ? "var(--primary)" : "var(--muted-foreground)",
                  borderRadius: "var(--radius)",
                  fontSize: "13px",
                  fontWeight: active ? 700 : 500,
                  border: active ? "1px solid rgba(200,16,46,0.2)" : "1px solid transparent",
                }}>
                {item.icon}
                {item.label}
                {item.badge ? (
                  <span className="ml-auto flex items-center justify-center w-5 h-5 text-xs font-bold"
                    style={{ background: "var(--primary)", color: "#fff", borderRadius: "50%" }}>{item.badge}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-4">
          <button onClick={onBack}
            className="w-full flex items-center gap-3 px-3 py-2.5 transition-all"
            style={{ color: "var(--muted-foreground)", borderRadius: "var(--radius)", fontSize: "13px", border: "1px solid var(--border)" }}>
            <ArrowLeft size={16} /> Back to Site
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.3rem", color: "var(--foreground)" }}>
            {navItems.find(n => n.id === section)?.label}
          </h1>
          <div className="flex items-center gap-3">
            <button className="relative p-2" style={{ color: "var(--muted-foreground)" }}>
              <Bell size={20} />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-xs font-bold"
                  style={{ background: "var(--primary)", color: "#fff", borderRadius: "50%" }}>{notifications}</span>
              )}
            </button>
            <div className="px-3 py-1.5 flex items-center gap-2" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "13px", color: "var(--foreground)" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--primary)", fontSize: "10px", color: "#fff", fontWeight: 700 }}>A</div>
              Admin
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* DASHBOARD */}
          {section === "dashboard" && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Today's Revenue", value: "€2,847", icon: <DollarSign size={18} />, change: "+12%" },
                  { label: "Orders Today", value: "43", icon: <ShoppingBag size={18} />, change: "+8%" },
                  { label: "Tables Active", value: "9 / 12", icon: <Users size={18} />, change: "" },
                  { label: "Avg. Order", value: "€34.20", icon: <TrendingUp size={18} />, change: "+5%" },
                ].map(stat => (
                  <div key={stat.label} className="p-5" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                    <div className="flex items-center justify-between mb-4">
                      <span style={{ fontSize: "12px", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>{stat.label.toUpperCase()}</span>
                      <div style={{ color: "var(--accent)" }}>{stat.icon}</div>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 800, color: "var(--foreground)" }}>{stat.value}</div>
                    {stat.change && <div style={{ fontSize: "12px", color: "#10b981", marginTop: "4px" }}>{stat.change} vs yesterday</div>}
                  </div>
                ))}
              </div>
              <div className="grid lg:grid-cols-2 gap-6 mb-8">
                <div className="p-5" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "14px", color: "var(--foreground)", marginBottom: "20px" }}>Weekly Revenue</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={REVENUE_DATA}>
                      <XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)" }} />
                      <Bar dataKey="revenue" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="p-5" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 style={{ fontWeight: 700, fontSize: "14px", color: "var(--foreground)" }}>Live Orders</h3>
                    <span className="px-2 py-0.5" style={{ background: "rgba(200,16,46,0.15)", color: "var(--primary)", fontSize: "11px", fontWeight: 700, borderRadius: "2px" }}>LIVE</span>
                  </div>
                  <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "200px" }}>
                    {orders.filter(o => o.status !== "delivered").map(order => (
                      <div key={order.id} className="flex items-center justify-between px-3 py-2"
                        style={{ background: "var(--secondary)", borderRadius: "var(--radius)", fontSize: "13px" }}>
                        <div>
                          <span style={{ fontWeight: 700, color: "var(--foreground)" }}>{order.table}</span>
                          <span style={{ color: "var(--muted-foreground)", marginLeft: "8px" }}>{order.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", letterSpacing: "0.08em", color: statusColors[order.status] }}>{statusLabels[order.status]}</span>
                          <button onClick={() => advanceOrder(order.id)}
                            className="px-2 py-0.5 text-xs transition-all"
                            style={{ background: "var(--primary)", color: "#fff", borderRadius: "2px", fontWeight: 700 }}>
                            →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ORDERS */}
          {section === "orders" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-4 gap-3 mb-2">
                {(["pending", "preparing", "ready", "delivered"] as Order["status"][]).map(s => (
                  <div key={s} className="px-4 py-2 text-center"
                    style={{ background: "var(--card)", border: `1px solid ${statusColors[s]}22`, borderRadius: "var(--radius)" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: statusColors[s], letterSpacing: "0.1em" }}>{statusLabels[s]}</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.4rem", color: "var(--foreground)" }}>
                      {orders.filter(o => o.status === s).length}
                    </div>
                  </div>
                ))}
              </div>
              {orders.map(order => (
                <div key={order.id} className="p-4" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.1rem", color: "var(--foreground)" }}>{order.table}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--muted-foreground)" }}>{order.id}</span>
                      <span className="flex items-center gap-1" style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                        <Clock size={12} /> {order.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: "11px", letterSpacing: "0.1em", fontWeight: 700, color: statusColors[order.status] }}>{statusLabels[order.status]}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "var(--accent)" }}>€{order.total.toFixed(2)}</span>
                      {order.status !== "delivered" && (
                        <button onClick={() => advanceOrder(order.id)}
                          className="px-3 py-1.5 text-xs transition-all hover:opacity-90"
                          style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700 }}>
                          {order.status === "pending" ? "START" : order.status === "preparing" ? "READY" : "DELIVER"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between" style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>
                        <span>{item.qty}× {item.name}</span>
                        <span style={{ fontFamily: "'DM Mono', monospace" }}>€{(item.qty * item.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PRODUCTS */}
          {section === "products" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>{products.length} products</div>
                <button onClick={() => { setEditingProduct({ id: `p${Date.now()}`, name: "", category: "Burgers", price: 0, desc: "", image: "", active: true, customFields: [] }); setShowProductForm(true); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm transition-all hover:opacity-90"
                  style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700 }}>
                  <Plus size={16} /> Add Product
                </button>
              </div>

              {showProductForm && editingProduct ? (
                <ProductForm
                  product={editingProduct}
                  onSave={(p) => { setProducts(prev => prev.some(x => x.id === p.id) ? prev.map(x => x.id === p.id ? p : x) : [...prev, p]); setShowProductForm(false); }}
                  onCancel={() => setShowProductForm(false)}
                />
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map(product => (
                    <div key={product.id} className="overflow-hidden"
                      style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", opacity: product.active ? 1 : 0.6 }}>
                      <div className="relative h-36 overflow-hidden bg-secondary">
                        {product.image && <img src={product.image} alt={product.name} className="w-full h-full object-cover" />}
                        <div className="absolute top-2 right-2">
                          <div className="px-2 py-0.5" style={{ background: product.active ? "rgba(16,185,129,0.15)" : "rgba(150,150,150,0.15)", border: `1px solid ${product.active ? "#10b981" : "#666"}`, borderRadius: "2px" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: product.active ? "#10b981" : "#999" }}>{product.active ? "ACTIVE" : "DRAFT"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "0.95rem", color: "var(--foreground)" }}>{product.name}</h3>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "var(--accent)", fontSize: "0.9rem" }}>€{product.price.toFixed(2)}</span>
                        </div>
                        <p style={{ fontSize: "12px", color: "var(--muted-foreground)", marginBottom: "12px", lineHeight: 1.5 }}>{product.desc}</p>
                        <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginBottom: "12px" }}>
                          {product.customFields.length} custom field{product.customFields.length !== 1 ? "s" : ""}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingProduct(product); setShowProductForm(true); }}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs transition-all"
                            style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)", borderRadius: "var(--radius)", fontWeight: 600 }}>
                            <Edit2 size={12} /> Edit
                          </button>
                          <button onClick={() => setProducts(prev => prev.map(p => p.id === product.id ? { ...p, active: !p.active } : p))}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs transition-all"
                            style={{ border: "1px solid var(--border)", color: product.active ? "#f59e0b" : "#10b981", borderRadius: "var(--radius)", fontWeight: 600 }}>
                            <Eye size={12} /> {product.active ? "Hide" : "Show"}
                          </button>
                          <button onClick={() => setProducts(prev => prev.filter(p => p.id !== product.id))}
                            className="p-1.5 transition-all"
                            style={{ border: "1px solid var(--border)", color: "var(--destructive)", borderRadius: "var(--radius)" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SHOWS */}
          {section === "shows" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>{shows.length} scheduled shows</div>
                <button onClick={() => setShowShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm transition-all hover:opacity-90"
                  style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700 }}>
                  <Plus size={16} /> Add Show
                </button>
              </div>
              {showShowForm && (
                <div className="mb-6 p-5" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "14px", color: "var(--foreground)", marginBottom: "16px" }}>New Live Show</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {[
                      { key: "title", label: "Show Title", placeholder: "Burger Masterclass" },
                      { key: "chef", label: "Chef Name", placeholder: "Chef Marc Dupont" },
                      { key: "date", label: "Date", placeholder: "", type: "date" },
                      { key: "time", label: "Time", placeholder: "", type: "time" },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px" }}>{f.label}</label>
                        <input
                          type={f.type || "text"}
                          value={(newShow as any)[f.key]}
                          onChange={e => setNewShow(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2 text-sm"
                          style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)", outline: "none" }}
                        />
                      </div>
                    ))}
                    <div>
                      <label style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px" }}>Available Seats</label>
                      <input
                        type="number"
                        value={newShow.seats}
                        onChange={e => setNewShow(p => ({ ...p, seats: Number(e.target.value) }))}
                        className="w-full px-3 py-2 text-sm"
                        style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)", outline: "none" }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShows(p => [...p, { id: `s${Date.now()}`, ...newShow, booked: 0 }]); setShowShowForm(false); setNewShow({ title: "", date: "", time: "", chef: "", seats: 20 }); }}
                      className="px-4 py-2 text-sm transition-all"
                      style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700 }}>
                      Save Show
                    </button>
                    <button onClick={() => setShowShowForm(false)}
                      className="px-4 py-2 text-sm"
                      style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)", borderRadius: "var(--radius)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-4">
                {shows.map(show => (
                  <div key={show.id} className="flex items-center justify-between p-4"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                    <div>
                      <h3 style={{ fontWeight: 700, fontSize: "15px", color: "var(--foreground)", marginBottom: "2px" }}>{show.title}</h3>
                      <div style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>
                        {show.chef} · {show.date} at {show.time}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: "14px", color: "var(--foreground)" }}>
                          {show.booked} / {show.seats}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>seats booked</div>
                        <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ width: "80px", background: "var(--border)" }}>
                          <div className="h-full rounded-full" style={{ width: `${(show.booked / show.seats) * 100}%`, background: show.booked >= show.seats ? "var(--primary)" : "var(--accent)" }} />
                        </div>
                      </div>
                      <button onClick={() => setShows(p => p.filter(s => s.id !== show.id))}
                        style={{ color: "var(--muted-foreground)" }} className="hover:text-destructive transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TABLES & QR */}
          {section === "tables" && (
            <div>
              <p style={{ fontSize: "13px", color: "var(--muted-foreground)", marginBottom: "24px" }}>
                Each table has a unique QR code. Customers scan it to open the ordering interface directly for their table.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {TABLES.map(table => {
                  const activeOrder = orders.find(o => o.table === table && o.status !== "delivered");
                  return (
                    <div key={table} className="p-4 text-center"
                      style={{ background: "var(--card)", border: activeOrder ? "1px solid rgba(200,16,46,0.4)" : "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.3rem", color: "var(--foreground)", marginBottom: "8px" }}>{table}</div>
                      <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center" style={{ background: "var(--secondary)", borderRadius: "var(--radius)" }}>
                        <QrCode size={32} style={{ color: activeOrder ? "var(--primary)" : "var(--muted-foreground)" }} />
                      </div>
                      {activeOrder ? (
                        <div style={{ fontSize: "11px", fontWeight: 700, color: statusColors[activeOrder.status], letterSpacing: "0.08em" }}>{statusLabels[activeOrder.status]}</div>
                      ) : (
                        <div style={{ fontSize: "11px", color: "var(--muted-foreground)", letterSpacing: "0.08em" }}>AVAILABLE</div>
                      )}
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--muted-foreground)", marginTop: "4px" }}>
                        ?table={table}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {section === "settings" && (
            <div className="max-w-lg">
              <div className="flex flex-col gap-4">
                {[
                  { label: "Restaurant Name", value: "Le Double Face" },
                  { label: "Address", value: "14 Rue du Faubourg Saint-Antoine, Paris" },
                  { label: "Phone", value: "+33 1 42 74 31 00" },
                  { label: "Opening Hours", value: "Mon–Sun 11:30–23:30" },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px", letterSpacing: "0.06em" }}>{f.label.toUpperCase()}</label>
                    <input
                      defaultValue={f.value}
                      className="w-full px-4 py-3 text-sm"
                      style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)", outline: "none" }}
                    />
                  </div>
                ))}
                <button className="flex items-center gap-2 px-5 py-3 text-sm self-start transition-all hover:opacity-90"
                  style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700 }}>
                  <Save size={16} /> Save Settings
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// Product form with custom fields builder
function ProductForm({ product, onSave, onCancel }: { product: Product; onSave: (p: Product) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Product>({ ...product });
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"radio" | "checkbox" | "text">("radio");
  const [newOption, setNewOption] = useState<Record<string, string>>({});

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
    <div className="p-6" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.1rem", color: "var(--foreground)", marginBottom: "20px" }}>
        {form.name || "New Product"}
      </h3>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {[
          { key: "name", label: "Product Name", placeholder: "Le Double Face Classic" },
          { key: "category", label: "Category", placeholder: "Burgers" },
          { key: "price", label: "Price (€)", placeholder: "14.90", type: "number" },
          { key: "image", label: "Image URL", placeholder: "https://..." },
        ].map(f => (
          <div key={f.key}>
            <label style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px" }}>{f.label}</label>
            <input
              type={f.type || "text"}
              value={(form as any)[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 text-sm"
              style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)", outline: "none" }}
            />
          </div>
        ))}
        <div className="md:col-span-2">
          <label style={{ fontSize: "12px", color: "var(--muted-foreground)", display: "block", marginBottom: "4px" }}>Description</label>
          <textarea
            value={form.desc}
            onChange={e => setForm(p => ({ ...p, desc: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 text-sm resize-none"
            style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)", outline: "none" }}
          />
        </div>
        <div className="flex items-center gap-3">
          <label style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>Active</label>
          <button onClick={() => setForm(p => ({ ...p, active: !p.active }))}
            className="w-10 h-6 relative transition-all"
            style={{ background: form.active ? "var(--primary)" : "var(--border)", borderRadius: "12px" }}>
            <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: form.active ? "20px" : "4px" }} />
          </button>
        </div>
      </div>

      {/* Custom Fields */}
      <div className="mb-6">
        <h4 style={{ fontWeight: 700, fontSize: "13px", color: "var(--foreground)", marginBottom: "12px" }}>
          Custom Fields ({form.customFields.length})
        </h4>
        <div className="flex flex-col gap-4 mb-4">
          {form.customFields.map(field => (
            <div key={field.id} className="p-4" style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--foreground)" }}>{field.name}</span>
                  <span style={{ fontSize: "10px", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: "2px", padding: "1px 6px", letterSpacing: "0.06em" }}>{field.type.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setForm(p => ({ ...p, customFields: p.customFields.map(f => f.id === field.id ? { ...f, required: !f.required } : f) }))}
                    className="px-2 py-0.5 text-xs"
                    style={{ border: "1px solid var(--border)", color: field.required ? "var(--primary)" : "var(--muted-foreground)", borderRadius: "2px", fontWeight: 700 }}>
                    {field.required ? "REQUIRED" : "OPTIONAL"}
                  </button>
                  <button onClick={() => setForm(p => ({ ...p, customFields: p.customFields.filter(f => f.id !== field.id) }))}
                    style={{ color: "var(--muted-foreground)" }}>
                    <X size={14} />
                  </button>
                </div>
              </div>
              {field.type !== "text" && (
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {field.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-1 px-2 py-1 text-xs"
                        style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "2px", color: "var(--foreground)" }}>
                        {opt}
                        <button onClick={() => setForm(p => ({ ...p, customFields: p.customFields.map(f => f.id === field.id ? { ...f, options: f.options.filter((_, idx) => idx !== i) } : f) }))}
                          style={{ color: "var(--muted-foreground)", marginLeft: "2px" }}>
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newOption[field.id] || ""}
                      onChange={e => setNewOption(p => ({ ...p, [field.id]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && addOption(field.id)}
                      placeholder="Add option..."
                      className="flex-1 px-3 py-1.5 text-xs"
                      style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)", outline: "none" }}
                    />
                    <button onClick={() => addOption(field.id)}
                      className="px-3 py-1.5 text-xs"
                      style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700 }}>
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newFieldName}
            onChange={e => setNewFieldName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addField()}
            placeholder="Field name (e.g. Cooking, Size...)"
            className="flex-1 px-3 py-2 text-sm"
            style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)", outline: "none" }}
          />
          <select value={newFieldType} onChange={e => setNewFieldType(e.target.value as any)}
            className="px-3 py-2 text-sm"
            style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)", outline: "none" }}>
            <option value="radio">Radio (single)</option>
            <option value="checkbox">Checkbox (multi)</option>
            <option value="text">Text input</option>
          </select>
          <button onClick={addField}
            className="flex items-center gap-1 px-3 py-2 text-sm"
            style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--accent)", borderRadius: "var(--radius)", fontWeight: 700 }}>
            <Plus size={14} /> Add Field
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => onSave(form)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm transition-all hover:opacity-90"
          style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700 }}>
          <Save size={15} /> Save Product
        </button>
        <button onClick={onCancel}
          className="px-5 py-2.5 text-sm"
          style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)", borderRadius: "var(--radius)" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
