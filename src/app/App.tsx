import { useState, useEffect } from "react";
import { ClientOrdering } from "./components/ClientOrdering";
import { AdminDashboard } from "./components/AdminDashboard";
import { Monitor, Smartphone, Columns, Settings, HelpCircle } from "lucide-react";

type SimulatorMode = "guest" | "admin" | "split";

export default function App() {
  const [mode, setMode] = useState<SimulatorMode>("split");
  
  // Read initial params from URL if present, else default
  const [tableId, setTableId] = useState("T07");
  const [area, setArea] = useState("Terrace Patio");

  useEffect(() => {
    // Sync URL search parameters with simulator state
    const params = new URLSearchParams(window.location.search);
    const urlTable = params.get("table");
    const urlArea = params.get("area");
    
    if (urlTable) setTableId(urlTable);
    if (urlArea) setArea(urlArea);
  }, []);

  // Update URL parameters helper
  const updateUrlContext = (newTable: string, newArea: string) => {
    setTableId(newTable);
    setArea(newArea);
    const url = new URL(window.location.href);
    url.searchParams.set("table", newTable);
    url.searchParams.set("area", newArea);
    window.history.pushState({}, "", url.toString());
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0A0704] text-white">
      {/* Simulator Control Panel */}
      <div className="bg-[#120D09]/95 border-b border-[#2A1E15] px-4 py-3 flex flex-wrap items-center justify-between gap-3 z-50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#C8102E] animate-pulse" />
          <span className="font-mono text-xs font-bold tracking-widest text-[#E5D5C5]">ZERO-FRICTION PWA SIMULATOR</span>
        </div>

        {/* Environment Selector variables */}
        <div className="flex items-center gap-3 bg-[#1A130E] border border-[#2A1E15] px-3 py-1 rounded-md text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#8E7E70] font-mono">TABLE:</span>
            <select
              value={tableId}
              onChange={(e) => updateUrlContext(e.target.value, area)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const id = `T${String(i + 1).padStart(2, "0")}`;
                return <option key={id} value={id} className="bg-[#120D09]">{id}</option>;
              })}
            </select>
          </div>
          <div className="w-px h-3 bg-[#2A1E15]" />
          <div className="flex items-center gap-1.5">
            <span className="text-[#8E7E70] font-mono">ZONE:</span>
            <select
              value={area}
              onChange={(e) => updateUrlContext(tableId, e.target.value)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value="Terrace Patio" className="bg-[#120D09]">Terrace Patio</option>
              <option value="Inside Lounge" className="bg-[#120D09]">Inside Lounge</option>
              <option value="Bar Counter" className="bg-[#120D09]">Bar Counter</option>
            </select>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#1A130E] border border-[#2A1E15] p-1 rounded-md">
          <button
            onClick={() => setMode("guest")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
              mode === "guest" ? "bg-[#C8102E] text-white" : "text-[#8E7E70] hover:text-white"
            }`}
          >
            <Smartphone size={14} />
            <span>Guest Frame</span>
          </button>
          <button
            onClick={() => setMode("admin")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
              mode === "admin" ? "bg-[#C8102E] text-white" : "text-[#8E7E70] hover:text-white"
            }`}
          >
            <Monitor size={14} />
            <span>Admin Desk</span>
          </button>
          <button
            onClick={() => setMode("split")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
              mode === "split" ? "bg-[#C8102E] text-white" : "text-[#8E7E70] hover:text-white"
            }`}
          >
            <Columns size={14} />
            <span>Split View</span>
          </button>
        </div>
      </div>

      {/* Simulator Workspace Area */}
      <div className="flex-1 w-full overflow-hidden bg-[#0F0A07] flex justify-center items-center">
        {mode === "guest" && (
          <div className="h-full w-full max-w-[430px] border-x border-[#2A1E15] bg-[#0A0704] relative flex flex-col shadow-2xl">
            <div className="flex-1 overflow-y-auto">
              <ClientOrdering tableId={tableId} area={area} />
            </div>
          </div>
        )}

        {mode === "admin" && (
          <div className="h-full w-full bg-[#0A0704]">
            <AdminDashboard />
          </div>
        )}

        {mode === "split" && (
          <div className="h-full w-full flex">
            {/* Guest side (phone size) */}
            <div className="w-[430px] flex-shrink-0 border-r border-[#2A1E15] bg-[#0A0704] flex flex-col relative h-full">
              <div className="bg-[#1C130C] px-3 py-1 text-[10px] text-center font-mono text-[#E5D5C5] border-b border-[#2A1E15]">
                📱 GUEST VIEW (SIMULATOR FRAME)
              </div>
              <div className="flex-1 overflow-y-auto">
                <ClientOrdering tableId={tableId} area={area} />
              </div>
            </div>
            {/* Admin side (full desk size) */}
            <div className="flex-1 bg-[#0A0704] flex flex-col h-full overflow-hidden">
              <div className="bg-[#1C130C] px-3 py-1 text-[10px] text-center font-mono text-[#E5D5C5] border-b border-[#2A1E15]">
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
