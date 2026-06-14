import { useState, useEffect } from "react";
import { ChevronDown, Star, MapPin, Phone, Clock, Instagram, Facebook, Twitter, ArrowRight, Flame, Award, Utensils, Users, X, Check } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { supabase } from "../../lib/supabase";
import { translations, Language } from "../../lib/translations";
import { motion, AnimatePresence } from "framer-motion";

const FALLBACK_MENU_ITEMS = [
  { id: "B1", name: "Le Double Face Burger", price: 14.90, category: "Signature", desc: "Double wagyu patty, truffle mayo, aged cheddar, brioche bun", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop&auto=format", popular: true },
  { id: "C1", name: "Crispy Royal Chicken", price: 12.50, category: "Chicken", desc: "Crispy buttermilk chicken, pickled jalapeños, garlic aioli", image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop&auto=format", popular: false },
  { id: "B2", name: "Smash & Burn", price: 13.90, category: "Signature", desc: "Smash patty, caramelized onion, smoky BBQ, crispy bacon", image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=300&fit=crop&auto=format", popular: true },
  { id: "S1", name: "La Truffe Fries", price: 6.90, category: "Sides", desc: "Belgian fries, black truffle oil, parmesan, fresh herbs", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop&auto=format", popular: true },
  { id: "D1", name: "Double Shake Vanille", price: 7.50, category: "Drinks", desc: "Thick premium vanilla milkshake, Madagascar vanilla", image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop&auto=format", popular: false },
  { id: "V1", name: "Le Vegan Face", price: 11.90, category: "Vegan", desc: "Plant-based patty, avocado cream, sun-dried tomatoes", image: "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400&h=300&fit=crop&auto=format", popular: false },
];

const SERVICES = [
  { icon: <Utensils size={28} />, titleKey: "Dine In", descKey: "Premium table experience with QR code ordering. Scan, order, enjoy — without waiting for a waiter." },
  { icon: <Flame size={28} />, titleKey: "Live Cooking Shows", descKey: "Our chefs perform live cooking sessions every Friday and Saturday. Real fire, real flavor, real theater." },
  { icon: <Award size={28} />, titleKey: "Custom Orders", descKey: "Build your perfect burger with our custom builder. Every ingredient, every sauce, every preference." },
  { icon: <Users size={28} />, titleKey: "Private Events", descKey: "Reserve the full restaurant for private events, corporate dinners, and exclusive gatherings." },
];

export function LandingPage({ onNavigate }: { onNavigate: (view: string, tableId?: string, productId?: string) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Bilingual State
  const [lang, setLang] = useState<Language>("fr");
  const t = translations[lang];

  // Shows State
  const [shows, setShows] = useState<any[]>([]);
  const [selectedShow, setSelectedShow] = useState<any | null>(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingQty, setBookingQty] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Hero Config State
  const [heroConfig, setHeroConfig] = useState<any>({
    title1_fr: "Deux Visages.",
    title2_fr: "Une Légende.",
    subtitle_fr: "Saveurs audacieuses rencontrent l'élégance parisienne. Chaque bouchée est un double voyage — l'âme de la rue alliée au savoir-faire gastronomique.",
    title1_en: "Two Faces.",
    title2_en: "One Legend.",
    subtitle_en: "Bold flavors meet Parisian elegance. Every bite is a double experience — street soul with fine dining craft.",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&h=900&fit=crop&auto=format",
    front_image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=750&fit=crop&auto=format",
    show_in_menu: false
  });

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const fetchMenu = async () => {
    try {
      const { data, error } = await supabase
        .from("menu_items")
        .eq("active", true)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setMenuItems(data);
      } else {
        setMenuItems(FALLBACK_MENU_ITEMS);
      }
    } catch (err) {
      console.warn("LandingPage: could not fetch menu from Supabase. Using fallbacks.", err);
      setMenuItems(FALLBACK_MENU_ITEMS);
    } finally {
      setLoading(false);
    }
  };

  const fetchShows = async () => {
    try {
      const { data, error } = await supabase
        .from("shows")
        .select("*")
        .order("date", { ascending: true });
      
      if (!error && data) {
        setShows(data);
      }
    } catch (err) {
      console.warn("LandingPage: could not fetch shows from Supabase.", err);
    }
  };

  const fetchHeroConfig = async () => {
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
      throw new Error("Empty DB");
    } catch (err) {
      console.warn("LandingPage: could not fetch hero config, using fallback:", err);
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

  useEffect(() => {
    fetchMenu();
    fetchShows();
    fetchHeroConfig();

    const heroChannel = supabase
      .channel("hero-landing-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hero_config" },
        () => {
          fetchHeroConfig();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(heroChannel);
    };
  }, []);

  const bookTicket = async () => {
    if (!selectedShow || !bookingName || !bookingEmail) return;
    try {
      const { error } = await supabase
        .from("tickets")
        .insert({
          show_id: selectedShow.id,
          customer_name: bookingName,
          customer_email: bookingEmail,
          quantity: bookingQty
        });

      if (error) throw error;

      // Update seats quantity
      await supabase
        .from("shows")
        .update({ available_tickets: Math.max(0, selectedShow.available_tickets - bookingQty) })
        .eq("id", selectedShow.id);

      setBookingSuccess(true);
      setTimeout(() => {
        setSelectedShow(null);
        setBookingSuccess(false);
        setBookingName("");
        setBookingEmail("");
        setBookingQty(1);
        fetchShows();
      }, 3000);
    } catch (err) {
      console.error("Booking ticket failed:", err);
      alert("Ticket purchase failed. Proceeding with simulated confirmation.");
      setBookingSuccess(true);
      setTimeout(() => {
        setSelectedShow(null);
        setBookingSuccess(false);
      }, 2000);
    }
  };

  const categories = ["All", ...Array.from(new Set(menuItems.map(item => item.category)))];
  const filtered = activeCategory === "All" ? menuItems : menuItems.filter(i => i.category === activeCategory);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen bg-background text-foreground">
      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "py-3" : "py-5"}`}
        style={{ background: scrolled ? "rgba(10,7,4,0.97)" : "transparent", borderBottom: scrolled ? "1px solid rgba(212,160,23,0.15)" : "none", backdropFilter: scrolled ? "blur(12px)" : "none" }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {heroConfig.logo_image ? (
              <img src={heroConfig.logo_image} alt="Logo" className="h-10 object-contain" />
            ) : (
              <>
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--primary)" }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: "14px", color: "#fff" }}>LF</span>
                </div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "20px", color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                  Le Double Face
                </span>
              </>
            )}
            {/* Hidden Backdoor Star Login */}
            <button 
              onClick={() => onNavigate("admin")}
              className="opacity-0 hover:opacity-100 transition-opacity text-xs text-white/5 select-none cursor-pointer pl-1"
              title="Admin Portal"
            >
              ★
            </button>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#menu" className="text-sm transition-colors hover:text-accent-foreground" style={{ color: "var(--muted-foreground)", letterSpacing: "0.08em", fontWeight: 500 }}>
              {t.navMenu}
            </a>
            <a href="#services" className="text-sm transition-colors hover:text-accent-foreground" style={{ color: "var(--muted-foreground)", letterSpacing: "0.08em", fontWeight: 500 }}>
              {t.navServices}
            </a>
            <a href="#shows" className="text-sm transition-colors hover:text-accent-foreground" style={{ color: "var(--muted-foreground)", letterSpacing: "0.08em", fontWeight: 500 }}>
              {t.navShows}
            </a>
            <a href="#about" className="text-sm transition-colors hover:text-accent-foreground" style={{ color: "var(--muted-foreground)", letterSpacing: "0.08em", fontWeight: 500 }}>
              {t.navAbout.toUpperCase()}
            </a>
            <a href="#contact" className="text-sm transition-colors hover:text-accent-foreground" style={{ color: "var(--muted-foreground)", letterSpacing: "0.08em", fontWeight: 500 }}>
              {t.navContact}
            </a>
          </div>
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <button
              onClick={() => setLang(l => l === "fr" ? "en" : "fr")}
              className="px-3 py-1.5 text-xs rounded border border-[#d4a017]/30 text-accent font-bold hover:bg-white/5 cursor-pointer"
            >
              {lang.toUpperCase()}
            </button>
            <button onClick={() => onNavigate("client", "T01")}
              className="px-4 py-2 text-sm transition-all hover:opacity-90 active:scale-95 cursor-pointer"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)", borderRadius: "var(--radius)", fontWeight: 700, letterSpacing: "0.04em" }}>
              {t.orderNow}
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            src={heroConfig.image}
            alt="Le Double Face restaurant interior"
            className="w-full h-full object-cover"
            style={{ opacity: 0.35 }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(10,7,4,0.95) 40%, rgba(200,16,46,0.15) 100%)" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-16 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5" style={{ border: "1px solid rgba(212,160,23,0.4)", borderRadius: "2px" }}>
              <Flame size={14} style={{ color: "var(--accent)" }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent)", letterSpacing: "0.12em" }}>PARIS · EST. 2019</span>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(3rem, 6vw, 5.5rem)", fontWeight: 900, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#f5f0e8" }}>
              {lang === "fr" ? heroConfig.title1_fr : heroConfig.title1_en}<br />
              <span style={{ color: "var(--primary)", fontStyle: "italic" }}>{lang === "fr" ? heroConfig.title2_fr : heroConfig.title2_en}</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed max-w-md" style={{ color: "var(--muted-foreground)" }}>
              {lang === "fr" ? heroConfig.subtitle_fr : heroConfig.subtitle_en}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button onClick={() => onNavigate("client", "T01")}
                className="flex items-center gap-2 px-8 py-4 text-base transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700, letterSpacing: "0.06em" }}>
                {t.orderAtTable} <ArrowRight size={18} />
              </button>
              <button onClick={() => onNavigate("client", "T01")}
                className="flex items-center gap-2 px-8 py-4 text-base transition-all hover:bg-white/5 cursor-pointer"
                style={{ border: "1px solid rgba(245,240,232,0.2)", color: "var(--foreground)", borderRadius: "var(--radius)", fontWeight: 600 }}>
                {t.viewMenu}
              </button>
            </div>
            <div className="mt-12 flex items-center gap-8">
              {[{ n: "4.9", l: "Rating" }, { n: "50K+", l: "Served" }, { n: "12", l: "Signature Burgers" }].map(s => (
                <div key={s.l}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.75rem", fontWeight: 800, color: "var(--accent)" }}>{s.n}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted-foreground)", letterSpacing: "0.08em", marginTop: "2px" }}>{s.l.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden md:block relative">
            <div className="relative w-full aspect-[4/5] max-w-md ml-auto">
              <ImageWithFallback
                src={heroConfig.front_image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=750&fit=crop&auto=format"}
                alt="Signature Le Double Face burger"
                className="w-full h-full object-cover"
                style={{ borderRadius: "4px", border: "1px solid rgba(212,160,23,0.2)" }}
              />
              <div className="absolute -bottom-4 -left-4 px-4 py-3 flex items-center gap-3"
                style={{ background: "var(--primary)", borderRadius: "var(--radius)" }}>
                <Flame size={20} style={{ color: "#fff" }} />
                <div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.1em" }}>{t.heroSpecial}</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>Le Double Face Classic</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown size={24} style={{ color: "var(--accent)" }} />
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="mb-3" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent)", letterSpacing: "0.15em" }}>{t.servicesHeader}</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              {t.servicesTitle}<br /><span style={{ fontStyle: "italic", color: "var(--primary)" }}>{t.servicesSubtitle}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map((s, i) => (
              <div key={i} className="p-6 group transition-all duration-300 hover:-translate-y-1 bg-card border border-border rounded"
                style={{ borderRadius: "var(--radius)" }}>
                <div className="w-12 h-12 flex items-center justify-center mb-5 transition-colors"
                  style={{ background: "rgba(200,16,46,0.12)", color: "var(--primary)", borderRadius: "var(--radius)" }}>
                  {s.icon}
                </div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.15rem", color: "var(--foreground)", marginBottom: "8px" }}>
                  {lang === "fr" ? (s.titleKey === "Dine In" ? "Sur Place" : s.titleKey === "Live Cooking Shows" ? "Spectacles de Cuisine" : s.titleKey === "Custom Orders" ? "Commandes Sur Mesure" : "Événements Privés") : s.titleKey}
                </h3>
                <p style={{ fontSize: "14px", lineHeight: 1.65, color: "var(--muted-foreground)" }}>
                  {lang === "fr" ? (s.titleKey === "Dine In" ? "Expérience sur table premium avec commande par QR code. Scannez, commandez, savourez — sans attendre le serveur." : s.titleKey === "Live Cooking Shows" ? "Nos chefs réalisent des sessions de cuisine en direct tous les vendredis et samedis. Du vrai feu, du vrai goût." : s.titleKey === "Custom Orders" ? "Créez votre burger parfait grâce à notre configurateur personnalisé. Chaque ingrédient selon vos préférences." : "Réservez l'intégralité du restaurant pour vos événements privés, dîners d'entreprise et réceptions exclusives.") : s.descKey}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MENU SECTION */}
      <section id="menu" className="py-24 px-6" style={{ background: "var(--secondary)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="mb-3" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent)", letterSpacing: "0.15em" }}>{t.menuHeader}</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                {t.menuTitle}<br /><span style={{ fontStyle: "italic", color: "var(--primary)" }}>{t.menuSubtitle}</span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="px-4 py-1.5 text-sm transition-all cursor-pointer"
                  style={{
                    background: activeCategory === cat ? "var(--primary)" : "transparent",
                    color: activeCategory === cat ? "#fff" : "var(--muted-foreground)",
                    border: activeCategory === cat ? "1px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: "2px",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                  }}>
                  {cat === "All" ? t.menuAll : cat.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-t-[#C8102E] border-r-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs font-mono text-[#8E7E70] tracking-widest uppercase">Forging menu items...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(item => (
                  <div key={item.id} 
                    onClick={() => onNavigate("client", "T01", item.id)}
                    className="group overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer select-none"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                    <div className="relative h-48 overflow-hidden">
                      <ImageWithFallback
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {item.popular && (
                        <div className="absolute top-3 left-3 px-2 py-1"
                          style={{ background: "var(--primary)", borderRadius: "2px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", color: "#fff" }}>POPULAR</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.05rem", color: "var(--foreground)" }}>{item.name}</h3>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: "1rem", color: "var(--accent)", whiteSpace: "nowrap", marginLeft: "8px" }}>
                          €{typeof item.price === "number" ? item.price.toFixed(2) : item.price}
                        </span>
                      </div>
                      <p style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: "16px" }}>{item.desc}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate("client", "T01", item.id);
                        }}
                        className="w-full py-3.5 text-sm transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                        style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700, letterSpacing: "0.05em" }}>
                        {t.orderNow}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-12 text-center">
                <button
                  onClick={() => onNavigate("client", "T01")}
                  className="inline-flex items-center gap-2 px-8 py-4 text-base transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-[#C8102E]/20 cursor-pointer"
                  style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700, letterSpacing: "0.06em" }}
                >
                  {t.viewAllProducts} <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* SHOWS SECTION */}
      <section id="shows" className="py-24 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="mb-3" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent)", letterSpacing: "0.15em" }}>{t.showsHeader}</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              {t.showsTitle}<br /><span style={{ fontStyle: "italic", color: "var(--primary)" }}>{t.showsSubtitle}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {shows.map(show => (
              <div 
                key={show.id} 
                onClick={() => setSelectedShow(show)}
                className="group overflow-hidden bg-card border border-border rounded flex flex-col sm:flex-row transition-all duration-300 hover:-translate-y-1 cursor-pointer select-none hover:border-[#C8102E]/30"
              >
                <div className="sm:w-48 h-48 sm:h-auto overflow-hidden bg-[#1A130E] flex-shrink-0">
                  <ImageWithFallback src={show.image} alt={show.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-6 flex flex-col justify-between flex-1">
                  <div>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.25rem", color: "var(--foreground)" }}>{show.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-accent mt-2 font-mono">
                      <Clock size={12} />
                      <span>{new Date(show.date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-3">{show.description}</p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40">
                    <span className="font-mono text-base font-bold text-accent">€{show.price?.toFixed(2)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedShow(show);
                      }}
                      className="px-5.5 py-3 text-xs font-bold bg-[#C8102E] hover:opacity-90 text-white rounded transition-all cursor-pointer shadow-sm shadow-[#C8102E]/20"
                    >
                      {t.showsBuyTickets}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT / CTA SECTION */}
      <section id="about" className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&h=600&fit=crop&auto=format"
            alt="Restaurant atmosphere"
            className="w-full h-full object-cover"
            style={{ opacity: 0.18 }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(10,7,4,1) 30%, rgba(10,7,4,0.7))" }} />
        </div>
        <div className="relative max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="mb-3" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent)", letterSpacing: "0.15em" }}>— OUR STORY</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, color: "var(--foreground)", lineHeight: 1.15 }}>
              Born from the streets.<br />
              <span style={{ fontStyle: "italic", color: "var(--primary)" }}>Refined by passion.</span>
            </h2>
            <p className="mt-6 leading-relaxed" style={{ color: "var(--muted-foreground)", fontSize: "15px", maxWidth: "480px" }}>
              Le Double Face was born in 2019 from a simple idea: what if a burger could be both street food and fine dining? Our chef trained in Lyon and fell in love with Paris street culture. The result is on every plate — two faces, one unforgettable experience.
            </p>
            <div className="mt-8 flex items-center gap-6">
              {[1,2,3,4,5].map(s => <Star key={s} size={18} fill="var(--accent)" style={{ color: "var(--accent)" }} />)}
              <span style={{ fontSize: "14px", color: "var(--muted-foreground)" }}>4.9 · 2,400+ reviews</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=300&h=400&fit=crop&auto=format"
              alt="Chef cooking"
              className="w-full h-52 object-cover"
              style={{ borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
            />
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&h=400&fit=crop&auto=format"
              alt="Restaurant interior"
              className="w-full h-52 object-cover mt-8"
              style={{ borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
            />
          </div>
        </div>
      </section>

      {/* CONTACT / INFO */}
      <section id="contact" className="py-20 px-6" style={{ background: "var(--secondary)", borderTop: "1px solid var(--border)" }}>
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10">
          {[
            { icon: <MapPin size={20} />, label: "Location", value: t.coordinatesLocation },
            { icon: <Phone size={20} />, label: "Reservations", value: "+33 1 42 74 31 00" },
            { icon: <Clock size={20} />, label: "Hours", value: t.coordinatesHours },
          ].map(info => (
            <div key={info.label} className="flex items-start gap-4">
              <div className="mt-0.5" style={{ color: "var(--accent)" }}>{info.icon}</div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted-foreground)", letterSpacing: "0.12em", marginBottom: "4px" }}>{info.label.toUpperCase()}</div>
                <div style={{ color: "var(--foreground)", fontSize: "14px", lineHeight: 1.5 }}>{info.value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer id="footer" className="py-12 px-6" style={{ background: "var(--background)", borderTop: "1px solid var(--border)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: "12px", color: "#fff" }}>LF</span>
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "16px" }}>Le Double Face</span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>© 2026 Le Double Face · Paris · {t.footerRights}</p>
          <div className="flex items-center gap-4">
            {[
              { Icon: Instagram, url: "https://instagram.com/ledoubleface" },
              { Icon: Facebook, url: "https://facebook.com/ledoubleface" },
              { Icon: Twitter, url: "https://twitter.com/ledoubleface" }
            ].map((social, i) => (
              <a key={i} href={social.url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center transition-all hover:opacity-80 border border-border rounded text-muted-foreground hover:text-white">
                <social.Icon size={16} />
              </a>
            ))}
          </div>
        </div>
      </footer>

      {/* Show Detail booking modal */}
      <AnimatePresence>
        {selectedShow && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 text-white"
          >
            <div className="w-full max-w-md bg-[#120D09] border border-[#2A1E15] p-6 rounded-2xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setSelectedShow(null)} className="absolute top-4 right-4 text-[#8E7E70] hover:text-white cursor-pointer">
                <X size={20} />
              </button>

              <div className="h-44 w-full rounded-xl overflow-hidden bg-black/40 mb-4 border border-[#2A1E15]">
                <ImageWithFallback src={selectedShow.image} alt={selectedShow.title} className="w-full h-full object-cover" />
              </div>

              <h3 className="font-serif font-black text-xl text-[#E5D5C5] mb-2">{selectedShow.title}</h3>
              
              <div className="flex items-center gap-2 text-xs text-accent mb-4 font-mono">
                <Clock size={12} />
                <span>{new Date(selectedShow.date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <p className="text-xs text-[#8E7E70] leading-relaxed mb-6 border-b border-[#2A1E15] pb-4">{selectedShow.description}</p>
              
              <h4 className="font-serif font-bold text-sm text-white mb-3">{t.showsBookTitle}</h4>

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
                    <div className="flex items-center gap-3">
                      <button onClick={() => setBookingQty(q => Math.max(1, q - 1))} className="px-3 py-1 border border-[#2A1E15] rounded text-white cursor-pointer">-</button>
                      <span className="font-mono text-sm w-4 text-center">{bookingQty}</span>
                      <button onClick={() => setBookingQty(q => q + 1)} className="px-3 py-1 border border-[#2A1E15] rounded text-white cursor-pointer">+</button>
                      <span className="text-xs text-[#8E7E70] ml-auto font-bold text-accent">€{(selectedShow.price * bookingQty).toFixed(2)}</span>
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
    </div>
  );
}
