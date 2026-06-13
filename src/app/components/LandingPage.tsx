import { useState, useEffect } from "react";
import { ChevronDown, Star, MapPin, Phone, Clock, Instagram, Facebook, Twitter, ArrowRight, Flame, Award, Utensils, Users } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

const MENU_ITEMS = [
  { id: 1, name: "Le Double Face Burger", price: "14.90", category: "Signature", desc: "Double wagyu patty, truffle mayo, aged cheddar, brioche bun", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop&auto=format", badge: "BEST SELLER" },
  { id: 2, name: "Crispy Royal Chicken", price: "12.50", category: "Chicken", desc: "Crispy buttermilk chicken, pickled jalapeños, garlic aioli", image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop&auto=format", badge: "NEW" },
  { id: 3, name: "Smash & Burn", price: "13.90", category: "Signature", desc: "Smash patty, caramelized onion, smoky BBQ, crispy bacon", image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=300&fit=crop&auto=format", badge: "" },
  { id: 4, name: "La Truffe Fries", price: "6.90", category: "Sides", desc: "Belgian fries, black truffle oil, parmesan, fresh herbs", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop&auto=format", badge: "" },
  { id: 5, name: "Double Shake Vanille", price: "7.50", category: "Drinks", desc: "Thick premium vanilla milkshake, Madagascar vanilla", image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop&auto=format", badge: "" },
  { id: 6, name: "Le Vegan Face", price: "11.90", category: "Vegan", desc: "Plant-based patty, avocado cream, sun-dried tomatoes", image: "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400&h=300&fit=crop&auto=format", badge: "" },
];

const SERVICES = [
  { icon: <Utensils size={28} />, title: "Dine In", desc: "Premium table experience with QR code ordering. Scan, order, enjoy — without waiting for a waiter." },
  { icon: <Flame size={28} />, title: "Live Cooking Shows", desc: "Our chefs perform live cooking sessions every Friday and Saturday. Real fire, real flavor, real theater." },
  { icon: <Award size={28} />, title: "Custom Orders", desc: "Build your perfect burger with our custom builder. Every ingredient, every sauce, every preference." },
  { icon: <Users size={28} />, title: "Private Events", desc: "Reserve the full restaurant for private events, corporate dinners, and exclusive gatherings." },
];

export function LandingPage({ onNavigate }: { onNavigate: (view: string, tableId?: string) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const categories = ["All", "Signature", "Chicken", "Sides", "Drinks", "Vegan"];
  const filtered = activeCategory === "All" ? MENU_ITEMS : MENU_ITEMS.filter(i => i.category === activeCategory);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen bg-background text-foreground">
      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "py-3" : "py-5"}`}
        style={{ background: scrolled ? "rgba(10,7,4,0.97)" : "transparent", borderBottom: scrolled ? "1px solid rgba(212,160,23,0.15)" : "none", backdropFilter: scrolled ? "blur(12px)" : "none" }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: "14px", color: "#fff" }}>LF</span>
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "20px", color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Le Double Face
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {["Menu", "Services", "About", "Contact"].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className="text-sm transition-colors hover:text-accent-foreground"
                style={{ color: "var(--muted-foreground)", letterSpacing: "0.08em", fontWeight: 500 }}>
                {item.toUpperCase()}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate("client", "T01")}
              className="px-4 py-2 text-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)", borderRadius: "var(--radius)", fontWeight: 700, letterSpacing: "0.04em" }}>
              ORDER NOW
            </button>
            <button onClick={() => onNavigate("admin")}
              className="px-4 py-2 text-sm transition-all"
              style={{ border: "1px solid rgba(212,160,23,0.3)", color: "var(--accent)", borderRadius: "var(--radius)", fontWeight: 600 }}>
              Admin
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&h=900&fit=crop&auto=format"
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
              Two Faces.<br />
              <span style={{ color: "var(--primary)", fontStyle: "italic" }}>One Legend.</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed max-w-md" style={{ color: "var(--muted-foreground)" }}>
              Bold flavors meet Parisian elegance. Every bite is a double experience — street soul with fine dining craft.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button onClick={() => onNavigate("client", "T01")}
                className="flex items-center gap-2 px-8 py-4 text-base transition-all hover:opacity-90 active:scale-95"
                style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700, letterSpacing: "0.06em" }}>
                ORDER AT TABLE <ArrowRight size={18} />
              </button>
              <button
                className="flex items-center gap-2 px-8 py-4 text-base transition-all hover:bg-white/5"
                style={{ border: "1px solid rgba(245,240,232,0.2)", color: "var(--foreground)", borderRadius: "var(--radius)", fontWeight: 600 }}>
                VIEW MENU
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
                src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=750&fit=crop&auto=format"
                alt="Signature Le Double Face burger"
                className="w-full h-full object-cover"
                style={{ borderRadius: "4px", border: "1px solid rgba(212,160,23,0.2)" }}
              />
              <div className="absolute -bottom-4 -left-4 px-4 py-3 flex items-center gap-3"
                style={{ background: "var(--primary)", borderRadius: "var(--radius)" }}>
                <Flame size={20} style={{ color: "#fff" }} />
                <div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.1em" }}>TONIGHT'S SPECIAL</div>
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
            <div className="mb-3" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent)", letterSpacing: "0.15em" }}>— WHAT WE OFFER</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              The Double Face<br /><span style={{ fontStyle: "italic", color: "var(--primary)" }}>Experience</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map((s, i) => (
              <div key={i} className="p-6 group transition-all duration-300 hover:-translate-y-1"
                style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                <div className="w-12 h-12 flex items-center justify-center mb-5 transition-colors"
                  style={{ background: "rgba(200,16,46,0.12)", color: "var(--primary)", borderRadius: "var(--radius)" }}>
                  {s.icon}
                </div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.15rem", color: "var(--foreground)", marginBottom: "8px" }}>{s.title}</h3>
                <p style={{ fontSize: "14px", lineHeight: 1.65, color: "var(--muted-foreground)" }}>{s.desc}</p>
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
              <div className="mb-3" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent)", letterSpacing: "0.15em" }}>— OUR MENU</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                Crafted with<br /><span style={{ fontStyle: "italic", color: "var(--primary)" }}>Bold Intention</span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="px-4 py-1.5 text-sm transition-all"
                  style={{
                    background: activeCategory === cat ? "var(--primary)" : "transparent",
                    color: activeCategory === cat ? "#fff" : "var(--muted-foreground)",
                    border: activeCategory === cat ? "1px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: "2px",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                  }}>
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(item => (
              <div key={item.id} className="group overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                <div className="relative h-48 overflow-hidden">
                  <ImageWithFallback
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {item.badge && (
                    <div className="absolute top-3 left-3 px-2 py-1"
                      style={{ background: item.badge === "NEW" ? "var(--accent)" : "var(--primary)", borderRadius: "2px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", color: item.badge === "NEW" ? "#000" : "#fff" }}>{item.badge}</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.05rem", color: "var(--foreground)" }}>{item.name}</h3>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: "1rem", color: "var(--accent)", whiteSpace: "nowrap", marginLeft: "8px" }}>€{item.price}</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: "16px" }}>{item.desc}</p>
                  <button
                    onClick={() => onNavigate("client", "T01")}
                    className="w-full py-2 text-sm transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "var(--primary)", color: "#fff", borderRadius: "var(--radius)", fontWeight: 700, letterSpacing: "0.05em" }}>
                    ORDER NOW
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT / CTA SECTION */}
      <section className="py-24 px-6 relative overflow-hidden">
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
            { icon: <MapPin size={20} />, label: "Location", value: "14 Rue du Faubourg Saint-Antoine, 75011 Paris" },
            { icon: <Phone size={20} />, label: "Reservations", value: "+33 1 42 74 31 00" },
            { icon: <Clock size={20} />, label: "Hours", value: "Mon–Fri 11:30–23:00 · Sat–Sun 12:00–00:00" },
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
          <p style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>© 2026 Le Double Face · Paris · All rights reserved</p>
          <div className="flex items-center gap-4">
            {[Instagram, Facebook, Twitter].map((Icon, i) => (
              <button key={i} className="w-9 h-9 flex items-center justify-center transition-all hover:opacity-80"
                style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--muted-foreground)" }}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
