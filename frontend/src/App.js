import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login     from "./pages/Login";
import Signup    from "./pages/Signup";
import Home      from "./pages/Home";
import Products  from "./pages/Products";
import Customers from "./pages/Customers";
import Broadcast from "./pages/Broadcast";
import Billing   from "./pages/Billing";
import Reseller  from "./pages/Reseller";
import Settings  from "./pages/Settings";
import Catalog   from "./pages/Catalog";
import BottomNav from "./components/BottomNav";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-kgreen-700 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-kgold-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl"><span className="text-3xl">🛍️</span></div>
        <p className="text-kgreen-100 font-medium">Loading Kustomer...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}
function Layout({ children }) { return <>{children}<BottomNav /></>; }

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login"          element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/signup"         element={user ? <Navigate to="/" /> : <Signup />} />
      <Route path="/shop/:shopSlug" element={<Catalog />} />
      <Route path="/"               element={<Protected><Layout><Home /></Layout></Protected>} />
      <Route path="/products"       element={<Protected><Layout><Products /></Layout></Protected>} />
      <Route path="/customers"      element={<Protected><Layout><Customers /></Layout></Protected>} />
      <Route path="/broadcast"      element={<Protected><Layout><Broadcast /></Layout></Protected>} />
      <Route path="/billing"        element={<Protected><Layout><Billing /></Layout></Protected>} />
      <Route path="/reseller"       element={<Protected><Layout><Reseller /></Layout></Protected>} />
      <Route path="/settings"       element={<Protected><Layout><Settings /></Layout></Protected>} />
      <Route path="*"               element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" toastOptions={{
          duration: 3500,
          style: { background:"#063d26", color:"#fff", borderRadius:"16px", fontFamily:"DM Sans,sans-serif", fontSize:"14px", fontWeight:"500", padding:"12px 16px", maxWidth:"340px" },
          success: { iconTheme: { primary:"#d4a017", secondary:"#fff" } }
        }}/>
      </AuthProvider>
    </BrowserRouter>
  );
}
