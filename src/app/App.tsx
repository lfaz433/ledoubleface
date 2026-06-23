import { useState, useEffect } from "react";
import { ClientOrdering } from "./components/ClientOrdering";
import { AdminDashboard } from "./components/AdminDashboard";
import { AdminAuthGate } from "./components/AdminAuthGate";
import { WaiterAuthGate } from "./components/WaiterAuthGate";
import { DriverAuthGate } from "./components/DriverAuthGate";
import { LandingPage } from "./components/LandingPage";
import { KitchenDisplay } from "./components/KitchenDisplay";
import { CustomerDisplay } from "./components/CustomerDisplay";
import { Monitor, Smartphone, Columns, ArrowLeft } from "lucide-react";

type RouteView = "landing" | "menu" | "admin" | "waiter" | "driver" | "simulator" | "kitchen" | "display";

import { ErrorBoundary } from "./components/ErrorBoundary";

function AppCore() {
  const [view, setView] = useState<RouteView>("landing");
  const [tableId, setTableId] = useState("DELIVERY");
  const [area, setArea] = useState("Terrace Patio");
  const [simulatorMode, setSimulatorMode] = useState<"guest" | "admin" | "split">("split");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    // Sync URL parameters with app routing state
    const handleUrlRouting = () => {
      const params = new URLSearchParams(window.location.search);
      const path = window.location.pathname;
      
      const isSimulator = params.get("simulator") === "true" || path === "/simulator";
      const isAdmin = params.get("view") === "admin" || path === "/admin";
      const isWaiter = params.get("view") === "waiter" || path === "/waiter";
      const isDriver = params.get("view") === "driver" || path === "/driver";
      const isKitchen = params.get("view") === "kitchen" || path === "/kitchen";
      const isDisplay = params.get("view") === "display" || path === "/display";
      const isMenu = params.get("view") === "menu" || params.get("view") === "order" || path === "/menu" || path === "/order" || params.has("table");
      
      const urlTable = params.get("table");
      const urlArea = params.get("area");
      
      if (urlTable) setTableId(urlTable.toUpperCase());
      if (urlArea) setArea(urlArea);
      
      if (isSimulator) {
        setView("simulator");
      } else if (isAdmin) {
        setView("admin");
      } else if (isWaiter) {
        setView("waiter");
      } else if (isDriver) {
        setView("driver");
      } else if (isKitchen) {
        setView("kitchen");
      } else if (isDisplay) {
        setView("display");
      } else if (isMenu) {
        setView("menu");
      } else {
        setView("landing");
      }
    };

    handleUrlRouting();
    window.addEventListener("popstate", handleUrlRouting);
    return () => window.removeEventListener("popstate", handleUrlRouting);
  }, []);

  const navigateTo = (newView: RouteView, targetTableId?: string, targetArea?: string) => {
    const url = new URL(window.location.href);
    
    // Clear view and simulator params
    url.searchParams.delete("view");
    url.searchParams.delete("simulator");
    
    if (newView === "landing") {
      url.pathname = "/";
      url.searchParams.delete("table");
      url.searchParams.delete("area");
      url.searchParams.delete("product");
    } else if (newView === "admin") {
      url.searchParams.set("view", "admin");
    } else if (newView === "waiter") {
      url.searchParams.set("view", "waiter");
    } else if (newView === "driver") {
      url.searchParams.set("view", "driver");
    } else if (newView === "menu") {
      url.searchParams.set("view", "order");
      if (targetTableId) {
        url.searchParams.set("table", targetTableId);
        setTableId(targetTableId);
      } else {
        url.searchParams.set("table", tableId);
      }
      if (targetArea) {
        url.searchParams.set("area", targetArea);
        setArea(targetArea);
      } else {
        url.searchParams.set("area", area);
      }
    } else if (newView === "simulator") {
      url.searchParams.set("simulator", "true");
    } else if (newView === "kitchen") {
      url.searchParams.set("view", "kitchen");
    } else if (newView === "display") {
      url.searchParams.set("view", "display");
    }
    
    window.history.pushState({}, "", url.toString());
    setView(newView);
  };

  const handleNavigate = (viewStr: string, targetTableId?: string, productId?: string) => {
    if (viewStr === "admin") {
      navigateTo("admin");
    } else if (viewStr === "waiter") {
      navigateTo("waiter");
    } else if (viewStr === "driver") {
      navigateTo("driver");
    } else if (viewStr === "kitchen") {
      navigateTo("kitchen");
    } else if (viewStr === "display") {
      navigateTo("display");
    } else if (viewStr === "client" || viewStr === "menu") {
      if (productId) {
        const url = new URL(window.location.href);
        url.searchParams.set("view", "menu");
        url.searchParams.set("table", targetTableId || "T01");
        url.searchParams.set("product", productId);
        window.history.pushState({}, "", url.toString());
        setView("menu");
        if (targetTableId) setTableId(targetTableId);
      } else {
        navigateTo("menu", targetTableId || "T01");
      }
    } else {
      navigateTo("landing");
    }
  };

  const updateSimulatorUrlContext = (newTable: string, newArea: string) => {
    setTableId(newTable);
    setArea(newArea);
    const url = new URL(window.location.href);
    url.searchParams.set("table", newTable);
    url.searchParams.set("area", newArea);
    window.history.pushState({}, "", url.toString());
  };

  // Render Standalone Landing Page View
  if (view === "landing") {
    return <LandingPage onNavigate={handleNavigate} tableId={tableId} />;
  }

  // Render Standalone Guest Menu View
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#0A0704] text-white relative">
        <button
          onClick={() => navigateTo("landing")}
          className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono tracking-widest text-[#E5D5C5] bg-black/40 border border-white/10 hover:bg-black/60 rounded backdrop-blur-md transition-all cursor-pointer"
        >
          <ArrowLeft size={14} /> HOME
        </button>
        <ClientOrdering tableId={tableId} area={area} />
      </div>
    );
  }

  // Render Standalone Kitchen Dashboard View
  if (view === "admin") {
    return (
      <div className="min-h-screen bg-[#0A0704] text-white relative">
        <button
          onClick={() => navigateTo("landing")}
          className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono tracking-widest text-[#E5D5C5] bg-black/40 border border-white/10 hover:bg-black/60 rounded-lg backdrop-blur-md transition-all cursor-pointer"
        >
          <ArrowLeft size={14} /> HOME
        </button>
        <AdminAuthGate onLogout={() => navigateTo("landing")} />
      </div>
    );
  }

  // Render Standalone Waiter Dashboard View
  if (view === "waiter") {
    return (
      <div className="min-h-screen bg-[#0A0704] text-white relative">
        <button
          onClick={() => navigateTo("landing")}
          className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono tracking-widest text-[#E5D5C5] bg-black/40 border border-white/10 hover:bg-black/60 rounded-lg backdrop-blur-md transition-all cursor-pointer"
        >
          <ArrowLeft size={14} /> HOME
        </button>
        <WaiterAuthGate 
          onLogout={() => navigateTo("landing")} 
          onAdminRedirect={() => navigateTo("admin")}
        />
      </div>
    );
  }

  // Render Standalone Driver Dashboard View
  if (view === "driver") {
    return (
      <div className="min-h-screen bg-[#0A0704] text-white relative">
        <button
          onClick={() => navigateTo("landing")}
          className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono tracking-widest text-[#E5D5C5] bg-black/40 border border-white/10 hover:bg-black/60 rounded-lg backdrop-blur-md transition-all cursor-pointer"
        >
          <ArrowLeft size={14} /> HOME
        </button>
        <DriverAuthGate 
          onLogout={() => navigateTo("landing")} 
          onAdminRedirect={() => navigateTo("admin")}
        />
      </div>
    );
  }

  // Render Standalone Kitchen Screen View (KDS)
  if (view === "kitchen") {
    return <KitchenDisplay />;
  }

  // Render Standalone Customer Display Board View
  if (view === "display") {
    return <CustomerDisplay />;
  }

  // Render Simulator View (Split / Guest / Admin Testing)
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-radial-gradient text-white">
      {/* Simulator Control Panel */}
      <div className="glass-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3 z-50 rounded-b-xl border-t-0 mx-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#C8102E] animate-pulse shadow-[0_0_8px_rgba(200,16,46,0.8)]" />
          <span className="font-mono text-xs font-bold tracking-widest text-[#E5D5C5]">ZERO-FRICTION SIMULATOR</span>
        </div>

        {/* Environment Selector variables */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-1 rounded-md text-xs backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <span className="text-[#8E7E70] font-mono">TABLE:</span>
            <select
              value={tableId}
              onChange={(e) => updateSimulatorUrlContext(e.target.value, area)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const id = `T${String(i + 1).padStart(2, "0")}`;
                return <option key={id} value={id} className="bg-[#120D09]">{id}</option>;
              })}
              <option value="DELIVERY" className="bg-[#120D09]">DELIVERY</option>
            </select>
          </div>
          <div className="w-px h-3 bg-white/20" />
          <div className="flex items-center gap-1.5">
            <span className="text-[#8E7E70] font-mono">ZONE:</span>
            <select
              value={area}
              onChange={(e) => updateSimulatorUrlContext(tableId, e.target.value)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value="Terrace Patio" className="bg-[#120D09]">Terrace Patio</option>
              <option value="Inside Lounge" className="bg-[#120D09]">Inside Lounge</option>
              <option value="Bar Counter" className="bg-[#120D09]">Bar Counter</option>
            </select>
          </div>
        </div>

        {/* Mode Switcher & Navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-md backdrop-blur-md">
            <button
              onClick={() => setSimulatorMode("guest")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
                simulatorMode === "guest" ? "bg-[#C8102E] text-white shadow-lg shadow-[#C8102E]/20" : "text-[#8E7E70] hover:text-white"
              }`}
            >
              <Smartphone size={14} />
              <span>Guest Frame</span>
            </button>
            <button
              onClick={() => setSimulatorMode("admin")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
                simulatorMode === "admin" ? "bg-[#C8102E] text-white shadow-lg shadow-[#C8102E]/20" : "text-[#8E7E70] hover:text-white"
              }`}
            >
              <Monitor size={14} />
              <span>Admin Desk</span>
            </button>
            <button
              onClick={() => setSimulatorMode("split")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
                simulatorMode === "split" ? "bg-[#C8102E] text-white shadow-lg shadow-[#C8102E]/20" : "text-[#8E7E70] hover:text-white"
              }`}
            >
              <Columns size={14} />
              <span>Split View</span>
            </button>
          </div>

          <button
            onClick={() => navigateTo("landing")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono tracking-widest text-[#E5D5C5] bg-black/40 border border-white/10 hover:bg-black/60 rounded backdrop-blur-md transition-all cursor-pointer"
          >
            <ArrowLeft size={12} /> EXIT SIMULATOR
          </button>
        </div>
      </div>

      {/* Simulator Workspace Area */}
      <div className="flex-1 w-full overflow-hidden flex justify-center items-center">
        {simulatorMode === "guest" && (
          <div className="h-[95%] w-full max-w-[430px] rounded-3xl border border-white/10 bg-radial-gradient relative flex flex-col shadow-2xl overflow-hidden glass-panel">
            <div className="flex-1 overflow-y-auto">
              <ClientOrdering tableId={tableId} area={area} />
            </div>
          </div>
        )}

        {simulatorMode === "admin" && (
          <div className="h-full w-full bg-radial-gradient">
            <AdminDashboard />
          </div>
        )}

        {simulatorMode === "split" && (
          <div className="h-[98%] w-full max-w-[1400px] flex gap-4 px-4 pb-4">
            {/* Guest side (phone size) */}
            <div className="w-[430px] flex-shrink-0 rounded-3xl border border-white/10 bg-radial-gradient flex flex-col relative h-full glass-panel overflow-hidden">
              <div className="bg-white/5 px-3 py-2 text-[10px] text-center font-mono text-[#E5D5C5] border-b border-white/10 backdrop-blur-md">
                📱 GUEST VIEW (SIMULATOR FRAME)
              </div>
              <div className="flex-1 overflow-y-auto">
                <ClientOrdering tableId={tableId} area={area} />
              </div>
            </div>
            {/* Admin side (full desk size) */}
            <div className="flex-1 rounded-3xl border border-white/10 bg-radial-gradient flex flex-col h-full overflow-hidden glass-panel">
              <div className="bg-white/5 px-3 py-2 text-[10px] text-center font-mono text-[#E5D5C5] border-b border-white/10 backdrop-blur-md">
                💻 KITCHEN WORKSPACE / CMS
              </div>
              <div className="flex-1 overflow-hidden">
                <AdminDashboard />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppCore />
    </ErrorBoundary>
  );
}
