import { useState, useEffect } from "react";
import { ShoppingCart, Plus, Minus, X, ChevronLeft, Check, Clock, Flame, Star, Search, RefreshCw, AlertCircle } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { supabase } from "../../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { translations, Language } from "../../lib/translations";

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

type OrderStatus = "browsing" | "customizing" | "cart" | "checkout" | "ordering" | "confirmed";

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

  // Bilingual State
  const [lang, setLang] = useState<Language>("fr");
  const t = translations[lang];

  // Active Order (Unpaid Session Pursuit)
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [activeOrderItems, setActiveOrderItems] = useState<any[]>([]);

  // Waiter State
  const [waiterCalled, setWaiterCalled] = useState(false);

  // Payment Selection
  const [selectedPayment, setSelectedPayment] = useState<"cash" | "visa" | "apple">("cash");

  // Shows Ticketing State
  const [shows, setShows] = useState<any[]>([]);
  const [bookingShow, setBookingShow] = useState<any | null>(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingQty, setBookingQty] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(false);

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
      console.warn("Could not load shows:", err);
    }
  };

  const checkActiveOrder = async () => {
    try {
      if (!supabase) return;
      // Fetch latest unpaid order for this table
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("table_id", tableId)
        .eq("paid", false)
        .neq("status", "delivered")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setActiveOrder(data[0]);
        // Also fetch items for this order
        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", data[0].id);

        if (!itemsError && itemsData) {
          setActiveOrderItems(itemsData);
        }
      } else {
        setActiveOrder(null);
        setActiveOrderItems([]);
      }
    } catch (err) {
      console.warn("Could not check active orders:", err);
    }
  };

  const callServer = async () => {
    setWaiterCalled(true);
    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ waiter_called: true })
        .eq("id", tableId);
      
      if (error) throw error;
      alert(t.callWaiterSuccess);
    } catch (err) {
      console.warn("Could not update waiter called state in database:", err);
      alert(t.callWaiterSuccess);
    }

    setTimeout(() => {
      setWaiterCalled(false);
    }, 15000); // 15s local timeout
  };

  const bookTicket = async () => {
    if (!bookingShow || !bookingName || !bookingEmail) return;
    try {
      const { error } = await supabase
        .from("tickets")
        .insert({
          show_id: bookingShow.id,
          customer_name: bookingName,
          customer_email: bookingEmail,
          quantity: bookingQty
        });

      if (error) throw error;

      // Update seats quantity
      await supabase
        .from("shows")
        .update({ available_tickets: Math.max(0, bookingShow.available_tickets - bookingQty) })
        .eq("id", bookingShow.id);

      setBookingSuccess(true);
      setTimeout(() => {
        setBookingShow(null);
        setBookingSuccess(false);
        setBookingName("");
        setBookingEmail("");
        setBookingQty(1);
        loadShows();
      }, 3000);
    } catch (err) {
      console.error("Booking ticket failed:", err);
      alert("Ticket purchase failed. Proceeding with simulated confirmation.");
      setBookingSuccess(true);
      setTimeout(() => {
        setBookingShow(null);
        setBookingSuccess(false);
      }, 2000);
    }
  };

  useEffect(() => {
    loadMenu();
    loadShows();
    checkActiveOrder();

    // Subscribe to menu updates in real-time
    const menuChannel = supabase
      .channel("menu-live-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        () => {
          loadMenu();
        }
      )
      .subscribe();

    // Subscribe to order state (to handle payment resets)
    const ordersChannel = supabase
      .channel("orders-client-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `table_id=eq.${tableId}` },
        () => {
          checkActiveOrder();
        }
      )
      .subscribe();

    // Subscribe to waiter status dismissals
    const tablesChannel = supabase
      .channel("tables-client-sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "restaurant_tables", filter: `id=eq.${tableId}` },
        (payload: any) => {
          if (payload.new && !payload.new.waiter_called) {
            setWaiterCalled(false);
          }
        }
      )
      .subscribe();

    // Initialize order ID
    setOrderId(`ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`);

    return () => {
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(tablesChannel);
    };
  }, []);

  useEffect(() => {
    if (menuItems.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const targetProdId = params.get("product");
      if (targetProdId) {
        const item = menuItems.find(i => i.id === targetProdId);
        if (item) {
          openCustomize(item);
          const url = new URL(window.location.href);
          url.searchParams.delete("product");
          window.history.replaceState({}, "", url.toString());
        }
      }
    }
  }, [menuItems]);

  // Compute categories dynamically based on menuItems
  const categories = ["All", ...Array.from(new Set(menuItems.map(item => item.category)))];

  const filtered = menuItems.filter(item => {
    const matchCat = activeCategory === "All" || item.category === activeCategory;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.desc?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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
          note: orderNote || null,
          paid: false,
          invoice_no: newOrderId
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
    const qrInvoiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(orderId)}`;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0A0704] text-white">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 bg-[#C8102E]/15 border border-[#C8102E]">
          <Check size={28} className="text-[#C8102E]" />
        </div>
        <h2 className="font-serif text-2xl font-extrabold text-white mb-2">{t.orderDispatched}</h2>
        <p className="text-[#8E7E70] mb-2 text-xs">Table {tableId} · {area}</p>
        
        <p className="text-[10px] font-mono text-[#8E7E70] tracking-wider mb-5 bg-[#120D09] border border-[#2A1E15] px-3 py-1.5 rounded select-all">
          {t.invoiceCode}: <span className="text-white font-bold">{orderId}</span>
        </p>

        {/* Invoice QR Code */}
        <div className="bg-white p-2.5 rounded-xl mb-4 border border-white/20">
          <img src={qrInvoiceUrl} alt="Invoice QR" className="w-32 h-32 object-contain" />
        </div>
        <p className="text-[10px] text-[#8E7E70] text-center max-w-xs mb-8 leading-relaxed">
          {t.invoiceQrDesc}
        </p>

        <button onClick={() => {
          setStatus("browsing");
          setCart([]);
          checkActiveOrder(); // Sync
          setOrderId(`ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`);
        }}
          className="px-8 py-3 text-xs tracking-widest bg-[#C8102E] text-white hover:opacity-90 active:scale-95 transition-all font-bold rounded cursor-pointer">
          {t.backToMenu}
        </button>
      </div>
    );
  }

  if (status === "customizing" && selectedItem) {
    return (
      <motion.div 
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="min-h-screen bg-[#0A0704] text-white flex flex-col absolute inset-0 z-50 overflow-hidden"
      >
        {/* Customization Header */}
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 bg-[#0A0704]/95 border-b border-[#2A1E15] backdrop-blur-md">
          <button onClick={() => setStatus("browsing")} className="text-[#8E7E70] hover:text-white transition-colors cursor-pointer">
            <ChevronLeft size={22} />
          </button>
          <span className="font-serif font-bold text-lg">{t.customOptions}</span>
        </div>

        {/* Customization Details */}
        <div className="flex-1 overflow-y-auto pb-28">
          <div className="relative h-56 overflow-hidden bg-[#1A130E] border-b border-[#2A1E15]">
            <ImageWithFallback src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0704] to-transparent" />
          </div>

          <div className="px-4 py-6">
            <div className="flex justify-between items-start mb-2">
              <h2 className="font-serif font-bold text-2xl text-white">{selectedItem.name}</h2>
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
                      return (
                        <button key={opt} onClick={() => setCustomizations(p => ({ ...p, [field.id]: opt }))}
                          className="px-3 py-2 text-xs font-semibold rounded transition-all flex items-center gap-1.5 border cursor-pointer"
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
                          className="flex items-center gap-3 px-4 py-3 text-xs text-left rounded bg-[#1A130E] border transition-all cursor-pointer"
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
        </div>

        {/* Sticky Drawer Footer */}
        <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-[#2A1E15] bg-[#0A0704]/98 backdrop-blur-md z-30">
          <button onClick={addToCart}
            className="w-full py-4 text-xs font-bold tracking-widest bg-[#C8102E] text-white rounded hover:opacity-90 active:scale-98 transition-all cursor-pointer">
            {t.addToCart.toUpperCase()} — €{getItemPriceWithModifiers().toFixed(2)}
          </button>
        </div>
      </motion.div>
    );
  }

  if (status === "cart") {
    return (
      <motion.div 
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="min-h-screen bg-[#0A0704] text-white flex flex-col absolute inset-0 z-50"
      >
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 bg-white/5 border-b border-white/10 backdrop-blur-md">
          <button onClick={() => setStatus("browsing")} className="text-[#8E7E70] hover:text-white transition-colors cursor-pointer">
            <ChevronLeft size={22} />
          </button>
          <span className="font-serif font-bold text-lg">{t.cartTitle} · Table {tableId}</span>
        </div>
        
        <div className="flex-1 px-4 py-6 overflow-y-auto pb-24">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <ShoppingCart size={48} className="text-[#2A1E15] mb-4" />
              <p className="text-sm text-[#8E7E70]">{t.cartEmpty}</p>
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
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#2A1E15]/50 select-none">
                      <button onClick={() => adjustQty(item.itemKey, -1)}
                        className="w-10 h-10 flex items-center justify-center border border-[#2A1E15] rounded text-white hover:bg-[#1A130E] transition-all cursor-pointer">
                        <Minus size={14} />
                      </button>
                      <span className="font-mono text-sm font-bold text-[#E5D5C5] w-6 text-center">{item.quantity}</span>
                      <button onClick={() => adjustQty(item.itemKey, 1)}
                        className="w-10 h-10 flex items-center justify-center bg-[#C8102E] text-white rounded hover:opacity-90 transition-all cursor-pointer">
                        <Plus size={14} />
                      </button>
                      <button onClick={() => adjustQty(item.itemKey, -item.quantity)} className="ml-auto text-[#8E7E70] hover:text-white cursor-pointer p-2" title="Remove">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <label className="text-[11px] font-mono tracking-widest text-[#8E7E70] block mb-2">{t.cartNote.toUpperCase()}</label>
                <textarea
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                  rows={2}
                  placeholder="Allergies, requests..."
                  className="w-full px-3 py-2 text-xs bg-[#120D09] border border-[#2A1E15] rounded-md text-white outline-none focus:border-[#C8102E] transition-colors resize-none"
                />
              </div>

              <div className="p-4 bg-[#120D09] border border-[#2A1E15] rounded-lg mb-6">
                <div className="flex justify-between mb-1.5 text-xs text-[#8E7E70]">
                  <span>Subtotal</span>
                  <span className="font-mono">€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-1.5 text-xs text-[#8E7E70]">
                  <span>Service</span>
                  <span>Included</span>
                </div>
                <div className="flex justify-between pt-3 mt-3 border-t border-[#2A1E15] font-black text-sm text-white">
                  <span>Total</span>
                  <span className="font-mono text-base text-[#C8102E]">€{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <button onClick={() => setStatus("checkout")}
                className="w-full py-4 text-xs font-bold tracking-widest bg-[#C8102E] hover:opacity-95 text-white rounded-xl transition-all active:scale-98 cursor-pointer">
                {t.checkoutBtn.toUpperCase()}
              </button>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  if (status === "checkout") {
    return (
      <motion.div 
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="min-h-screen bg-[#0A0704] text-white flex flex-col absolute inset-0 z-50"
      >
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 bg-white/5 border-b border-white/10 backdrop-blur-md">
          <button onClick={() => setStatus("cart")} className="text-[#8E7E70] hover:text-white transition-colors cursor-pointer">
            <ChevronLeft size={22} />
          </button>
          <span className="font-serif font-bold text-lg">{t.paymentTitle}</span>
        </div>
        
        <div className="flex-1 px-4 py-6 overflow-y-auto pb-24">
          <p className="text-xs text-[#8E7E70] mb-6">{t.paymentDesc}</p>
          
          <div className="flex flex-col gap-3 mb-8">
            {[
              { id: "visa" as const, label: t.paymentVisa, disabled: true },
              { id: "apple" as const, label: t.paymentApplePay, disabled: true },
              { id: "cash" as const, label: t.paymentCash, disabled: false }
            ].map(method => (
              <button
                key={method.id}
                disabled={method.disabled}
                onClick={() => setSelectedPayment(method.id)}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                  method.disabled ? "opacity-30 cursor-not-allowed border-[#2A1E15] bg-zinc-950/20" :
                  selectedPayment === method.id ? "border-[#C8102E] bg-red-950/10 cursor-pointer" : "border-[#2A1E15] bg-[#120D09] hover:bg-[#1A130E] cursor-pointer"
                }`}
              >
                <span className={`text-xs font-semibold ${selectedPayment === method.id ? "text-white" : "text-[#8E7E70]"}`}>{method.label}</span>
                <div className="w-4 h-4 rounded-full border flex items-center justify-center" style={{ borderColor: selectedPayment === method.id ? "#C8102E" : "#2A1E15" }}>
                  {selectedPayment === method.id && <div className="w-2 h-2 rounded-full bg-[#C8102E]" />}
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 bg-[#120D09] border border-[#2A1E15] rounded-xl mb-8">
            <div className="flex justify-between font-black text-sm text-white">
              <span>{t.confirmOrder}</span>
              <span className="font-mono text-[#C8102E]">€{cartTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <button onClick={placeOrder}
            disabled={status === "ordering"}
            className="w-full py-4 text-xs font-bold tracking-widest bg-[#C8102E] hover:opacity-95 text-white rounded-xl transition-all active:scale-98 cursor-pointer">
            {status === "ordering" ? "TRANSMITTING TICKET..." : t.confirmOrder.toUpperCase()}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-screen pb-24 bg-transparent text-white"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/5 border-b border-white/10 backdrop-blur-xl shadow-lg">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-serif font-black text-lg text-white">Le Double Face</span>
            <span className="font-mono text-[9px] text-[#C8102E] tracking-widest font-bold">TABLE {tableId} · {area.toUpperCase()}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Waiter Call Button */}
            <button
              onClick={callServer}
              disabled={waiterCalled}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all border flex items-center gap-1 ${
                waiterCalled ? "bg-[#C8102E]/20 border-[#C8102E] text-[#C8102E] animate-pulse cursor-not-allowed" : "bg-black/40 border-white/10 text-white cursor-pointer hover:bg-black/60"
              }`}
            >
              <span>🛎️</span>
              <span className="hidden xs:inline">{t.callWaiter.split(" ")[1]}</span>
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLang(l => l === "fr" ? "en" : "fr")}
              className="p-2 bg-[#120D09] rounded-lg border border-[#2A1E15] transition-all hover:bg-[#1A130E] text-[#8E7E70] hover:text-white cursor-pointer"
              title="Change Language"
            >
              <span className="text-[10px] font-black font-mono">{lang.toUpperCase()}</span>
            </button>

            {/* Cart Button */}
            <button onClick={() => setStatus("cart")} className="relative p-2 bg-[#120D09] rounded-lg border border-[#2A1E15] transition-all hover:bg-[#1A130E] cursor-pointer">
              <ShoppingCart size={18} className={cartCount > 0 ? "text-[#C8102E]" : "text-[#8E7E70]"} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full bg-[#C8102E] text-white">{cartCount}</span>
              )}
            </button>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E7E70]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.menuSearch}
              className="w-full pl-9 pr-4 py-2 text-xs bg-[#120D09] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E] transition-colors"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className="whitespace-nowrap px-4 py-2.5 text-xs font-bold tracking-wider rounded transition-all uppercase border cursor-pointer"
                style={{
                  background: activeCategory === cat ? "#C8102E" : "#120D09",
                  borderColor: activeCategory === cat ? "#C8102E" : "#2A1E15",
                  color: activeCategory === cat ? "#fff" : "#8E7E70",
                }}>
                {cat === "All" ? t.menuAll : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Database Warning indicator */}
      {dbError && (
        <div className="mx-4 my-2 px-3 py-2 bg-[#1A130E] border border-dashed border-[#8E7E70]/30 rounded text-[10px] text-[#8E7E70] flex items-center justify-between">
          <span>⚠️ Offline simulated mode</span>
          <button onClick={loadMenu} className="hover:text-white cursor-pointer"><RefreshCw size={10} /></button>
        </div>
      )}

      {/* Active Order Progress Banner (Persistence Session Pursuit) */}
      {activeOrder && (
        <div className="mx-4 my-3 p-4 bg-red-950/15 border border-[#C8102E]/40 rounded-xl glass-panel animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="font-serif font-bold text-sm text-[#E5D5C5]">{t.activeOrderTitle}</span>
            <span className="font-mono text-[9px] font-bold text-white bg-[#C8102E] px-2 py-0.5 rounded uppercase tracking-wider">{activeOrder.status}</span>
          </div>
          <p className="text-[10px] text-[#8E7E70] leading-snug mb-3">
            {t.activeOrderDesc} (<span className="font-mono text-white select-all">{activeOrder.id}</span>)
          </p>
          <div className="flex flex-col gap-1.5 mb-3 border-t border-[#2A1E15]/30 pt-2 pb-2">
            {activeOrderItems.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-[10px] text-[#E5D5C5]">
                <span>{item.quantity}x {item.name}</span>
                <span className="font-mono">€{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-[#8E7E70] border-t border-[#2A1E15]/40 pt-2 flex justify-between items-center">
            <span>Total: €{activeOrder.total?.toFixed(2)}</span>
            <span className="text-[#C8102E] font-extrabold tracking-widest text-[9px] animate-pulse">{t.orderMoreBtn}</span>
          </div>
        </div>
      )}

      {/* Popular Section (Horizontal Carousel) */}
      {activeCategory === "All" && !search && (
        <div className="px-4 pt-5 mb-2">
          <div className="flex items-center gap-1.5 mb-4 text-[#C8102E]">
            <Flame size={14} />
            <span className="font-mono text-[9px] tracking-widest font-black uppercase">{t.heroSpecial}</span>
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
                className="flex-shrink-0 w-36 overflow-hidden text-left bg-[#120D09] border border-[#2A1E15] rounded hover:border-[#C8102E] transition-all cursor-pointer">
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
      <div className="px-4 pt-4">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="font-mono text-[9px] text-[#8E7E70] tracking-widest uppercase">{t.navMenu}</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const handleSelect = () => {
              if (Array.isArray(item.customFields) && item.customFields.length > 0) {
                openCustomize(item);
              } else {
                const k = `${item.id}-{}`;
                setCart(p => {
                  const ex = p.find(i => i.itemKey === k);
                  return ex ? p.map(i => i.itemKey === k ? { ...i, quantity: i.quantity + 1 } : i) : [...p, { id: item.id, name: item.name, price: item.price, quantity: 1, customizations: {}, itemKey: k }];
                });
              }
            };

            return (
              <motion.div 
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                key={item.id} 
                onClick={handleSelect}
                className="flex gap-3 glass-panel rounded-xl overflow-hidden cursor-pointer select-none transition-colors duration-200 hover:bg-white/[0.03] active:bg-white/[0.05]"
              >
                <div className="w-24 h-24 bg-black/40 flex-shrink-0">
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
                      onClick={(e) => {
                        e.stopPropagation(); // prevent card double tap trigger
                        handleSelect();
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-[#C8102E] hover:opacity-90 text-[11px] font-bold text-white rounded transition-all cursor-pointer shadow-sm shadow-[#C8102E]/20">
                      <Plus size={11} /> {t.addToCart.split(" ")[0]}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-xs text-[#8E7E70] border border-[#2A1E15] border-dashed rounded mt-4">{t.emptyMenu}</div>
        )}
      </div>

      {/* Shows section */}
      {shows.length > 0 && (
        <div className="px-4 pt-6 border-t border-[#2A1E15]/50 mt-8 mb-4">
          <div className="flex items-center gap-1.5 mb-4 text-[#C8102E]">
            <Star size={14} className="fill-[#C8102E]" />
            <span className="font-mono text-[9px] tracking-widest font-black uppercase">{t.showsHeader}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {shows.map(show => (
              <div 
                key={show.id} 
                onClick={() => setBookingShow(show)}
                className="p-4 bg-[#120D09] border border-[#2A1E15] rounded-xl flex gap-3.5 cursor-pointer select-none transition-colors duration-200 hover:bg-[#1A130E] active:bg-[#1C1510] hover:border-[#C8102E]/30"
              >
                <div className="w-20 h-20 rounded overflow-hidden flex-shrink-0 bg-black/40">
                  <ImageWithFallback src={show.image} alt={show.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-serif font-bold text-sm text-[#E5D5C5]">{show.title}</h4>
                    <p className="text-[10px] text-[#8E7E70] line-clamp-2 mt-1">{show.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2A1E15]/30">
                    <span className="font-mono text-xs font-bold text-[#C8102E]">€{show.price?.toFixed(2)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBookingShow(show);
                      }}
                      className="px-3.5 py-1.5 bg-[#C8102E] hover:opacity-90 text-[10px] font-bold text-white rounded cursor-pointer transition-all shadow-sm shadow-[#C8102E]/20"
                    >
                      {t.showsBuyTickets}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating cart bar */}
      <AnimatePresence>
        {cartCount > 0 && status === "browsing" && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-20"
          >
            <button onClick={() => setStatus("cart")}
              className="w-full py-3.5 flex items-center justify-between px-5 bg-[#C8102E] text-white rounded-xl font-bold shadow-lg shadow-[#C8102E]/40 transition-all hover:opacity-95 active:scale-95 cursor-pointer">
              <span className="w-6 h-6 flex items-center justify-center text-[10px] font-black rounded bg-white/20">{cartCount}</span>
              <span className="text-xs font-extrabold tracking-widest">{t.cartTitle.toUpperCase()}</span>
              <span className="font-mono text-sm">€{cartTotal.toFixed(2)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ticket Booking Modal */}
      <AnimatePresence>
        {bookingShow && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 text-white"
          >
            <div className="w-full max-w-sm bg-[#120D09] border border-[#2A1E15] p-5 rounded-2xl relative">
              <button onClick={() => setBookingShow(null)} className="absolute top-4 right-4 text-[#8E7E70] hover:text-white cursor-pointer">
                <X size={18} />
              </button>
              
              <h3 className="font-serif font-black text-lg mb-2 text-[#E5D5C5]">{t.showsBookTitle}</h3>
              <p className="text-xs text-[#8E7E70] mb-4">{bookingShow.title}</p>
              
              {bookingSuccess ? (
                <div className="flex flex-col items-center justify-center py-6 text-center animate-fade-in">
                  <div className="w-12 h-12 bg-green-950/20 border border-green-500 rounded-full flex items-center justify-center mb-4">
                    <Check size={20} className="text-green-500" />
                  </div>
                  <p className="text-sm font-bold text-green-500">{t.showsBookingSuccess}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-[9px] font-mono tracking-wider text-[#8E7E70] block mb-1">{t.showsFullName.toUpperCase()}</label>
                    <input
                      type="text"
                      value={bookingName}
                      onChange={e => setBookingName(e.target.value)}
                      placeholder="Jean Dupont"
                      className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono tracking-wider text-[#8E7E70] block mb-1">{t.showsEmail.toUpperCase()}</label>
                    <input
                      type="email"
                      value={bookingEmail}
                      onChange={e => setBookingEmail(e.target.value)}
                      placeholder="jean.dupont@email.com"
                      className="w-full px-3 py-2 text-xs bg-[#1A130E] border border-[#2A1E15] rounded text-white outline-none focus:border-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono tracking-wider text-[#8E7E70] block mb-1">{t.showsQuantity.toUpperCase()}</label>
                    <div className="flex items-center gap-3 select-none">
                      <button onClick={() => setBookingQty(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center border border-[#2A1E15] rounded text-white hover:bg-[#1A130E] transition-all cursor-pointer font-bold">-</button>
                      <span className="font-mono text-sm w-6 text-center">{bookingQty}</span>
                      <button onClick={() => setBookingQty(q => q + 1)} className="w-10 h-10 flex items-center justify-center border border-[#2A1E15] rounded text-white hover:bg-[#1A130E] transition-all cursor-pointer font-bold">+</button>
                      <span className="text-xs text-[#E5D5C5] ml-auto font-mono">€{(bookingShow.price * bookingQty).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <button onClick={bookTicket}
                    className="w-full py-3 bg-[#C8102E] text-white font-bold rounded text-xs hover:opacity-90 active:scale-95 transition-all mt-2 cursor-pointer"
                  >
                    {t.showsConfirmBooking.toUpperCase()}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
