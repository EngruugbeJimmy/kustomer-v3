import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";
const Ctx = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = localStorage.getItem("kustomer_token");
    const u = localStorage.getItem("kustomer_user");
    if (t && u) setUser(JSON.parse(u));
    setLoading(false);
  }, []);
  const save = (token, user) => {
    localStorage.setItem("kustomer_token", token);
    localStorage.setItem("kustomer_user", JSON.stringify(user));
    setUser(user);
  };
  const login   = async (email, pw) => { const {data}=await api.post("/auth/login",{email,password:pw}); save(data.token,data.user); return data.user; };
  const signup  = async (n,e,p,ph,rc) => { const {data}=await api.post("/auth/signup",{name:n,email:e,password:p,phone:ph,resellerCode:rc}); save(data.token,data.user); return data.user; };
  const logout  = () => { localStorage.removeItem("kustomer_token"); localStorage.removeItem("kustomer_user"); setUser(null); };
  const refresh = async () => { const {data}=await api.get("/auth/me"); localStorage.setItem("kustomer_user",JSON.stringify(data.user)); setUser(data.user); return data.user; };
  return <Ctx.Provider value={{user,loading,login,signup,logout,refresh}}>{children}</Ctx.Provider>;
};
export const useAuth = () => useContext(Ctx);
