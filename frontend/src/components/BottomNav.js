import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../utils/api";

const NAV = [
  { path:"/",          icon:"🏠", label:"Home"     },
  { path:"/products",  icon:"📦", label:"Products" },
  { path:"/ai-agent",  icon:"🤖", label:"AI Agent" },
  { path:"/customers", icon:"👥", label:"Customers"},
  { path:"/billing",   icon:"⚡", label:"Credits"  },
];

export default function BottomNav() {
  const navigate        = useNavigate();
  const { pathname }    = useLocation();
  const [pending, setPending] = useState(0);
  const [hasBriefing, setHasBriefing] = useState(false);

  useEffect(() => {
    const check = () => {
      // Check pending orders
      api.get("/analytics/pending-orders")
        .then(r => setPending(r.data.orders?.length || 0))
        .catch(() => {});
      // Check if briefing needs approval
      api.get("/agent/today")
        .then(r => setHasBriefing(r.data.briefing?.status === "draft"))
        .catch(() => {});
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100
                    flex justify-around items-center py-2 pb-safe z-50 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      {NAV.map(({ path, icon, label }) => {
        const active     = pathname === path || (path === "/customers" && pathname === "/orders");
        const showOrders = path === "/customers" && pending > 0;
        const showAI     = path === "/ai-agent"  && hasBriefing;
        return (
          <button key={path} onClick={() => navigate(path)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl active:scale-90 transition-all min-w-[52px] relative
              ${active ? "text-kgreen-700" : "text-gray-400"}`}>
            <span className="text-xl">{icon}</span>
            {showOrders && (
              <span className="absolute top-0 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {pending > 9 ? "9+" : pending}
              </span>
            )}
            {showAI && !showOrders && (
              <span className="absolute top-0 right-1 w-3 h-3 bg-kgold-500 rounded-full border-2 border-white"/>
            )}
            <span className={`text-[9px] font-semibold ${active ? "text-kgreen-700" : "text-gray-400"}`}>{label}</span>
            {active && <div className="w-1 h-1 bg-kgreen-700 rounded-full mt-0.5"/>}
          </button>
        );
      })}
    </nav>
  );
}
