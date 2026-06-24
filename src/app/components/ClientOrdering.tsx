import { useState, useEffect } from "react";
import { ShoppingCart, Plus, Minus, X, ChevronLeft, Check, Clock, Flame, Star, Search, RefreshCw, AlertCircle, ChevronDown } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { supabase } from "../../lib/supabase";
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from "motion/react";
import { translations, Language } from "../../lib/translations";
import { OrderTracker } from "./OrderTracker";
import { ProductWizard } from "./ProductWizard";

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

function fetchWithTimeout<T>(promise: Promise<T>, timeoutMs = 3500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Database connection timed out"));
    }, timeoutMs);
    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

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

function AnimatedPrice({ value }: { value: number }) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (latest) => latest.toFixed(2));
  
  useEffect(() => {
    const controls = animate(motionValue, value, {
      type: "spring",
      damping: 30,
      stiffness: 200
    });
    return controls.stop;
  }, [value, motionValue]);
  
  return <motion.span>{rounded}</motion.span>;
}

export function ClientOrdering({ tableId, area }: { tableId: string; area: string }) {
  const [menuItems, setMenuItems] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("ldf_menu_items");
      if (local) {
        try {
          return JSON.parse(local);
        } catch (_) {}
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("ldf_menu_items");
      if (local) return false;
    }
    return true;
  });
  const [dbError, setDbError] = useState(false);

  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [status, setStatus] = useState<OrderStatus>("browsing");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [customizations, setCustomizations] = useState<Record<string, string | string[]>>({});
  const [search, setSearch] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [tableActive, setTableActive] = useState(true);
  const [waiterCallPending, setWaiterCallPending] = useState(false);
  const [waiterCallTimer, setWaiterCallTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [lastOrderedItems, setLastOrderedItems] = useState<any[]>([]);
  const [lastOrderedTotal, setLastOrderedTotal] = useState<number>(0);
  const [addingItemIds, setAddingItemIds] = useState<Record<string, boolean>>({});
  const [noteExpanded, setNoteExpanded] = useState(false);

  // Bilingual State
  const [lang, setLang] = useState<Language>("fr");
  const t = translations[lang];

  // Active Order (Unpaid Session Pursuit)
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [activeOrderItems, setActiveOrderItems] = useState<any[]>([]);

  const downloadInvoicePNG = (id: string, table: string, itemsList?: any[]) => {
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
      ctx.fillText(lang === "fr" ? "Merci pour votre confiance !" : "Thank you for your trust!", canvasWidth / 2, 445);

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

  // Waiter State
  const [waiterCalled, setWaiterCalled] = useState(false);

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

  // Payment Selection
  const [selectedPayment, setSelectedPayment] = useState<"cash" | "visa" | "apple">("cash");

  // Shows Ticketing State
  const [shows, setShows] = useState<any[]>([]);
  const [bookingShow, setBookingShow] = useState<any | null>(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingQty, setBookingQty] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Hero Config State
  const [heroConfig, setHeroConfig] = useState<any>(null);

  const loadHeroConfig = async () => {
    try {
      const { data, error } = await fetchWithTimeout(
        supabase
          .from("hero_config")
          .select("*")
          .eq("id", "current")
          .limit(1)
      );
      if (!error && data && data.length > 0) {
        setHeroConfig(data[0]);
      }
    } catch (err) {
      console.warn("ClientOrdering: could not load hero configuration:", err);
    }
  };

  const loadTableStatus = async () => {
    if (tableId?.toUpperCase() === "DELIVERY" || tableId?.toUpperCase() === "TEST") return;
    try {
      const { data, error } = await fetchWithTimeout(
        supabase
          .from("restaurant_tables")
          .select("active")
          .eq("id", tableId)
          .single()
      );
      if (!error && data) {
        setTableActive(data.active !== false);
      }
    } catch (err) {
      console.warn("Could not check table active status", err);
    }
  };

  // Fetch Menu from Supabase
  const loadMenu = async () => {
    try {
      if (menuItems.length === 0) {
        setLoading(true);
      }
      setDbError(false);
      
      const { data, error } = await fetchWithTimeout(
        supabase
          .from("menu_items")
          .select("*")
          .eq("active", true)
          .order("created_at", { ascending: true })
      );

      if (error) throw error;
      
      if (data && data.length > 0) {
        setMenuItems(data);
        if (typeof window !== "undefined") {
          localStorage.setItem("ldf_menu_items", JSON.stringify(data));
        }
      } else {
        setMenuItems(FALLBACK_MENU_DATA);
      }
    } catch (err) {
      console.warn("Could not load from Supabase database. Using fallback local items. Details:", err);
      setDbError(true);
      if (menuItems.length === 0) {
        const local = typeof window !== "undefined" ? localStorage.getItem("ldf_menu_items") : null;
        if (local) {
          try {
            setMenuItems(JSON.parse(local));
          } catch (_) {
            setMenuItems(FALLBACK_MENU_DATA);
          }
        } else {
          setMenuItems(FALLBACK_MENU_DATA);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadShows = async () => {
    try {
      const { data, error } = await fetchWithTimeout(
        supabase
          .from("shows")
          .select("*")
          .order("date", { ascending: true })
      );
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
      const { data, error } = await fetchWithTimeout(
        supabase
          .from("orders")
          .select("*")
          .eq("table_id", tableId)
          .eq("paid", false)
          .neq("status", "delivered")
          .order("created_at", { ascending: false })
          .limit(1)
      );

      if (error) throw error;

      if (data && data.length > 0) {
        setActiveOrder(data[0]);
        // Also fetch items for this order
        const { data: itemsData, error: itemsError } = await fetchWithTimeout(
          supabase
            .from("order_items")
            .select("*")
            .eq("order_id", data[0].id)
        );

        if (!itemsError && itemsData) {
          setActiveOrderItems(itemsData);
        }
      } else {
        throw new Error("Empty db");
      }
    } catch (err) {
      console.warn("Could not check active orders from DB, trying fallback:", err);
      if (typeof window !== "undefined") {
        const localOrders = JSON.parse(localStorage.getItem("ldf_orders") || "[]");
        const activeLocal = localOrders.filter((o: any) => o.table_id === tableId && !o.paid && o.status !== "delivered");
        if (activeLocal.length > 0) {
          const latest = activeLocal.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          setActiveOrder(latest);
          const localItems = JSON.parse(localStorage.getItem("ldf_order_items") || "[]");
          setActiveOrderItems(localItems.filter((i: any) => i.order_id === latest.id));
          return;
        }
      }
      setActiveOrder(null);
      setActiveOrderItems([]);
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
      alert("Ticket purchase failed. Please check your connection and try again.");
      setBookingSuccess(false);
    }
  };

  useEffect(() => {
    loadMenu();
    loadShows();
    checkActiveOrder();
    loadHeroConfig();

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

    // Subscribe to hero banner config updates
    const heroChannel = supabase
      .channel("hero-client-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hero_config" },
        () => {
          loadHeroConfig();
        }
      )
      .subscribe();

    // Initialize order ID
    setOrderId(`ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`);

    return () => {
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(heroChannel);
    };
  }, []);

  useEffect(() => {
    if (menuItems.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const targetProdId = params.get("product");
      if (targetProdId) {
        const item = menuItems.find(i => i.id === targetProdId);
        if (item) {
          const fields = item.customFields || item.custom_fields;
          if (Array.isArray(fields) && fields.length > 0) {
            openCustomize(item);
          } else {
            // No custom fields - add to cart directly and open the cart screen!
            const k = `${item.id}-{}`;
            setCart(prev => {
              const existing = prev.find(i => i.itemKey === k);
              if (existing) return prev.map(i => i.itemKey === k ? { ...i, quantity: i.quantity + 1 } : i);
              return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, customizations: {}, itemKey: k }];
            });
            setStatus("cart");
          }
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

  const handleAddItemDirectly = (item: any) => {
    const k = `${item.id}-{}`;

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }

    setAddingItemIds(p => ({ ...p, [item.id]: true }));
    setTimeout(() => {
      setAddingItemIds(p => ({ ...p, [item.id]: false }));
    }, 500);

    setCart(prev => {
      const existing = prev.find(i => i.itemKey === k);
      if (existing) return prev.map(i => i.itemKey === k ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, customizations: {}, itemKey: k }];
    });
  };

  const handleProductCardClick = (item: any) => {
    const fields = item.customFields || item.custom_fields;
    openCustomize(item);
    if (!Array.isArray(fields) || fields.length === 0) {
      setCustomizations({});
    }
  };

  function addToCart() {
    if (!selectedItem) return;
    const finalPrice = getItemPriceWithModifiers();
    const key = `${selectedItem.id}-${JSON.stringify(customizations)}`;
    
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }
    
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

  // Synthesize/Register Waiter Call logic
  async function handleCallWaiter() {
    if (waiterCallPending) return;
    try {
      if (supabase.isMock) {
        // Mock DB implementation
        const localCalls = JSON.parse(localStorage.getItem("ldf_waiter_calls") || "[]");
        const newCall = {
          id: `call-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          order_id: orderId || null,
          table_id: tableId,
          area: area || "Terrace Patio",
          status: "pending",
          called_at: new Date().toISOString()
        };
        localCalls.push(newCall);
        localStorage.setItem("ldf_waiter_calls", JSON.stringify(localCalls));
        window.dispatchEvent(new Event("ldf-db-update"));
      } else {
        await supabase.from("waiter_calls").insert({
          order_id: orderId || null,
          table_id: tableId,
          area: area || "Terrace Patio",
          status: "pending"
        });
      }
      setWaiterCallPending(true);
      navigator.vibrate?.([100, 50, 100]);
      const timer = setTimeout(() => setWaiterCallPending(false), 90000);
      setWaiterCallTimer(timer);
    } catch (err) {
      console.error("Failed to call waiter", err);
    }
  }

  // Subscribe to waiter calls acknowledgement to reset pending state
  useEffect(() => {
    if (!orderId) return;

    let subscription: any = null;
    if (!supabase.isMock) {
      subscription = supabase
        .channel(`waiter-calls-client-${orderId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "waiter_calls",
            filter: `order_id=eq.${orderId}`,
          },
          (payload: any) => {
            if (payload.new && payload.new.status === "acknowledged") {
              if (waiterCallTimer) {
                clearTimeout(waiterCallTimer);
              }
              setWaiterCallPending(false);
            }
          }
        )
        .subscribe();
    } else {
      const handleMockUpdate = () => {
        try {
          const localCalls = JSON.parse(localStorage.getItem("ldf_waiter_calls") || "[]");
          const activeCall = localCalls.find((c: any) => c.order_id === orderId);
          if (activeCall && activeCall.status === "acknowledged") {
            if (waiterCallTimer) {
              clearTimeout(waiterCallTimer);
            }
            setWaiterCallPending(false);
          }
        } catch (_) {}
      };
      window.addEventListener("ldf-db-update", handleMockUpdate);
      return () => {
        window.removeEventListener("ldf-db-update", handleMockUpdate);
      };
    }

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [orderId, waiterCallTimer]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (waiterCallTimer) {
        clearTimeout(waiterCallTimer);
      }
    };
  }, [waiterCallTimer]);

  // Submit Order to Supabase Database
  async function placeOrder() {
    if (cart.length === 0) return;
    setStatus("ordering");

    const newOrderId = `ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    setOrderId(newOrderId);

    let finalNote = orderNote;
    if (tableId?.toUpperCase() === "DELIVERY") {
      if (!deliveryName || !deliveryPhone || !deliveryAddress) {
        alert(t.deliveryError || "Please provide your name, phone number, and delivery address.");
        setStatus("checkout");
        return;
      }
      finalNote = `DELIVERY INFO:\nName: ${deliveryName}\nEmail: ${deliveryEmail || 'N/A'}\nPhone: ${deliveryPhone}\nAddress: ${deliveryAddress}\n\nNote: ${orderNote}`;
    }
    
    try {
      // 1. Write the main order header to public.orders
      const { error: orderError } = await supabase
        .from("orders")
        .insert({
          id: newOrderId,
          table_id: tableId,
          area: area || "Terrace Patio",
          status: "pending",
          total: cartTotal,
          note: finalNote || null,
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

      setLastOrderedItems([...cart]);
      setLastOrderedTotal(cartTotal);
      setStatus("confirmed");
      setCart([]); // Clean local basket
      setOrderNote("");
    } catch (err: any) {
      console.error("Order submission failed:", err);
      alert(`Order submission failed: ${err?.message || "Please check your internet connection"}. Please try again or ask a waiter.`);
      setStatus("checkout");
    }
  }

  // Check table status
  if (!tableActive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
            <X size={32} />
          </div>
          <h2 className="font-serif font-black text-foreground text-2xl mb-4">Section Fermée</h2>
          <p className="text-muted-foreground font-mono text-sm leading-relaxed">
            Prenez place dans le salon intérieur pour passer votre commande.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-t-[#C8102E] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full border border-t-transparent border-r-[#E5D5C5] border-b-transparent border-l-transparent animate-spin-reverse" />
        </div>
        <p className="text-xs font-mono tracking-widest text-muted-foreground animate-pulse">CONNECTING TO MATRIX...</p>
      </div>
    );
  }

  if (status === "confirmed") {
    const formattedItems = lastOrderedItems.map(i => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      customizations: i.customizations
    }));

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 w-full">
        <OrderTracker
          orderId={orderId}
          orderNumber={orderId}
          tableId={tableId}
          area={area}
          items={formattedItems}
          totalPrice={lastOrderedTotal}
          language={lang}
          onCallWaiter={handleCallWaiter}
          onNewOrder={() => {
            setStatus("browsing");
            setCart([]);
            checkActiveOrder(); // Sync
            setOrderId(`ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`);
          }}
          waiterCallPending={waiterCallPending}
        />
      </div>
    );
  }

  if (status === "customizing" && selectedItem) {
    // Left for safety, but we will handle it overlay-style. We can return null or keep it just in case.
    // Actually, we've removed the early exit, so let's delete this block completely.
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-screen pb-28 bg-transparent text-foreground relative"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-secondary border-b border-border backdrop-blur-xl shadow-lg">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="font-serif font-black text-lg text-foreground leading-tight">Le Double Face</span>
            <div className="flex items-center flex-wrap gap-1.5">
              {/* Permanent Context Pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/25 rounded-full text-[9px] text-primary font-mono font-black tracking-wider uppercase">
                <span>🍽️ {tableId?.toUpperCase() === "DELIVERY" ? (lang === "fr" ? "LIVRAISON" : "DELIVERY") : `TABLE ${tableId}`}</span>
                <span className="opacity-40">•</span>
                <span>{area}</span>
              </div>
              <div className="flex items-center gap-1 bg-muted border border-border px-2 py-0.5 rounded-full text-[9px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: (!supabase || supabase.isMock || dbError) ? '#EF4444' : '#10B981' }} />
                <span className="text-muted-foreground uppercase tracking-wider text-[7px]">
                  {(!supabase || supabase.isMock || dbError) ? 'Offline' : 'Online'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Waiter Call Button */}
            {tableId?.toUpperCase() !== "DELIVERY" && (
              <button
                onClick={callServer}
                disabled={waiterCalled}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all border flex items-center gap-1 ${
                  waiterCalled ? "bg-primary/20 border-primary text-primary animate-pulse cursor-not-allowed" : "bg-background/60 border-border text-foreground cursor-pointer hover:bg-black/60"
                }`}
              >
                <span>🛎️</span>
                <span className="hidden xs:inline">{t.callWaiter.split(" ")[1]}</span>
              </button>
            )}

            {/* Language Switcher */}
            <button
              onClick={() => setLang(l => l === "fr" ? "en" : "fr")}
              className="p-2 bg-card rounded-lg border border-border transition-all hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              title="Change Language"
            >
              <span className="text-[10px] font-black font-mono">{lang.toUpperCase()}</span>
            </button>

            {/* Cart Button */}
            <button onClick={() => setStatus("cart")} className="relative p-2 bg-card rounded-lg border border-border transition-all hover:bg-muted cursor-pointer">
              <ShoppingCart size={18} className={cartCount > 0 ? "text-primary" : "text-muted-foreground"} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full bg-primary text-foreground">{cartCount}</span>
              )}
            </button>
          </div>
        </div>

        {dbError && (
          <div className="bg-[#EF4444]/15 border-t border-border px-4 py-2.5 text-[10px] text-[#EF4444] font-mono leading-relaxed flex items-center justify-between gap-4">
            <span>⚠️ <strong>Connection Error</strong>: Could not connect to the restaurant database. Orders may not sync to the kitchen.</span>
            <button 
              onClick={loadMenu}
              className="flex-shrink-0 px-2.5 py-1 bg-[#EF4444]/25 border border-[#EF4444]/40 hover:bg-[#EF4444]/35 active:scale-95 text-foreground rounded text-[9px] font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap"
            >
              RETRY CONNECTION
            </button>
          </div>
        )}

        <div className="px-4 pb-3">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.menuSearch}
              className="w-full pl-9 pr-4 py-2 text-xs bg-card border border-border rounded text-foreground outline-none focus:border-primary transition-colors"
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

      {/* Hero Banner CMS Display */}
      {heroConfig?.show_in_menu && (
        <div className="relative h-48 sm:h-56 overflow-hidden border-b border-border mb-4 select-none">
          <ImageWithFallback src={heroConfig.image} alt="Hero Banner" className="w-full h-full object-cover" style={{ opacity: 0.35 }} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0704] via-[#0A0704]/40 to-transparent" />
          <div className="absolute inset-x-4 bottom-4 flex flex-col justify-end">
            <span className="font-mono text-[9px] text-primary tracking-widest font-black uppercase mb-1">🛎️ LE DOUBLE FACE</span>
            <h1 className="font-serif font-black text-xl sm:text-2xl text-foreground leading-tight">
              {lang === "fr" ? heroConfig.title1_fr : heroConfig.title1_en} <span className="text-primary italic">{lang === "fr" ? heroConfig.title2_fr : heroConfig.title2_en}</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2 max-w-md">
              {lang === "fr" ? heroConfig.subtitle_fr : heroConfig.subtitle_en}
            </p>
          </div>
        </div>
      )}

      {/* Database Warning indicator */}
      {dbError && (
        <div className="mx-4 my-2 px-3 py-2 bg-muted border border-dashed border-[#8E7E70]/30 rounded text-[10px] text-muted-foreground flex items-center justify-between">
          <span>⚠️ Offline simulated mode</span>
          <button onClick={loadMenu} className="hover:text-foreground cursor-pointer"><RefreshCw size={10} /></button>
        </div>
      )}

      {/* Active Order Progress Banner (Persistence Session Pursuit) */}
      {activeOrder && (
        <div className="mx-4 my-3 p-4 bg-red-950/15 border border-primary/40 rounded-xl glass-panel animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="font-serif font-bold text-sm text-foreground">{t.activeOrderTitle}</span>
            <span className="font-mono text-[9px] font-bold text-foreground bg-primary px-2 py-0.5 rounded uppercase tracking-wider">{activeOrder.status}</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug mb-3">
            {t.activeOrderDesc} (<span className="font-mono text-foreground select-all">{activeOrder.id}</span>)
          </p>
          <div className="flex flex-col gap-1.5 mb-3 border-t border-border/30 pt-2 pb-2">
            {activeOrderItems.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-[10px] text-foreground">
                <span>{item.quantity}x {item.name}</span>
                <span className="font-mono">€{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 flex justify-between items-center">
            <span>Total: €{activeOrder.total?.toFixed(2)}</span>
            <button 
              onClick={() => downloadInvoicePNG(activeOrder.id, activeOrder.table_id || tableId, activeOrderItems)}
              className="px-2 py-1 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded text-[8px] font-bold tracking-wider transition-all cursor-pointer flex items-center gap-1"
            >
              📥 PNG
            </button>
            <span className="text-primary font-extrabold tracking-widest text-[9px] animate-pulse">{t.orderMoreBtn}</span>
          </div>
        </div>
      )}

      {/* Popular Section (Horizontal Carousel) */}
      {activeCategory === "All" && !search && (
        <div className="px-4 pt-5 mb-2">
          <div className="flex items-center gap-1.5 mb-4 text-primary">
            <Flame size={14} />
            <span className="font-mono text-[9px] tracking-widest font-black uppercase">{t.heroSpecial}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {menuItems.filter(i => i.popular).map(item => {
              return (
                <button 
                  key={item.id} 
                  onClick={() => handleProductCardClick(item)}
                  className="relative flex-shrink-0 w-36 overflow-hidden text-left bg-card border border-border rounded hover:border-primary transition-all cursor-pointer"
                >
                  <AnimatePresence>
                    {addingItemIds[item.id] && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-10"
                      >
                        <motion.div
                          initial={{ scale: 0.5, rotate: -20 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0.8 }}
                          transition={{ type: "spring", damping: 12, stiffness: 200 }}
                          className="w-10 h-10 rounded-full bg-[#10B981] flex items-center justify-center text-foreground shadow-lg shadow-[#10B981]/25"
                        >
                          <Check size={20} className="stroke-[3px]" />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="h-24 bg-muted overflow-hidden">
                    <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2.5">
                    <div className="text-xs font-bold text-foreground truncate">{item.name}</div>
                    <div className="font-mono text-[10px] text-primary font-bold mt-1">€{item.price.toFixed(2)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid/List */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="font-mono text-[9px] text-muted-foreground tracking-widest uppercase">{t.navMenu}</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            return (
              <motion.div 
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                animate={addingItemIds[item.id] ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
                key={item.id} 
                onClick={() => handleProductCardClick(item)}
                className="relative flex gap-3 glass-panel rounded-xl overflow-hidden cursor-pointer select-none transition-colors duration-200 hover:bg-white/[0.03] active:bg-white/[0.05]"
              >
                <AnimatePresence>
                  {addingItemIds[item.id] && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-10"
                    >
                      <motion.div
                        initial={{ scale: 0.5, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0.8 }}
                        transition={{ type: "spring", damping: 12, stiffness: 200 }}
                        className="w-12 h-12 rounded-full bg-[#10B981] flex items-center justify-center text-foreground shadow-lg shadow-[#10B981]/25"
                      >
                        <Check size={24} className="stroke-[3px]" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="w-24 h-24 bg-background/60 flex-shrink-0 relative">
                  <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="flex items-start justify-between gap-1.5">
                      <h3 className="font-serif font-bold text-sm text-foreground truncate">{item.name}</h3>
                      {item.popular && <Star size={11} className="text-primary fill-[#C8102E] flex-shrink-0 mt-0.5" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mt-1">{item.desc}</p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                    <span className="font-mono text-xs font-bold text-primary">€{item.price.toFixed(2)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // prevent card double tap trigger
                        handleAddItemDirectly(item);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:opacity-90 text-[11px] font-bold text-foreground rounded transition-all cursor-pointer shadow-sm shadow-[#C8102E]/20">
                      <Plus size={11} /> {lang === "fr" ? "Ajouter" : "Add"}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-xs text-muted-foreground border border-border border-dashed rounded mt-4">{t.emptyMenu}</div>
        )}
      </div>

      {/* Shows section */}
      {shows.length > 0 && (
        <div className="px-4 pt-6 border-t border-border/50 mt-8 mb-4">
          <div className="flex items-center gap-1.5 mb-4 text-primary">
            <Star size={14} className="fill-[#C8102E]" />
            <span className="font-mono text-[9px] tracking-widest font-black uppercase">{t.showsHeader}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {shows.map(show => (
              <div 
                key={show.id} 
                onClick={() => setBookingShow(show)}
                className="p-4 bg-card border border-border rounded-xl flex gap-3.5 cursor-pointer select-none transition-colors duration-200 hover:bg-muted active:bg-[#1C1510] hover:border-primary/30"
              >
                <div className="w-20 h-20 rounded overflow-hidden flex-shrink-0 bg-background/60">
                  <ImageWithFallback src={show.image} alt={show.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-serif font-bold text-sm text-foreground">{show.title}</h4>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">{show.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                    <span className="font-mono text-xs font-bold text-primary">€{show.price?.toFixed(2)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBookingShow(show);
                      }}
                      className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-[10px] font-bold text-foreground rounded cursor-pointer transition-all shadow-sm shadow-[#C8102E]/20"
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

      {/* Sticky Cart Bar (Zero-friction bottom sticky bar) */}
      <AnimatePresence>
        {cartCount > 0 && status === "browsing" && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-30 bg-primary text-foreground shadow-2xl border-t border-primary/20"
          >
            <button 
              onClick={() => setStatus("cart")}
              className="w-full py-4 flex items-center justify-between px-6 font-bold transition-all hover:bg-black/10 active:opacity-90 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 flex items-center justify-center text-[10px] font-black rounded-full bg-white/20">
                  {cartCount}
                </span>
                <span className="text-xs font-black tracking-widest">
                  {t.cartTitle.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-sm">
                <span>€</span>
                <AnimatedPrice value={cartTotal} />
                <span className="ml-1 text-foreground/70">→</span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ticket Booking Modal */}
      <AnimatePresence>
        {bookingShow && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 text-foreground"
          >
            <div className="w-full max-w-sm bg-card border border-border p-5 rounded-2xl relative">
              <button onClick={() => setBookingShow(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={18} />
              </button>
              
              <h3 className="font-serif font-black text-lg mb-2 text-foreground">{t.showsBookTitle}</h3>
              <p className="text-xs text-muted-foreground mb-4">{bookingShow.title}</p>
              
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
                    <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1">{t.showsFullName.toUpperCase()}</label>
                    <input
                      type="text"
                      value={bookingName}
                      onChange={e => setBookingName(e.target.value)}
                      placeholder="Jean Dupont"
                      className="w-full px-3 py-2 text-xs bg-muted border border-border rounded text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1">{t.showsEmail.toUpperCase()}</label>
                    <input
                      type="email"
                      value={bookingEmail}
                      onChange={e => setBookingEmail(e.target.value)}
                      placeholder="jean.dupont@email.com"
                      className="w-full px-3 py-2 text-xs bg-muted border border-border rounded text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1">{t.showsQuantity.toUpperCase()}</label>
                    <div className="flex items-center gap-3 select-none">
                      <button onClick={() => setBookingQty(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center border border-border rounded text-foreground hover:bg-muted transition-all cursor-pointer font-bold">-</button>
                      <span className="font-mono text-sm w-6 text-center">{bookingQty}</span>
                      <button onClick={() => setBookingQty(q => q + 1)} className="w-10 h-10 flex items-center justify-center border border-border rounded text-foreground hover:bg-muted transition-all cursor-pointer font-bold">+</button>
                      <span className="text-xs text-foreground ml-auto font-mono">€{(bookingShow.price * bookingQty).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <button onClick={bookTicket}
                    className="w-full py-3 bg-primary text-foreground font-bold rounded text-xs hover:opacity-90 active:scale-95 transition-all mt-2 cursor-pointer"
                  >
                    {t.showsConfirmBooking.toUpperCase()}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diagnostics / Sync Support Footer */}
      <footer className="mt-16 px-4 py-8 border-t border-border/30 flex flex-col items-center gap-2 text-center bg-[#0C0805]/50 backdrop-blur-sm">
        <p className="font-serif italic text-[11px] text-muted-foreground">Le Double Face Zero-Friction Dining</p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] font-mono mt-1 text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>DB URL:</span>
            <span className="text-foreground font-bold">{import.meta.env.VITE_SUPABASE_URL ? import.meta.env.VITE_SUPABASE_URL.replace("https://", "") : "NOT DEFINED"}</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-secondary/80 hidden md:block" />
          <div className="flex items-center gap-1">
            <span>STATUS:</span>
            {(!supabase || supabase.isMock || dbError) ? (
              <span className="flex items-center gap-1 font-bold text-[#EF4444]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" /> OFFLINE
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-[#10B981]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> ONLINE
              </span>
            )}
          </div>
        </div>
        
        <button
          onClick={forceReload}
          className="mt-3 px-3 py-1.5 bg-secondary border border-border hover:bg-secondary/80 active:scale-95 text-foreground rounded text-[9px] font-mono transition-all cursor-pointer"
        >
          🔄 Refresh App Connection (Reset Cache)
        </button>
        {/* Customization Wizard */}
        {status === "customizing" && selectedItem && (
          <ProductWizard
            item={selectedItem}
            lang={lang}
            onClose={() => {
              setStatus("browsing");
              setSelectedItem(null);
            }}
            onAddToCart={(customizations, finalPrice) => {
              const key = `${selectedItem.id}-${JSON.stringify(customizations)}`;
              
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(50);
              }
              
              setCart(prev => {
                const existing = prev.find(i => i.itemKey === key);
                if (existing) return prev.map(i => i.itemKey === key ? { ...i, quantity: i.quantity + 1 } : i);
                return [...prev, { id: selectedItem.id, name: selectedItem.name, price: finalPrice, quantity: 1, customizations, itemKey: key }];
              });
              setStatus("browsing");
              setSelectedItem(null);
            }}
          />
        )}
      </footer>

      {/* Zero-friction Bottom Sheets */}
      <AnimatePresence>
        {/* Cart Bottom Sheet */}
        {status === "cart" && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStatus("browsing")}
              className="fixed inset-0 bg-black/80 backdrop-blur-[2px] z-40"
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 1 }}
              onDragEnd={(e, info) => {
                if (info.offset.y > 150) {
                  setStatus("browsing");
                }
              }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-card border-t border-border rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1 bg-[#2A1E15] rounded-full mx-auto my-3 flex-shrink-0" />
              
              {/* Header */}
              <div className="px-4 pb-3 flex items-center justify-between border-b border-border/30">
                <span className="font-serif font-bold text-base text-foreground">{t.cartTitle} · Table {tableId}</span>
                <button onClick={() => setStatus("browsing")} className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  {lang === "fr" ? "Fermer" : "Close"}
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <ShoppingCart size={40} className="text-[#2A1E15] mb-3" />
                    <p className="text-xs text-muted-foreground">{t.cartEmpty}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2.5 mb-6">
                      {cart.map(item => (
                        <div key={item.itemKey} className="p-3.5 bg-muted/50 border border-border rounded-xl">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-foreground text-xs">{item.name}</span>
                            <span className="font-mono text-xs font-bold text-primary">€{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                          {Object.entries(item.customizations).map(([k, v]) => v && (Array.isArray(v) ? v.length > 0 : true) && (
                            <div key={k} className="text-[10px] text-muted-foreground mb-0.5">
                              {Array.isArray(v) ? v.join(", ") : v}
                            </div>
                          ))}
                          <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-border/30 select-none">
                            <button onClick={() => adjustQty(item.itemKey, -1)}
                              className="w-8 h-8 flex items-center justify-center border border-border rounded-lg text-foreground hover:bg-muted transition-all cursor-pointer">
                              <Minus size={12} />
                            </button>
                            <span className="font-mono text-xs font-bold text-foreground w-5 text-center">{item.quantity}</span>
                            <button onClick={() => adjustQty(item.itemKey, 1)}
                              className="w-8 h-8 flex items-center justify-center bg-primary text-foreground rounded-lg hover:opacity-90 transition-all cursor-pointer">
                              <Plus size={12} />
                            </button>
                            <button onClick={() => adjustQty(item.itemKey, -item.quantity)} className="ml-auto text-muted-foreground hover:text-foreground cursor-pointer p-1.5" title="Remove">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 bg-muted/50 border border-border rounded-xl mb-6">
                      <div className="flex justify-between mb-1.5 text-[11px] text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="font-mono">€{cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mb-1.5 text-[11px] text-muted-foreground">
                        <span>Service</span>
                        <span>Included</span>
                      </div>
                      <div className="flex justify-between pt-2.5 mt-2.5 border-t border-border/30 font-black text-xs text-foreground">
                        <span>Total</span>
                        <span className="font-mono text-sm text-primary">€{cartTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {cart.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card z-10">
                  <button onClick={() => setStatus("checkout")}
                    className="w-full py-4 text-xs font-bold tracking-widest bg-primary hover:opacity-95 text-foreground rounded-xl transition-all active:scale-98 cursor-pointer shadow-lg shadow-[#C8102E]/20">
                    {t.checkoutBtn.toUpperCase()}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}

        {/* Checkout Bottom Sheet */}
        {(status === "checkout" || status === "ordering") && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (status !== "ordering") setStatus("cart");
              }}
              className="fixed inset-0 bg-black/80 backdrop-blur-[2px] z-40"
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              drag={status === "ordering" ? false : "y"}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 1 }}
              onDragEnd={(e, info) => {
                if (info.offset.y > 150) {
                  setStatus("cart");
                }
              }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-card border-t border-border rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1 bg-[#2A1E15] rounded-full mx-auto my-3 flex-shrink-0" />
              
              {/* Header */}
              <div className="px-4 pb-3 flex items-center justify-between border-b border-border/30">
                <span className="font-serif font-bold text-base text-foreground">{t.paymentTitle}</span>
                <button
                  disabled={status === "ordering"}
                  onClick={() => setStatus("cart")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {lang === "fr" ? "Retour" : "Back"}
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
                {tableId?.toUpperCase() === "DELIVERY" && (
                  <div className="mb-6 p-4 bg-muted/50 border border-border rounded-xl">
                    <h3 className="font-serif font-bold text-foreground text-sm mb-3">{t.deliveryDetails}</h3>
                    <div className="flex flex-col gap-2.5">
                      <input
                        type="text"
                        placeholder={t.showsFullName || "Full Name"}
                        value={deliveryName}
                        onChange={(e) => setDeliveryName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-muted border border-border rounded-xl text-foreground outline-none focus:border-primary"
                      />
                      <input
                        type="email"
                        placeholder={t.deliveryEmail || "Email Address (Optional)"}
                        value={deliveryEmail}
                        onChange={(e) => setDeliveryEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-muted border border-border rounded-xl text-foreground outline-none focus:border-primary"
                      />
                      <input
                        type="tel"
                        placeholder={t.deliveryPhone || "Phone Number"}
                        value={deliveryPhone}
                        onChange={(e) => setDeliveryPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-muted border border-border rounded-xl text-foreground outline-none focus:border-primary"
                      />
                      <textarea
                        placeholder={t.deliveryAddress || "Full Address"}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        rows={2}
                        className="w-full px-3.5 py-2.5 text-xs bg-muted border border-border rounded-xl text-foreground outline-none focus:border-primary resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Expandable Note panel (Dine-in or Delivery) */}
                <div className="mb-6 bg-muted/30 border border-border p-3.5 rounded-xl">
                  <button
                    onClick={() => setNoteExpanded(!noteExpanded)}
                    className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors font-mono uppercase tracking-wider cursor-pointer"
                  >
                    <span>{lang === "fr" ? "+ Ajouter une note (allergies, etc.)" : "+ Add a note (allergies, etc.)"}</span>
                    <ChevronDown size={14} className={`transform transition-transform duration-200 ${noteExpanded ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {noteExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: "auto", opacity: 1, marginTop: 10 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <textarea
                          value={orderNote}
                          onChange={e => setOrderNote(e.target.value)}
                          rows={2}
                          placeholder={lang === "fr" ? "Allergies, demandes spéciales..." : "Allergies, special requests..."}
                          className="w-full px-3.5 py-2.5 text-xs bg-muted border border-border rounded-xl text-foreground outline-none focus:border-primary transition-colors resize-none"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <p className="text-[11px] text-muted-foreground mb-4">{t.paymentDesc}</p>
                
                <div className="flex flex-col gap-2.5 mb-6">
                  {[
                    { id: "visa" as const, label: t.paymentVisa, disabled: true },
                    { id: "apple" as const, label: t.paymentApplePay, disabled: true },
                    { 
                      id: "cash" as const, 
                      label: tableId?.toUpperCase() === "DELIVERY" 
                        ? (lang === "fr" ? "Paiement en espèces à la livraison" : "Cash on delivery (Pay at door)")
                        : t.paymentCash, 
                      disabled: false 
                    }
                  ].map(method => (
                    <button
                      key={method.id}
                      disabled={method.disabled}
                      onClick={() => setSelectedPayment(method.id)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                        method.disabled ? "opacity-30 cursor-not-allowed border-border bg-zinc-950/20" :
                        selectedPayment === method.id ? "border-primary bg-red-950/10 cursor-pointer" : "border-border bg-card hover:bg-muted cursor-pointer"
                      }`}
                    >
                      <span className={`text-xs font-semibold ${selectedPayment === method.id ? "text-foreground" : "text-muted-foreground"}`}>{method.label}</span>
                      <div className="w-4 h-4 rounded-full border flex items-center justify-center" style={{ borderColor: selectedPayment === method.id ? "#C8102E" : "#2A1E15" }}>
                        {selectedPayment === method.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Action */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card z-10">
                <button onClick={placeOrder}
                  disabled={status === "ordering"}
                  className="w-full py-4 text-xs font-black tracking-widest bg-primary hover:opacity-95 text-foreground rounded-xl transition-all active:scale-98 cursor-pointer shadow-lg shadow-[#C8102E]/25">
                  {status === "ordering" ? (lang === "fr" ? "TRANSMISSION DU TICKET..." : "TRANSMITTING TICKET...") : `${lang === "fr" ? "COMMANDER" : "PLACE ORDER"} · ${cartTotal.toFixed(2)}€`}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
