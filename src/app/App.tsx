import { useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { AdminDashboard } from "./components/AdminDashboard";
import { ClientOrdering } from "./components/ClientOrdering";

{/* MARKER-MAKE-KIT-INVOKED */}

type View = "landing" | "admin" | "client";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [tableId, setTableId] = useState("T01");

  function navigate(v: string, table?: string) {
    if (table) setTableId(table);
    setView(v as View);
  }

  return (
    <div className="size-full">
      {view === "landing" && (
        <LandingPage onNavigate={navigate} />
      )}
      {view === "admin" && (
        <AdminDashboard onBack={() => setView("landing")} />
      )}
      {view === "client" && (
        <ClientOrdering tableId={tableId} onBack={() => setView("landing")} />
      )}
    </div>
  );
}
