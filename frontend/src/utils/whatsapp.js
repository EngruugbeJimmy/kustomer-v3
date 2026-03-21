export const generateWaLink = (phone,msg) => "https://wa.me/"+phone.replace(/[^\d+]/g,"")+"?text="+encodeURIComponent(msg);
export const sendWhatsApp   = (phone,msg) => window.open(generateWaLink(phone,msg),"_blank");
export const broadcastMessages = async (customers,msg,onProgress) => {
  for (let i=0;i<customers.length;i++) {
    sendWhatsApp(customers[i].phone, msg);
    onProgress?.(i+1,customers.length);
    if (i<customers.length-1) await new Promise(r=>setTimeout(r,900));
  }
};
export const buildOrderMessage = ({ shopPhone,shopName,items,orderType,customerName }) => {
  const lines = items.map(i=>"  • "+i.name+" x"+i.qty+"  "+i.currency+(i.price*i.qty).toLocaleString()).join("\n");
  const total  = items.reduce((s,i)=>s+i.price*i.qty,0);
  const msg = "Hello "+shopName+"! 👋\n\nOrder:\n\n"+lines+"\n\n*Total: "+(items[0]?.currency||"₦")+total.toLocaleString()+"*\n\n"+(orderType==="pickup"?"🏪 Pickup":"🚚 Pay on Delivery")+(customerName?"\nName: "+customerName:"")+"\n\nPlease confirm. Thank you! 🙏";
  sendWhatsApp(shopPhone, msg);
};
export const buildBroadcastMessage = (text,catalogUrl) => text+"\n\n🛒 Shop: "+catalogUrl;
export const TEMPLATES = [
  { emoji:"🍞", label:"Fresh bread arrived",  text:"Fresh bread just arrived! 🍞 Hot and ready now." },
  { emoji:"🌾", label:"Rice available",        text:"Rice is available now! 🌾 Come buy today." },
  { emoji:"🏷️", label:"Discount today",        text:"Big discount today only! 🏷️ Save big on selected items." },
  { emoji:"🛒", label:"New stock arrived",     text:"New stock just arrived! 🛒 Fresh goods available." },
  { emoji:"🎉", label:"Weekend special",       text:"Weekend special at our shop! 🎉 Don't miss out." },
];

// Channel configs for Marketing page
export const CHANNELS = [
  { id:"whatsapp", icon:"💬", label:"WhatsApp",       color:"bg-green-50",   tc:"text-green-700",  plan:"free", desc:"Broadcast to customers" },
  { id:"status",   icon:"🟢", label:"WA Status",      color:"bg-green-50",   tc:"text-green-700",  plan:"free", desc:"Post to WhatsApp Status" },
  { id:"sms",      icon:"📱", label:"SMS",            color:"bg-blue-50",    tc:"text-blue-700",   plan:"free", desc:"Reach non-WhatsApp users" },
  { id:"email",    icon:"📧", label:"Email",          color:"bg-purple-50",  tc:"text-purple-700", plan:"free", desc:"Send email campaigns" },
  { id:"tiktok",   icon:"🎵", label:"TikTok",         color:"bg-pink-50",    tc:"text-pink-700",   plan:"free", desc:"AI caption generator" },
  { id:"facebook", icon:"📘", label:"Facebook",       color:"bg-blue-50",    tc:"text-blue-700",   plan:"free", desc:"AI post generator" },
  { id:"instagram",icon:"📸", label:"Instagram",      color:"bg-orange-50",  tc:"text-orange-600", plan:"free", desc:"AI caption generator" },
];

// Track order initiation before opening WhatsApp
export const trackAndOrder = async (params, visitId, orderId) => {
  const { shopPhone, shopName, items, orderType, customerName, shopSlug } = params;
  const API_URL = process.env.REACT_APP_API_URL || "/api";
  try {
    await fetch(API_URL + "/analytics/track-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitId, shopSlug,
        items: items.map(i => ({ productId:i._id, name:i.name, qty:i.qty, price:i.price, currency:i.currency })),
        orderType, customerName,
        customerPhone: params.customerPhone,
      })
    });
  } catch {}
  buildOrderMessage(params);
};

// Generate tracked catalog URL — encodes customer ID so visits can be attributed
export const getTrackedCatalogUrl = (catalogUrl, customerId, campaignId) => {
  let url = catalogUrl;
  if (customerId) url += (url.includes("?") ? "&" : "?") + "cid=" + customerId;
  if (campaignId) url += "&camp=" + campaignId;
  return url;
};

// Track cart action
export const trackCart = async (visitId, items) => {
  const API_URL = process.env.REACT_APP_API_URL || "/api";
  try {
    await fetch(API_URL + "/analytics/track-cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitId, items }),
    });
  } catch {}
};
