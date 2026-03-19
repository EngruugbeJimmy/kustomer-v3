export const generateWaLink = (phone, msg) =>
  "https://wa.me/" + phone.replace(/[^\d+]/g,"") + "?text=" + encodeURIComponent(msg);

export const sendWhatsApp = (phone, msg) => window.open(generateWaLink(phone, msg), "_blank");

export const broadcastMessages = async (customers, msg, onProgress) => {
  for (let i = 0; i < customers.length; i++) {
    sendWhatsApp(customers[i].phone, msg);
    onProgress?.(i+1, customers.length);
    if (i < customers.length-1) await new Promise(r => setTimeout(r, 900));
  }
};

export const buildOrderMessage = ({ shopPhone, shopName, items, orderType, customerName }) => {
  const lines = items.map(i => "  • " + i.name + " x" + i.qty + "  " + i.currency + (i.price*i.qty).toLocaleString()).join("\n");
  const total  = items.reduce((s,i) => s+i.price*i.qty, 0);
  const msg = "Hello " + shopName + "! 👋\n\nI would like to place an order:\n\n" + lines +
    "\n\n*Total: " + (items[0]?.currency||"₦") + total.toLocaleString() + "*\n\n" +
    "Order type: " + (orderType==="pickup" ? "🏪 Pickup" : "🚚 Pay on Delivery") +
    (customerName ? "\nName: " + customerName : "") + "\n\nPlease confirm. Thank you! 🙏";
  sendWhatsApp(shopPhone, msg);
};

export const buildBroadcastMessage = (text, catalogUrl) => text + "\n\n🛒 Shop here: " + catalogUrl;

export const TEMPLATES = [
  { emoji:"🍞", label:"Fresh bread arrived",  text:"Fresh bread just arrived at our shop! 🍞 Hot and ready now." },
  { emoji:"🌾", label:"Rice available",        text:"Rice is available now! 🌾 Come buy today." },
  { emoji:"🏷️", label:"Discount today",        text:"Big discount today only! 🏷️ Save big on selected items." },
  { emoji:"🛒", label:"New stock arrived",     text:"New stock just arrived! 🛒 Fresh goods available now." },
  { emoji:"🎉", label:"Weekend special",       text:"Weekend special at our shop! 🎉 Don't miss out." },
];
