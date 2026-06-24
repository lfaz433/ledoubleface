import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { AdminDashboard } from "./AdminDashboard";
import { Shield, KeyRound, AlertTriangle, Loader2 } from "lucide-react";

interface AdminAuthGateProps {
  onLogout: () => void;
}

export function AdminAuthGate({ onLogout }: AdminAuthGateProps) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);

  const isMock = !supabase || supabase.isMock || !supabase.auth;

  useEffect(() => {
    if (isMock) {
      // In mock mode, check if we previously simulated logging in
      const mockSession = localStorage.getItem("ldf_mock_admin_session");
      if (mockSession === "true") {
        setIsSimulated(true);
      }
      setLoading(false);
      return;
    }

    // Check current active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isMock]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setSubmitting(true);

    if (isMock) {
      // Simulated Login for local dev
      setTimeout(() => {
        setIsSimulated(true);
        localStorage.setItem("ldf_mock_admin_session", "true");
        setSubmitting(false);
      }, 800);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
      } else {
        setSession(data.session);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBypass = () => {
    setIsSimulated(true);
    localStorage.setItem("ldf_mock_admin_session", "true");
  };

  const handleLogout = async () => {
    if (isMock) {
      setIsSimulated(false);
      localStorage.removeItem("ldf_mock_admin_session");
    } else {
      await supabase.auth.signOut();
      setSession(null);
    }
    onLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground p-6">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-xs font-mono tracking-widest uppercase animate-pulse">
          Verifying Admin Credentials...
        </p>
      </div>
    );
  }

  // If authenticated, render the dashboard
  if (session || isSimulated) {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-card border border-border p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-serif font-bold text-2xl text-foreground text-center">
            Kitchen Console Auth
          </h2>
          <p className="text-muted-foreground text-xs font-mono mt-1 uppercase tracking-wider text-center">
            Restricted Admin Access
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
                  Supabase keys are missing or default. Entering simulation mode. You can log in with any email and password, or click bypass below.
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
              Admin Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ledoubleface.com"
                className="w-full px-4 py-3 text-xs bg-muted border border-border rounded-xl text-foreground outline-none focus:border-primary transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground font-mono text-[10px] tracking-wider uppercase mb-1.5">
              Security PIN / Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 text-xs bg-muted border border-border rounded-xl text-foreground outline-none focus:border-primary transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-primary text-foreground font-bold rounded-xl text-xs hover:bg-primary/90 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <KeyRound className="w-3.5 h-3.5" />
            )}
            <span>SIGN IN TO WORKSPACE</span>
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
