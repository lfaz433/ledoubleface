import { useState, useEffect } from "react";
import { ShoppingCart, Plus, Minus, X, ChevronLeft, Check, Clock, Flame, Star, Search, AlertCircle, RefreshCw } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { supabase } from "../../lib/supabase";

// local fallback in case database connection is not ready or configured yet
const FALLBACK_MENU_DATA = [
  { id: "B1", name: "Le Double Face Classic", price: 14.90, category: "Burgers", desc: "Double wagyu patty, truffle mayo, aged cheddar, lettuce, tomato, brioche bun", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop&auto=format", popular: true, customFields: [
    { id: "c1", name: "Cooking", type: "radio", options: ["Saignant", "À point", "Bien cuit"], required: true },
    { id: "c2", name: "Extras", type: "checkbox", options: ["Extra cheese (+€1.00)", "Extra patty (+€3.00)", "Bacon (+€2.00)"], required: false },
    { id: "c3", name: "Sauce", type: "radio", options: ["Truffle Mayo", "BBQ", "Sriracha", "None"], required: false },
  ]},
  { id: "B2", name: "Smash & Burn", price: 13.90, category: "Burgers", desc: "Smash patty, caramelized onion, smoky BBQ, crispy bacon, pickles", image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=300&fit=crop&auto=format", popular: true, customFields: [
    { id: "c1", name: "Cooking", type: "radio", options: ["Saignant", "À point", "Bien cuit"], required: true },
    { id: "c3", name: "Sauce", type: "radio", options: ["BBQ", "Mustard", "Mayo", "None"], required: false },
  ]},
  { id: "D3", name: "Le Cocktail Double Face", price: 12.00, category: "Drinks", desc: "Premium signature cocktail with dual-distilled gin, blood orange, and rosemary syrup", image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=300&fit=crop&auto=format", popular: true, customFields: [
    { id: "cf3", name: "Ice Options", type: "radio", options: ["Crushed Ice", "Single Large Cube", "No Ice"], required: true },
    { id: "cf4", name: "Supplements", type: "checkbox", options: ["Extra Truffle Honey (+€3.50)", "Double Shot (+€4.00)"], required: false }
  ]},
  { id: "S1", name: "La Truffe Fries", price: 6.90, category: "Sides", desc: "Belgian fries, black truffle oil, parmesan, fresh herbs", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop&auto=format", popular: true, customFields: [
    { id: "c5", name: "Size", type: "radio", options: ["Regular", "Large (+€2.00)"], required: true },
  ]}
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

// Parse price from option labels like "+€3.50" or "+3,50 €" or "+2.00"
function parsePriceModifier(optionText: string): number {
  if (!optionText) return 0;
  const normalized = optionText.replace(",", ".");
  const match = normalized.match(/\+\s*(?:€\s*)?(\d+(?:\.\d+)?)\s*(?:€)?/);
  if (match) {
    return parseFloat(match[1]);
  }
  return 0;
}

