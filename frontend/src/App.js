import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login          from "./pages/Login";
import Signup         from "./pages/Signup";
import Home           from "./pages/Home";
import Products       from "./pages/Products";
import Customers      from "./pages/Customers";
import Orders         from "./pages/Orders";
import Marketing      from "./pages/Marketing";
import AISeo          from "./pages/AISeo";
import Domains        from "./pages/Domains";
import Discover       from "./pages/Discover";
import YouTube        from "./pages/YouTube";
import Billing        from "./pages/Billing";
import Reseller       from "./pages/Reseller";
import AgentDashboard from "./pages/AgentDashboard";
import ShopAgents     from "./pages/ShopAgents";
import SocialPost     from "./pages/SocialPost";
import AIAgent       from "./pages/AIAgent";
import DailyBrief    from "./pages/DailyBrief";
import Settings       from "./pages/Settings";
import Catalog        from "./pages/Catalog";
import VerifyPhone    from "./pages/VerifyPhone";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword  from "./pages/ResetPassword";
import BottomNav      from "./components/BottomNav";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-kgreen-700 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-kgold-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
          <span className="text-3xl">🛍️</span>
        </div>
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
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />
      <Route path="/shop/:shopSlug" element={<Catalog />} />
      <Route path="/discover"       element={<Discover />} />
      <Route path="/"               element={<Protected><Layout><Home /></Layout></Protected>} />
      <Route path="/products"       element={<Protected><Layout><Products /></Layout></Protected>} />
      <Route path="/customers"      element={<Protected><Layout><Customers /></Layout></Protected>} />
      <Route path="/orders"         element={<Protected><Layout><Orders /></Layout></Protected>} />
      <Route path="/marketing"      element={<Protected><Layout><Marketing /></Layout></Protected>} />
      <Route path="/ai-seo"         element={<Protected><Layout><AISeo /></Layout></Protected>} />
      <Route path="/domains"        element={<Protected><Layout><Domains /></Layout></Protected>} />
      <Route path="/youtube"        element={<Protected><Layout><YouTube /></Layout></Protected>} />
      <Route path="/billing"        element={<Protected><Layout><Billing /></Layout></Protected>} />
      <Route path="/reseller"       element={<Protected><Layout><Reseller /></Layout></Protected>} />
      <Route path="/agent"          element={<Protected><Layout><AgentDashboard /></Layout></Protected>} />
      <Route path="/shop-agents"    element={<Protected><Layout><ShopAgents /></Layout></Protected>} />
      <Route path="/social"          element={<Protected><Layout><SocialPost /></Layout></Protected>} />
      <Route path="/ai-agent"        element={<Protected><Layout><AIAgent /></Layout></Protected>} />
      <Route path="/agent"           element={<Protected><Layout><DailyBrief /></Layout></Protected>} />
      <Route path="/settings"       element={<Protected><Layout><Settings /></Layout></Protected>} />
      <Route path="/verify-phone"     element={<Protected><VerifyPhone /></Protected>} />
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
          duration:3500,
          style:{ background:"#063d26", color:"#fff", borderRadius:"16px", fontFamily:"DM Sans,sans-serif", fontSize:"14px", fontWeight:"500", padding:"12px 16px", maxWidth:"340px" },
          success:{ iconTheme:{ primary:"#d4a017", secondary:"#fff" } }
        }}/>
      </AuthProvider>
    </BrowserRouter>
  );
}
