import axios from "axios";
const api = axios.create({ baseURL: process.env.REACT_APP_API_URL || "/api", timeout:20000 });
api.interceptors.request.use(cfg => { const t=localStorage.getItem("kustomer_token"); if(t) cfg.headers.Authorization="Bearer "+t; return cfg; });
api.interceptors.response.use(r=>r, err => { if(err.response?.status===401){localStorage.removeItem("kustomer_token");localStorage.removeItem("kustomer_user");window.location.href="/login";} return Promise.reject(err); });
export default api;
