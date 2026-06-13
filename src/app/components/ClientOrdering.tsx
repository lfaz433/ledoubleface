import { useState, useEffect } from "react";
import { ShoppingCart, Plus, Minus, X, ChevronLeft, Check, Clock, Flame, Star, Search, AlertCircle } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

const MENU_DATA = [
  { id: "B1", name: "Le Double Face Classic", price: 14.90, category: "Burgers", desc: "Double wagyu patty, truffle mayo, aged cheddar, lettuce, tomato, brioche bun", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop&auto=format", popular: true, customFields: [
    { id: "c1", name: "Cooking", type: "radio", options: ["Saignant", "À point", "Bien cuit"], required: true },
    { id: "c2", name: "Extras", type: "checkbox", options: ["Extra cheese (+€1)", "Extra patty (+€3)", "Bacon (+€2)"], required: false },
    { id: "c3", name: "Sauce", type: "radio", options: ["Truffle Mayo", "BBQ", "Sriracha", "None"], required: false },
  ]},
  { id: "B2", name: "Smash & Burn", price: 13.90, category: "Burgers", desc: "Smash patty, caramelized onion, smoky BBQ, crispy bacon, pickles", image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=300&fit=crop&auto=format", popular: true, customFields: [
    { id: "c1", name: "Cooking", type: "radio", options: ["Saignant", "À point", "Bien cuit"], required: true },
    { id: "c3", name: "Sauce", type: "radio", options: ["BBQ", "Mustard", "Mayo", "None"], required: false },
  ]},
  { id: "C1", name: "Crispy Royal Chicken", price: 12.50, category: "Chicken", desc: "Crispy buttermilk chicken, pickled jalapeños, garlic aioli, coleslaw", image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop&auto=format", popular: false, customFields: [
    { id: "c4", name: "Heat Level", type: "radio", options: ["Mild", "Medium", "Hot", "Extra Hot"], required: true },
  ]},
  { id: "S1", name: "La Truffe Fries", price: 6.90, category: "Sides", desc: "Belgian fries, black truffle oil, parmesan, fresh herbs", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop&auto=format", popular: true, customFields: [
    { id: "c5", name: "Size", type: "radio", options: ["Regular", "Large (+€2)"], required: true },
  ]},
  { id: "S2", name: "Onion Rings", price: 5.50, category: "Sides", desc: "Beer-battered onion rings, spicy dipping sauce", image: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&h=300&fit=crop&auto=format", popular: false, customFields: [] },
  { id: "D1", name: "Double Shake Vanille", price: 7.50, category: "Drinks", desc: "Thick premium vanilla milkshake, Madagascar vanilla", image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop&auto=format", popular: false, customFields: [
    { id: "c6", name: "Size", type: "radio", options: ["Regular", "Large (+€1.5)"], required: true },
  ]},
  { id: "D2", name: "Sparkling Water", price: 2.50, category: "Drinks", desc: "Premium French sparkling mineral water 33cl", image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=300&fit=crop&auto=format", popular: false, customFields: [] },
  { id: "V1", name: "Le Vegan Face", price: 11.90, category: "Vegan", desc: "Plant-based patty, avocado cream, sun-dried tomatoes, rocket", image: "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400&h=300&fit=crop&auto=format", popular: false, customFields: [
    { id: "c3", name: "Sauce", type: "radio", options: ["Vegan Mayo", "Guacamole", "None"], required: false },
  ]},
];

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  customizations: Record<string, string | string[]>;
  itemKey: string;
}

type OrderStatus = "browsing" | "customizing" | "cart" | "ordering" | "confirmed";