export function ClientOrdering({ tableId, area }: { tableId: string; area: string }) {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [status, setStatus] = useState<OrderStatus>("browsing");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [customizations, setCustomizations] = useState<Record<string, string | string[]>>({});
  const [search, setSearch] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderId, setOrderId] = useState("");

  // Fetch Menu from Supabase
  const loadMenu = async () => {
    try {
      setLoading(true);
      setDbError(false);
      
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setMenuItems(data);
      } else {
        // Fallback to local items if database table is empty
        setMenuItems(FALLBACK_MENU_DATA);
      }
    } catch (err) {
      console.warn("Could not load from Supabase database. Using fallback local items. Details:", err);
      setDbError(true);
      setMenuItems(FALLBACK_MENU_DATA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();

    // Subscribe to menu updates in real-time
    const channel = supabase
      .channel("menu-live-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        () => {
          loadMenu();
        }
      )
      .subscribe();

    // Initialize order ID
    setOrderId(`ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`);

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute categories dynamically based on menuItems
  const categories = ["All", ...Array.from(new Set(menuItems.map(item => item.category)))];

  const filtered = menuItems.filter(item => {
    const matchCat = activeCategory === "All" || item.category === activeCategory;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.desc?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Modifiers and customizations pricing
  const getItemPriceWithModifiers = () => {
    if (!selectedItem) return 0;
    let base = selectedItem.price;
    Object.entries(customizations).forEach(([_, value]) => {
      if (Array.isArray(value)) {
        value.forEach(opt => {
          base += parsePriceModifier(opt);
        });
      } else if (value) {
        base += parsePriceModifier(value);
      }
    });
    return base;
  };

  function openCustomize(item: any) {
    setSelectedItem(item);
    setCustomizations({});
    setStatus("customizing");
  }

  function addToCart() {
    if (!selectedItem) return;
    const finalPrice = getItemPriceWithModifiers();
    const key = `${selectedItem.id}-${JSON.stringify(customizations)}`;
    setCart(prev => {
      const existing = prev.find(i => i.itemKey === key);
      if (existing) return prev.map(i => i.itemKey === key ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: selectedItem.id, name: selectedItem.name, price: finalPrice, quantity: 1, customizations, itemKey: key }];
    });
    setStatus("browsing");
    setSelectedItem(null);
  }

  function adjustQty(key: string, delta: number) {
    setCart(prev => prev.map(i => i.itemKey === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  }

  // Submit Order to Supabase Database
  async function placeOrder() {
    if (cart.length === 0) return;
    setStatus("ordering");
    
    try {
      const newOrderId = `ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      setOrderId(newOrderId);

      // 1. Write the main order header to public.orders
      const { error: orderError } = await supabase
        .from("orders")
        .insert({
          id: newOrderId,
          table_id: tableId,
          area: area || "Terrace Patio",
          status: "pending",
          total: cartTotal,
          note: orderNote || null
        });

      if (orderError) throw orderError;

      // 2. Write order items line by line
      const lineItems = cart.map(item => ({
        order_id: newOrderId,
        product_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        customizations: item.customizations
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(lineItems);

      if (itemsError) throw itemsError;

      setStatus("confirmed");
      setCart([]); // Clean local basket
      setOrderNote("");
    } catch (err) {
      console.error("Order submission failed:", err);
      alert("Submission failed. We will place a local simulated order instead.");
      // Simulated fallback
      setTimeout(() => setStatus("confirmed"), 1000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0A0704]">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-t-[#C8102E] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full border border-t-transparent border-r-[#E5D5C5] border-b-transparent border-l-transparent animate-spin-reverse" />
        </div>
        <p className="text-xs font-mono tracking-widest text-[#8E7E70] animate-pulse">CONNECTING TO MATRIX...</p>
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0A0704] text-white">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-[#C8102E]/15 border border-[#C8102E]">
          <Check size={36} className="text-[#C8102E]" />
        </div>
        <h2 className="font-serif text-3xl font-extrabold text-white mb-2">Order Dispatched!</h2>
        <p className="text-[#8E7E70] mb-2 text-sm">Table {tableId} · {area}</p>
        <p className="text-xs font-mono text-[#C8102E] tracking-wider mb-6 bg-[#C8102E]/10 px-3 py-1 rounded">{orderId}</p>
        <div className="flex items-center gap-2 mb-8 text-[#E5D5C5] bg-[#1A130E] border border-[#2A1E15] px-4 py-2 rounded-md">
          <Clock size={16} className="text-[#C8102E]" />
          <span className="text-xs font-semibold">Kitchen Queue: Pending Acceptance</span>
        </div>
        <button onClick={() => {
          setStatus("browsing");
          setOrderId(`ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`);
        }}
          className="px-8 py-3 text-xs tracking-widest bg-[#C8102E] text-white hover:opacity-90 active:scale-95 transition-all font-bold rounded">
          BACK TO MENU
        </button>
      </div>
    );
  }

  if (status === "customizing" && selectedItem) {
    return (
      <div className="min-h-screen bg-[#0A0704] text-white flex flex-col">
        {/* Customization Header */}
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 bg-[#0A0704]/95 border-b border-[#2A1E15] backdrop-blur-md">
          <button onClick={() => setStatus("browsing")} className="text-[#8E7E70] hover:text-white transition-colors">
            <ChevronLeft size={22} />
          </button>
          <span className="font-serif font-bold text-lg">Configure Options</span>
        </div>

        {/* Customization Image */}
        <div className="relative h-56 overflow-hidden bg-[#1A130E] border-b border-[#2A1E15]">
          <ImageWithFallback src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0704] to-transparent" />
        </div>

        {/* Customize Fields */}
        <div className="flex-1 px-4 py-6 overflow-y-auto pb-24">
          <div className="flex justify-between items-start mb-2">
            <h2 className="font-serif font-bold text-2xl">{selectedItem.name}</h2>
            <span className="font-mono font-bold text-lg text-[#E5D5C5]">€{selectedItem.price.toFixed(2)}</span>
          </div>
          <p className="text-xs text-[#8E7E70] mb-6 leading-relaxed">{selectedItem.desc}</p>

          {/* Render modifiers */}
          {Array.isArray(selectedItem.customFields) && selectedItem.customFields.map((field: any) => (
            <div key={field.id} className="mb-6 bg-[#120D09] border border-[#2A1E15] p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-bold text-sm text-white">{field.name}</span>
                {field.required && (
                  <span className="px-1.5 py-0.5 bg-[#C8102E] text-white text-[9px] font-black rounded-sm tracking-wider">REQUIRED</span>
                )}
              </div>
              {field.type === "radio" && (
                <div className="flex flex-wrap gap-2">
                  {field.options.map((opt: string) => {
                    const selected = customizations[field.id] === opt;
                    const priceMod = parsePriceModifier(opt);
                    return (
                      <button key={opt} onClick={() => setCustomizations(p => ({ ...p, [field.id]: opt }))}
                        className="px-3 py-2 text-xs font-semibold rounded transition-all flex items-center gap-1.5 border"
                        style={{
                          borderColor: selected ? "#C8102E" : "#2A1E15",
                          background: selected ? "rgba(200,16,46,0.15)" : "#1A130E",
                          color: selected ? "#white" : "#8E7E70",
                        }}>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {field.type === "checkbox" && (
                <div className="flex flex-col gap-2">
                  {field.options.map((opt: string) => {
                    const arr = (customizations[field.id] as string[] | undefined) || [];
                    const checked = arr.includes(opt);
                    return (
                      <button key={opt} onClick={() => setCustomizations(p => {
                        const prev = (p[field.id] as string[] | undefined) || [];
                        return { ...p, [field.id]: checked ? prev.filter(x => x !== opt) : [...prev, opt] };
                      })}
                        className="flex items-center gap-3 px-4 py-3 text-xs text-left rounded bg-[#1A130E] border transition-all"
                        style={{ borderColor: checked ? "#C8102E" : "#2A1E15" }}>
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 rounded-sm border"
                          style={{ borderColor: checked ? "#C8102E" : "#2A1E15", background: checked ? "#C8102E" : "transparent" }}>
                          {checked && <Check size={11} className="text-white" />}
                        </div>
                        <span className="flex-1 text-[#E5D5C5]">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Sticky Drawer Footer */}
        <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-[#2A1E15] bg-[#0A0704]/98 backdrop-blur-md z-30">
          <button onClick={addToCart}
            className="w-full py-4 text-sm font-bold tracking-widest bg-[#C8102E] text-white rounded hover:opacity-90 active:scale-98 transition-all">
            ADD TO TAB BILL — €{getItemPriceWithModifiers().toFixed(2)}
          </button>
        </div>
      </div>
    );
  }

  if (status === "cart") {
    return (
      <div className="min-h-screen bg-[#0A0704] text-white flex flex-col">
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 bg-[#0A0704]/95 border-b border-[#2A1E15] backdrop-blur-md">
          <button onClick={() => setStatus("browsing")} className="text-[#8E7E70] hover:text-white transition-colors">
            <ChevronLeft size={22} />
          </button>
          <span className="font-serif font-bold text-lg">Your Cart · Table {tableId}</span>
        </div>
        
        <div className="flex-1 px-4 py-6 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <ShoppingCart size={48} className="text-[#2A1E15] mb-4" />
              <p className="text-sm text-[#8E7E70]">Your basket is empty</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 mb-6">
                {cart.map(item => (
                  <div key={item.itemKey} className="p-4 bg-[#120D09] border border-[#2A1E15] rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-[#E5D5C5] text-sm">{item.name}</span>
                      <span className="font-mono text-xs font-bold text-[#C8102E]">€{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    {Object.entries(item.customizations).map(([k, v]) => v && (Array.isArray(v) ? v.length > 0 : true) && (
                      <div key={k} className="text-[11px] text-[#8E7E70] mb-1">
                        {Array.isArray(v) ? v.join(", ") : v}
                      </div>
                    ))}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#2A1E15]/50">
                      <button onClick={() => adjustQty(item.itemKey, -1)}
                        className="w-7 h-7 flex items-center justify-center border border-[#2A1E15] rounded text-white hover:bg-[#1A130E] transition-all">
                        <Minus size={12} />
                      </button>
                      <span className="font-mono text-sm font-bold text-[#E5D5C5] w-5 text-center">{item.quantity}</span>
                      <button onClick={() => adjustQty(item.itemKey, 1)}
                        className="w-7 h-7 flex items-center justify-center bg-[#C8102E] text-white rounded hover:opacity-90 transition-all">
                        <Plus size={12} />
                      </button>
                      <button onClick={() => adjustQty(item.itemKey, -item.quantity)} className="ml-auto text-[#8E7E70] hover:text-white" title="Remove">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <label className="text-[11px] font-mono tracking-widest text-[#8E7E70] block mb-2">SPECIAL INSTRUCTIONS</label>
                <textarea
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                  rows={2}
                  placeholder="Allergies, seating preferences, requests..."
                  className="w-full px-3 py-2 text-xs bg-[#120D09] border border-[#2A1E15] rounded-md text-white outline-none focus:border-[#C8102E] transition-colors resize-none"
                />
              </div>

              <div className="p-4 bg-[#120D09] border border-[#2A1E15] rounded-lg mb-6">
                <div className="flex justify-between mb-1.5 text-xs text-[#8E7E70]">
                  <span>Subtotal</span>
                  <span className="font-mono">€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-1.5 text-xs text-[#8E7E70]">
                  <span>Service Charge</span>
                  <span>Included</span>
                </div>
                <div className="flex justify-between pt-3 mt-3 border-t border-[#2A1E15] font-black text-sm text-white">
                  <span>Total Bill</span>
                  <span className="font-mono text-base text-[#C8102E]">€{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <button onClick={placeOrder}
                disabled={status === "ordering"}
                className="w-full py-4 text-xs font-bold tracking-widest bg-[#C8102E] hover:opacity-95 text-white rounded transition-all active:scale-98">
                {status === "ordering" ? "TRANSMITTING TICKET..." : "SEND ORDER TO BAR KITCHEN"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-[#0A0704] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0704]/95 border-b border-[#2A1E15] backdrop-blur-md">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-serif font-black text-lg text-white">Le Double Face</span>
            <span className="font-mono text-[9px] text-[#C8102E] tracking-widest font-bold">TABLE {tableId} · {area.toUpperCase()}</span>
          </div>
          
          <button onClick={() => setStatus("cart")} className="relative p-2 bg-[#120D09] rounded border border-[#2A1E15] transition-all hover:bg-[#1A130E]">
            <ShoppingCart size={18} className={cartCount > 0 ? "text-[#C8102E]" : "text-[#8E7E70]"} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full bg-[#C8102E] text-white">{cartCount}</span>
            )}
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E7E70]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search dishes or beverages..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-[#120D09] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E] transition-colors"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className="whitespace-nowrap px-3 py-1.5 text-[10px] font-bold tracking-wider rounded transition-all uppercase border"
                style={{
                  background: activeCategory === cat ? "#C8102E" : "#120D09",
                  borderColor: activeCategory === cat ? "#C8102E" : "#2A1E15",
                  color: activeCategory === cat ? "#fff" : "#8E7E70",
                }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Database Warning indicator */}
      {dbError && (
        <div className="mx-4 my-2 px-3 py-2 bg-[#1A130E] border border-dashed border-[#8E7E70]/30 rounded text-[10px] text-[#8E7E70] flex items-center justify-between">
          <span>⚠️ Offline simulated mode (check .env settings)</span>
          <button onClick={loadMenu} className="hover:text-white"><RefreshCw size={10} /></button>
        </div>
      )}

      {/* Popular Section (Horizontal Carousel) */}
      {activeCategory === "All" && !search && (
        <div className="px-4 pt-5 mb-2">
          <div className="flex items-center gap-1.5 mb-4 text-[#C8102E]">
            <Flame size={14} />
            <span className="font-mono text-[9px] tracking-widest font-black uppercase">CHEF RECOMMENDATIONS</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {menuItems.filter(i => i.popular).map(item => (
              <button key={item.id} onClick={() => Array.isArray(item.customFields) && item.customFields.length > 0 ? openCustomize(item) : (() => {
                const k = `${item.id}-{}`;
                setCart(p => {
                  const ex = p.find(i => i.itemKey === k);
                  return ex ? p.map(i => i.itemKey === k ? { ...i, quantity: i.quantity + 1 } : i) : [...p, { id: item.id, name: item.name, price: item.price, quantity: 1, customizations: {}, itemKey: k }];
                });
              })()}
                className="flex-shrink-0 w-36 overflow-hidden text-left bg-[#120D09] border border-[#2A1E15] rounded hover:border-[#C8102E] transition-all">
                <div className="h-24 bg-[#1A130E] overflow-hidden">
                  <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-2.5">
                  <div className="text-xs font-bold text-white truncate">{item.name}</div>
                  <div className="font-mono text-[10px] text-[#C8102E] font-bold mt-1">€{item.price.toFixed(2)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid/List */}
      <div className="px-4 pt-4 flex flex-col gap-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="font-mono text-[9px] text-[#8E7E70] tracking-widest uppercase">CATALOGUE</span>
        </div>
        
        {filtered.map(item => (
          <div key={item.id} className="flex gap-3 bg-[#120D09] border border-[#2A1E15] rounded overflow-hidden">
            <div className="w-24 h-24 bg-[#1A130E] flex-shrink-0">
              <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
            </div>
            
            <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="flex items-start justify-between gap-1.5">
                  <h3 className="font-serif font-bold text-sm text-[#E5D5C5] truncate">{item.name}</h3>
                  {item.popular && <Star size={11} className="text-[#C8102E] fill-[#C8102E] flex-shrink-0 mt-0.5" />}
                </div>
                <p className="text-[10px] text-[#8E7E70] leading-snug line-clamp-2 mt-1">{item.desc}</p>
              </div>
              
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2A1E15]/30">
                <span className="font-mono text-xs font-bold text-[#C8102E]">€{item.price.toFixed(2)}</span>
                <button
                  onClick={() => Array.isArray(item.customFields) && item.customFields.length > 0 ? openCustomize(item) : (() => {
                    const k = `${item.id}-{}`;
                    setCart(p => {
                      const ex = p.find(i => i.itemKey === k);
                      return ex ? p.map(i => i.itemKey === k ? { ...i, quantity: i.quantity + 1 } : i) : [...p, { id: item.id, name: item.name, price: item.price, quantity: 1, customizations: {}, itemKey: k }];
                    });
                  })()}
                  className="flex items-center gap-1 px-3 py-1 bg-[#C8102E] hover:opacity-90 text-[10px] font-bold text-white rounded transition-all">
                  <Plus size={10} /> ADD
                </button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-xs text-[#8E7E70] border border-[#2A1E15] border-dashed rounded">No items found in category</div>
        )}
      </div>

      {/* Floating cart bar */}
      {cartCount > 0 && status === "browsing" && (
        <div className="fixed bottom-6 left-4 right-4 z-20">
          <button onClick={() => setStatus("cart")}
            className="w-full py-3.5 flex items-center justify-between px-5 bg-[#C8102E] text-white rounded font-bold shadow-lg shadow-[#C8102E]/20 transition-all hover:opacity-95 active:scale-99">
            <span className="w-6 h-6 flex items-center justify-center text-[10px] font-black rounded bg-white/20">{cartCount}</span>
            <span className="text-xs font-extrabold tracking-widest">VIEW ORDER</span>
            <span className="font-mono text-sm">€{cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
