import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { DriverDashboard } from "./DriverDashboard";
import { Shield, KeyRound, AlertTriangle, Loader2 } from "lucide-react";

interface DriverAuthGateProps {
  onLogout: () => void;
  onAdminRedirect: () => void;
}

export function DriverAuthGate({ onLogout, onAdminRedirect }: DriverAuthGateProps) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [driverProfile, setDriverProfile] = useState<{ id: string; name: string; email: string } | null>(null);

  const isMock = !supabase || supabase.isMock || !supabase.auth;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === "en") setLang("en");
    }

    if (isMock) {
      const mockSession = localStorage.getItem("ldf_mock_driver_session");
      if (mockSession === "true") {
        setIsSimulated(true);
        const storedProfile = localStorage.getItem("ldf_mock_driver_profile");
        if (storedProfile) {
          try {
            setDriverProfile(JSON.parse(storedProfile));
          } catch (_) {
            setDriverProfile({ id: "mock-driver-1", name: "Livreur Simulé", email: "driver@ledoubleface.com" });
          }
        } else {
          setDriverProfile({ id: "mock-driver-1", name: "Livreur Simulé", email: "driver@ledoubleface.com" });
        }
      }
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isMock]);

  const handleSession = async (currentSession: any) => {
    if (!currentSession) {
      setSession(null);
      setDriverProfile(null);
      setLoading(false);
      return;
    }

    const userRole = currentSession.user?.user_metadata?.role;

    if (userRole === "driver") {
      setSession(currentSession);
      const name = currentSession.user?.user_metadata?.name || "Livreur";
      const profile = { id: currentSession.user.id, name, email: currentSession.user.email || "" };
      setDriverProfile(profile);
      setLoading(false);
      
      // Update last_seen timestamp in background
      try {
        await supabase
          .from("drivers")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", currentSession.user.id);
      } catch (_) {
        // Suppress initial update failure
      }
    } else if (userRole === "admin" || !userRole) {
      onAdminRedirect();
    } else {
      setError(lang === "fr" ? "Accès non autorisé. Rôle invalide." : "Unauthorized access. Invalid role.");
      await supabase.auth.signOut();
      setSession(null);
      setDriverProfile(null);
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !pin) {
      setError(lang === "fr" ? "Veuillez remplir tous les champs." : "Please fill in all fields.");
      return;
    }

    if (pin.length !== 4 || isNaN(Number(pin))) {
      setError(lang === "fr" ? "Le code PIN doit comporter 4 chiffres." : "PIN code must be 4 digits.");
      return;
    }

    setSubmitting(true);

    if (isMock) {
      setTimeout(() => {
        // Look up driver in simulated drivers list
        const localDrivers = JSON.parse(localStorage.getItem("ldf_drivers") || "[]");
        const matched = localDrivers.find((d: any) => d.email.toLowerCase() === email.toLowerCase());
        
        const profile = matched 
          ? { id: matched.id, name: matched.name, email: matched.email }
          : { id: `mock-driver-${Date.now()}`, name: "Livreur Simulé", email };

        setIsSimulated(true);
        setDriverProfile(profile);
        localStorage.setItem("ldf_mock_driver_session", "true");
        localStorage.setItem("ldf_mock_driver_profile", JSON.stringify(profile));
        setSubmitting(false);
      }, 800);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });

      if (authError) {
        setError(authError.message);
        setSubmitting(false);
      } else {
        await handleSession(data.session);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
      setSubmitting(false);
    }
  };

  const handleBypass = () => {
    const profile = { id: "mock-driver-bypass", name: "Livreur Invité", email: "livreur@ledoubleface.com" };
    setIsSimulated(true);
    setDriverProfile(profile);
    localStorage.setItem("ldf_mock_driver_session", "true");
    localStorage.setItem("ldf_mock_driver_profile", JSON.stringify(profile));
  };

  const handleLogout = async () => {
    if (isMock) {
      setIsSimulated(false);
      setDriverProfile(null);
      localStorage.removeItem("ldf_mock_driver_session");
      localStorage.removeItem("ldf_mock_driver_profile");
    } else {
      await supabase.auth.signOut();
      setSession(null);
      setDriverProfile(null);
    }
    onLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground p-6">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-xs font-mono tracking-widest uppercase animate-pulse">
          {lang === "fr" ? "Vérification des accès livreur..." : "Checking driver credentials..."}
        </p>
      </div>
    );
  }

  if ((session || isSimulated) && driverProfile) {
    return (
      <DriverDashboard 
        driverId={driverProfile.id}
        driverName={driverProfile.name}
        driverEmail={driverProfile.email}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Language Switcher */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={() => setLang(lang === "fr" ? "en" : "fr")}
          className="text-xs font-mono tracking-widest px-3 py-1.5 bg-secondary border border-white/15 rounded text-foreground hover:text-foreground cursor-pointer"
        >
          {lang === "fr" ? "EN" : "FR"}
        </button>
      </div>

      <div className="w-full max-w-md bg-card border border-border p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-accent" />
          </div>
          <h2 className="font-serif font-bold text-2xl text-foreground text-center">
            {lang === "fr" ? "Espace Livreur" : "Driver Portal"}
          </h2>
          <p className="text-muted-foreground text-xs font-mono mt-1 uppercase tracking-wider text-center">
            {lang === "fr" ? "Console de livraison à domicile" : "Home delivery console"}
          </p>
        </div>

        {isMock && (
          <div className="mb-6 p-4.5 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent">
            <div className="flex gap-2.5 items-start">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold font-mono tracking-wider uppercase mb-1">
                  Local Simulation Mode
                </p>
                <p className="leading-relaxed opacity-90">
                  Supabase keys are missing or default. Entering simulation mode. You can log in with any email and 4-digit PIN, or click bypass below.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-xs text-foreground">
            <div className="flex gap-2 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <p className="font-semibold">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-muted-foreground font-mono text-[10px] tracking-wider uppercase mb-1.5">
              {lang === "fr" ? "Adresse Email" : "Email Address"}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="livreur@ledoubleface.com"
              className="w-full px-4 py-3 text-xs bg-muted border border-border rounded-xl text-foreground outline-none focus:border-primary transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-muted-foreground font-mono text-[10px] tracking-wider uppercase mb-1.5">
              {lang === "fr" ? "Code PIN (4 chiffres)" : "Access PIN (4 digits)"}
            </label>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full px-4 py-3 text-xs tracking-widest bg-muted border border-border rounded-xl text-foreground outline-none focus:border-primary transition-colors text-center font-bold text-lg"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-accent text-black font-bold rounded-xl text-xs hover:bg-accent/90 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <KeyRound className="w-3.5 h-3.5" />
            )}
            <span>{lang === "fr" ? "SE CONNECTER AUX LIVRAISONS" : "LOG IN TO DELIVERIES"}</span>
          </button>
        </form>

        {isMock && (
          <button
            onClick={handleBypass}
            className="w-full mt-3 py-2.5 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground font-mono text-[10px] tracking-widest rounded-xl transition-all border border-border cursor-pointer uppercase"
          >
            Bypass Auth (Simulate Access)
          </button>
        )}
      </div>
    </div>
  );
}
