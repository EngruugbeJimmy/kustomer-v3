import React from "react";
const MAP = {
  free:     { label:"Free",     cls:"bg-gray-100 text-gray-500" },
  starter:  { label:"Starter",  cls:"bg-kgreen-50 text-kgreen-700" },
  pro:      { label:"Pro",      cls:"bg-kgold-50 text-kgold-700" },
  reseller: { label:"Reseller", cls:"bg-purple-50 text-purple-700" },
};
export default function PlanBadge({ plan }) {
  const { label, cls } = MAP[plan] || MAP.free;
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>;
}
