import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { WaiterDashboard } from "./WaiterDashboard";
import { Shield, KeyRound, AlertTriangle, Loader2 } from "lucide-react";
import { translations, Language } from "../../lib/translations";

interface WaiterAuthGateProps {
  onLogout: () => void;
  onAdminRedirect: () => void;
}

export function WaiterAuthGate({ onLogout, onAdminRedirect }: WaiterAuthGateProps) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [lang, setLang] = useState<Language>("fr");

  const isMock = !supabase || supabase.isMock || !supabase.auth;
  const t = translations[lang];

  useEffect(() => {
    // Detect browser language
    if (typeof window !== "undefined") {
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === "en") setLang("en");
    }

    if (isMock) {
      const mockSession = localStorage.getItem("ldf_mock_waiter_session");
      if (mockSession === "true") {
        setIsSimulated(true);
      }
      setLoading(false);
      return;
    }

    // Check current active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Listen for auth state changes
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
      setLoading(false);
      return;
    }

    const userRole = currentSession.user?.user_metadata?.role;
    
    if (userRole === "waiter") {
      setSession(currentSession);
      setLoading(false);
      // Update last_seen timestamp in background
      try {
        await supabase
          .from("waiters")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", currentSession.user.id);
      } catch (_) {
        // Suppress heartbeat errors
      }
    } else if (userRole === "admin" || !userRole) {
      // Redirect admins to admin console
      onAdminRedirect();
    } else {
      setError("Unauthorized access. Invalid staff role.");
      await supabase.auth.signOut();
      setSession(null);
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
        setIsSimulated(true);
        localStorage.setItem("ldf_mock_waiter_session", "true");
        setSubmitting(false);
      }, 800);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: pin, // PIN is password
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
    setIsSimulated(true);
    localStorage.setItem("ldf_mock_waiter_session", "true");
  };

  const handleLogout = async () => {
    if (isMock) {
      setIsSimulated(false);
      localStorage.removeItem("ldf_mock_waiter_session");
    } else {
      await supabase.auth.signOut();
      setSession(null);
    }
    onLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0704] text-[#8E7E70] p-6">
        <Loader2 className="w-10 h-10 animate-spin text-[#C8102E] mb-4" />
        <p className="text-xs font-mono tracking-widest uppercase animate-pulse">
          {lang === "fr" ? "Vérification des accès..." : "Checking credentials..."}
        </p>
      </div>
    );
  }

  if (session || isSimulated) {
    // Pass user info (name, assigned tables) to the Waiter Dashboard
    const waiterInfo = isMock 
      ? { name: "Simulated Waiter", assignedTables: ["T01", "T02", "T03"] } 
      : { 
          id: session.user.id,
          name: session.user.user_metadata?.name || "Staff", 
          assignedTables: session.user.user_metadata?.assigned_tables || [] 
        };

    return (
      <WaiterDashboard 
        waiterId={waiterInfo.id}
        waiterName={waiterInfo.name} 
        assignedTables={waiterInfo.assignedTables} 
        onLogout={handleLogout} 
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0704] px-4 py-12 relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#C8102E]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#D4A017]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Language Switcher */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={() => setLang(lang === "fr" ? "en" : "fr")}
          className="text-xs font-mono tracking-widest px-3 py-1.5 bg-white/5 border border-white/15 rounded text-[#E5D5C5] hover:text-white cursor-pointer"
        >
          {lang === "fr" ? "EN" : "FR"}
        </button>
      </div>

      <div className="w-full max-w-md bg-[#120D09] border border-[#2A1E15] p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#C8102E]/10 border border-[#C8102E]/30 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-[#C8102E]" />
          </div>
          <h2 className="font-serif font-bold text-2xl text-white text-center">
            {t.waiterLoginTitle}
          </h2>
          <p className="text-[#8E7E70] text-xs font-mono mt-1 uppercase tracking-wider text-center">
            {t.waiterLoginSubtitle}
          </p>
        </div>

        {isMock && (
          <div className="mb-6 p-4.5 bg-[#D4A017]/10 border border-[#D4A017]/20 rounded-xl text-xs text-[#D4A017]">
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
          <div className="mb-6 p-4 bg-[#C8102E]/10 border border-[#C8102E]/20 rounded-xl text-xs text-white">
            <div className="flex gap-2 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#C8102E]" />
              <p className="font-semibold">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[#8E7E70] font-mono text-[10px] tracking-wider uppercase mb-1.5">
              {t.waiterEmailLabel}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="waiter@ledoubleface.com"
              className="w-full px-4 py-3 text-xs bg-[#1A130E] border border-[#2A1E15] rounded-xl text-white outline-none focus:border-[#C8102E] transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-[#8E7E70] font-mono text-[10px] tracking-wider uppercase mb-1.5">
              {t.waiterPinLabel}
            </label>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full px-4 py-3 text-xs tracking-widest bg-[#1A130E] border border-[#2A1E15] rounded-xl text-white outline-none focus:border-[#C8102E] transition-colors text-center font-bold text-lg"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#C8102E] text-white font-bold rounded-xl text-xs hover:bg-[#C8102E]/90 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <KeyRound className="w-3.5 h-3.5" />
            )}
            <span>{t.waiterLoginBtn}</span>
          </button>
        </form>

        {isMock && (
          <button
            onClick={handleBypass}
            className="w-full mt-3 py-2.5 bg-white/5 hover:bg-white/10 text-[#8E7E70] hover:text-white font-mono text-[10px] tracking-widest rounded-xl transition-all border border-white/5 cursor-pointer uppercase"
          >
            Bypass Auth (Simulate Access)
          </button>
        )}
      </div>
    </div>
  );
}