export function ClientOrdering({ tableId, onBack }: { tableId: string; onBack: () => void }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [status, setStatus] = useState<OrderStatus>("browsing");
  const [selectedItem, setSelectedItem] = useState<typeof MENU_DATA[0] | null>(null);
  const [customizations, setCustomizations] = useState<Record<string, string | string[]>>({});
  const [search, setSearch] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderId] = useState(`ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`);

  const categories = ["All", "Burgers", "Chicken", "Sides", "Drinks", "Vegan"];

  const filtered = MENU_DATA.filter(item => {
    const matchCat = activeCategory === "All" || item.category === activeCategory;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function openCustomize(item: typeof MENU_DATA[0]) {
    setSelectedItem(item);
    setCustomizations({});
    setStatus("customizing");
  }

  function addToCart() {
    if (!selectedItem) return;
    const key = `${selectedItem.id}-${JSON.stringify(customizations)}`;
    setCart(prev => {
      const existing = prev.find(i => i.itemKey === key);
      if (existing) return prev.map(i => i.itemKey === key ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: selectedItem.id, name: selectedItem.name, price: selectedItem.price, quantity: 1, customizations, itemKey: key }];
    });
    setStatus("browsing");
    setSelectedItem(null);
  }

  function adjustQty(key: string, delta: number) {
    setCart(prev => prev.map(i => i.itemKey === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  }

  function placeOrder() {
    setStatus("ordering");
    setTimeout(() => setStatus("confirmed"), 1800);
  }

  if (status === "confirmed") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "var(--background)", fontFamily: "'Inter', sans-serif" }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: "rgba(200,16,46,0.15)", border: "2px solid var(--primary)" }}>
          <Check size={36} style={{ color: "var(--primary)" }} />
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 800, color: "var(--foreground)", marginBottom: "8px" }}>Order Placed!</h2>
        <p style={{ color: "var(--muted-foreground)", marginBottom: "8px", fontSize: "15px" }}>Table {tableId} · {orderId}</p>
        <div className="flex items-center gap-2 mb-8" style={{ color: "var(--accent)" }}>
          <Clock size={16} />
          <span style={{ fontSize: "14px" }}>Estimated wait: 15–20 minutes</span>
        </div>
        <div className="w-full max-w-sm p-5 mb-8" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          {cart.map(item => (
            <div key={item.itemKey} className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border)", fontSize: "14px" }}>
              <span style={{ color: "var(--foreground)" }}>{item.quantity}× {item.name}</span>
              <span style={{ color: "var(--accent)", fontFamily: "'DM Mono', monospace" }}>€{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-3" style={{ fontWeight: 700, fontSize: "15px" }}>
            <span style={{ color: "var(--foreground)" }}>Total</span>
            <span style={{ color: "var(--accent)", fontFamily: "'DM Mono', monospace" }}>€{cartTotal.toFixed(2)}</span>
          </div>
        </div>
        <button onClick={onBack}
          className="px-8 py-3 text-sm transition-all hover:opacity-90"
          style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700 }}>
          BACK TO MENU
        </button>
      </div>
    );
  }

  if (status === "customizing" && selectedItem) {
    return (
      <div className="min-h-screen" style={{ background: "var(--background)", fontFamily: "'Inter', sans-serif" }}>
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3" style={{ background: "rgba(10,7,4,0.97)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
          <button onClick={() => setStatus("browsing")} style={{ color: "var(--muted-foreground)" }}>
            <ChevronLeft size={22} />
          </button>
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>Customize</span>
        </div>
        <div className="relative h-56 overflow-hidden">
          <ImageWithFallback src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,7,4,1) 0%, transparent 60%)" }} />
        </div>
        <div className="px-4 py-6">
          <div className="flex justify-between items-start mb-3">
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.4rem", color: "var(--foreground)" }}>{selectedItem.name}</h2>
            <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: "1.1rem", color: "var(--accent)" }}>€{selectedItem.price.toFixed(2)}</span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--muted-foreground)", marginBottom: "24px", lineHeight: 1.6 }}>{selectedItem.desc}</p>

          {selectedItem.customFields.map(field => (
            <div key={field.id} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--foreground)" }}>{field.name}</span>
                {field.required && <span className="px-1.5 py-0.5" style={{ background: "var(--primary)", color: "#fff", fontSize: "9px", fontWeight: 800, borderRadius: "2px", letterSpacing: "0.05em" }}>REQUIRED</span>}
              </div>
              {field.type === "radio" && (
                <div className="flex flex-wrap gap-2">
                  {field.options.map(opt => {
                    const selected = customizations[field.id] === opt;
                    return (
                      <button key={opt} onClick={() => setCustomizations(p => ({ ...p, [field.id]: opt }))}
                        className="px-4 py-2 text-sm transition-all"
                        style={{
                          border: selected ? "1px solid var(--primary)" : "1px solid var(--border)",
                          background: selected ? "rgba(200,16,46,0.15)" : "var(--card)",
                          color: selected ? "var(--primary)" : "var(--muted-foreground)",
                          borderRadius: "var(--radius)",
                          fontWeight: selected ? 700 : 400,
                        }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
              {field.type === "checkbox" && (
                <div className="flex flex-col gap-2">
                  {field.options.map(opt => {
                    const arr = (customizations[field.id] as string[] | undefined) || [];
                    const checked = arr.includes(opt);
                    return (
                      <button key={opt} onClick={() => setCustomizations(p => {
                        const prev = (p[field.id] as string[] | undefined) || [];
                        return { ...p, [field.id]: checked ? prev.filter(x => x !== opt) : [...prev, opt] };
                      })}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-left transition-all"
                        style={{ border: checked ? "1px solid var(--primary)" : "1px solid var(--border)", background: checked ? "rgba(200,16,46,0.1)" : "var(--card)", borderRadius: "var(--radius)", color: checked ? "var(--foreground)" : "var(--muted-foreground)" }}>
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0"
                          style={{ border: checked ? "none" : "1px solid var(--border)", background: checked ? "var(--primary)" : "transparent", borderRadius: "3px" }}>
                          {checked && <Check size={11} style={{ color: "#fff" }} />}
                        </div>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <button onClick={addToCart}
            className="w-full py-4 text-base transition-all hover:opacity-90 active:scale-95 mt-4"
            style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700, letterSpacing: "0.05em" }}>
            ADD TO CART — €{selectedItem.price.toFixed(2)}
          </button>
        </div>
      </div>
    );
  }

  if (status === "cart") {
    return (
      <div className="min-h-screen" style={{ background: "var(--background)", fontFamily: "'Inter', sans-serif" }}>
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3" style={{ background: "rgba(10,7,4,0.97)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
          <button onClick={() => setStatus("browsing")} style={{ color: "var(--muted-foreground)" }}>
            <ChevronLeft size={22} />
          </button>
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>Your Order · Table {tableId}</span>
        </div>
        <div className="px-4 py-6">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <ShoppingCart size={48} style={{ color: "var(--border)", marginBottom: "16px" }} />
              <p style={{ color: "var(--muted-foreground)" }}>Your cart is empty</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 mb-6">
                {cart.map(item => (
                  <div key={item.itemKey} className="p-4" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontWeight: 700, color: "var(--foreground)", fontSize: "14px" }}>{item.name}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)", fontWeight: 700 }}>€{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    {Object.entries(item.customizations).map(([k, v]) => v && (Array.isArray(v) ? v.length > 0 : true) && (
                      <div key={k} style={{ fontSize: "12px", color: "var(--muted-foreground)", marginBottom: "2px" }}>
                        {Array.isArray(v) ? v.join(", ") : v}
                      </div>
                    ))}
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={() => adjustQty(item.itemKey, -1)}
                        className="w-7 h-7 flex items-center justify-center"
                        style={{ border: "1px solid var(--border)", borderRadius: "3px", color: "var(--foreground)" }}>
                        <Minus size={14} />
                      </button>
                      <span style={{ color: "var(--foreground)", fontWeight: 700, minWidth: "20px", textAlign: "center" }}>{item.quantity}</span>
                      <button onClick={() => adjustQty(item.itemKey, 1)}
                        className="w-7 h-7 flex items-center justify-center"
                        style={{ background: "var(--primary)", borderRadius: "3px", color: "#fff" }}>
                        <Plus size={14} />
                      </button>
                      <button onClick={() => adjustQty(item.itemKey, -item.quantity)} className="ml-auto" style={{ color: "var(--muted-foreground)" }}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <label style={{ fontSize: "13px", color: "var(--muted-foreground)", display: "block", marginBottom: "6px" }}>Special instructions (optional)</label>
                <textarea
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                  rows={2}
                  placeholder="Allergies, preferences..."
                  className="w-full px-3 py-2 text-sm resize-none"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)", outline: "none" }}
                />
              </div>
              <div className="p-4 mb-6" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                <div className="flex justify-between mb-1" style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>
                  <span>Subtotal</span>
                  <span>€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-1" style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>
                  <span>Service</span>
                  <span>Included</span>
                </div>
                <div className="flex justify-between pt-3 mt-2" style={{ borderTop: "1px solid var(--border)", fontWeight: 800, fontSize: "16px" }}>
                  <span style={{ color: "var(--foreground)" }}>Total</span>
                  <span style={{ color: "var(--accent)", fontFamily: "'DM Mono', monospace" }}>€{cartTotal.toFixed(2)}</span>
                </div>
              </div>
              <button onClick={placeOrder}
                className="w-full py-4 text-base transition-all hover:opacity-90 active:scale-95"
                style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 800, letterSpacing: "0.06em" }}>
                PLACE ORDER
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--background)", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: "rgba(10,7,4,0.97)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
        <div className="px-4 py-4 flex items-center justify-between">
          <button onClick={onBack} style={{ color: "var(--muted-foreground)" }}>
            <ChevronLeft size={22} />
          </button>
          <div className="text-center">
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.1rem", color: "var(--foreground)" }}>Le Double Face</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent)", letterSpacing: "0.1em" }}>TABLE {tableId}</div>
          </div>
          <button onClick={() => setStatus("cart")} className="relative p-2">
            <ShoppingCart size={22} style={{ color: cartCount > 0 ? "var(--accent)" : "var(--muted-foreground)" }} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--primary)", color: "#fff", borderRadius: "50%" }}>{cartCount}</span>
            )}
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search the menu..."
              className="w-full pl-9 pr-4 py-2 text-sm"
              style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)", outline: "none" }}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className="whitespace-nowrap px-3 py-1 text-xs transition-all flex-shrink-0"
                style={{
                  background: activeCategory === cat ? "var(--primary)" : "var(--secondary)",
                  color: activeCategory === cat ? "#fff" : "var(--muted-foreground)",
                  border: activeCategory === cat ? "1px solid var(--primary)" : "1px solid var(--border)",
                  borderRadius: "2px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                }}>
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Popular section */}
      {activeCategory === "All" && !search && (
        <div className="px-4 pt-5 mb-2">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={16} style={{ color: "var(--primary)" }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--muted-foreground)", letterSpacing: "0.12em" }}>MOST POPULAR</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {MENU_DATA.filter(i => i.popular).map(item => (
              <button key={item.id} onClick={() => item.customFields.length > 0 ? openCustomize(item) : (() => { if (item.customFields.length === 0) { setCart(p => { const k = `${item.id}-{}`; const ex = p.find(i => i.itemKey === k); return ex ? p.map(i => i.itemKey === k ? { ...i, quantity: i.quantity + 1 } : i) : [...p, { id: item.id, name: item.name, price: item.price, quantity: 1, customizations: {}, itemKey: k }]; }); } })()}
                className="flex-shrink-0 w-36 overflow-hidden text-left transition-all hover:-translate-y-0.5"
                style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                <ImageWithFallback src={item.image} alt={item.name} className="w-full h-24 object-cover" />
                <div className="p-2">
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--foreground)", lineHeight: 1.3 }}>{item.name}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent)", marginTop: "2px" }}>€{item.price.toFixed(2)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu list */}
      <div className="px-4 pt-4 flex flex-col gap-3">
        {filtered.map(item => (
          <div key={item.id} className="flex gap-3 overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <ImageWithFallback src={item.image} alt={item.name} className="w-28 h-28 object-cover flex-shrink-0" />
            <div className="flex-1 p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "0.95rem", color: "var(--foreground)", lineHeight: 1.3 }}>{item.name}</h3>
                  {item.popular && <Star size={13} fill="var(--accent)" style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />}
                </div>
                <p style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.5, marginTop: "3px" }}>{item.desc}</p>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: "0.9rem", color: "var(--accent)" }}>€{item.price.toFixed(2)}</span>
                <button
                  onClick={() => item.customFields.length > 0 ? openCustomize(item) : (() => { const k = `${item.id}-{}`; setCart(p => { const ex = p.find(i => i.itemKey === k); return ex ? p.map(i => i.itemKey === k ? { ...i, quantity: i.quantity + 1 } : i) : [...p, { id: item.id, name: item.name, price: item.price, quantity: 1, customizations: {}, itemKey: k }]; }); })()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs transition-all hover:opacity-90"
                  style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700 }}>
                  <Plus size={13} /> ADD
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: "var(--muted-foreground)", fontSize: "14px" }}>No items found</div>
        )}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && status === "browsing" && (
        <div className="fixed bottom-6 left-4 right-4 z-20">
          <button onClick={() => setStatus("cart")}
            className="w-full py-4 flex items-center justify-between px-5 transition-all hover:opacity-95 active:scale-99"
            style={{ background: "var(--primary)", borderRadius: "var(--radius)", boxShadow: "0 8px 32px rgba(200,16,46,0.4)" }}>
            <span className="w-7 h-7 flex items-center justify-center text-sm font-bold rounded"
              style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>{cartCount}</span>
            <span style={{ color: "#fff", fontWeight: 800, letterSpacing: "0.06em", fontSize: "15px" }}>VIEW ORDER</span>
            <span style={{ fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>€{cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
