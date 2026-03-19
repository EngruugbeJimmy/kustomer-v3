import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
const NAV = [
  { path:"/",         icon:"🏠", label:"Home" },
  { path:"/products", icon:"📦", label:"Products" },
  { path:"/customers",icon:"👥", label:"Customers" },
  { path:"/broadcast",icon:"📢", label:"Broadcast" },
  { path:"/billing",  icon:"💳", label:"Plans" },
];
export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100
                    flex justify-around items-center py-2 pb-safe z-50 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      {NAV.map(({ path, icon, label }) => {
        const active = pathname === path;
        return (
          <button key={path} onClick={() => navigate(path)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl
                        active:scale-90 transition-all min-w-[52px]
                        ${active ? "text-kgreen-700" : "text-gray-400"}`}>
            <span className="text-xl">{icon}</span>
            <span className={`text-[9px] font-semibold ${active ? "text-kgreen-700" : "text-gray-400"}`}>{label}</span>
            {active && <div className="w-1 h-1 bg-kgreen-700 rounded-full mt-0.5" />}
          </button>
        );
      })}
    </nav>
  );
}
