# 🛍️ Kustomer

> **Your shop. Your customers. WhatsApp.**
> A mobile-first commerce platform built for African shop owners — broadcast to customers, manage your product catalog, and receive WhatsApp orders. Built with an OPay-style UI.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb&logoColor=white)
![Paystack](https://img.shields.io/badge/Payments-Paystack-00C2B2?style=flat)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

---

## 📱 What is Kustomer?

Kustomer lets small shop owners in Africa:

- **Build a product catalog** with photos, prices, and stock status
- **Broadcast WhatsApp messages** to all or selected customers with one tap
- **Share a public catalog link** so customers can browse and place orders directly via WhatsApp
- **Monetise** through subscriptions, pay-as-you-go credits, and a reseller referral program

The entire order flow happens on WhatsApp — no payment gateway needed for customers, no app to download. A customer taps your catalog link, adds items to cart, chooses pickup or pay-on-delivery, and WhatsApp opens with a pre-filled order message sent straight to your number.

---

## ✨ Features

### For Shop Owners
- OPay-style dashboard with live credit balance and stats
- Add, edit, and delete products with photo upload (Cloudinary)
- Toggle products in/out of stock
- Add and search customers
- Broadcast messages with catalog link auto-appended
- Quick message templates (Fresh bread, Rice, Discounts etc.)
- Message history with credits used per broadcast
- Public catalog link — share anywhere, no login required for customers

### Monetisation (3 models built in)
- **Subscriptions** — Free / Starter (₦2,500/mo) / Pro (₦6,500/mo) via Paystack
- **Top-up credits** — Buy credit packs (100 / 500 / 1,000 / 5,000 sends) via Paystack
- **Reseller program** — Unique referral code per reseller, 30% commission auto-logged on every referred signup that upgrades

### For Customers (public catalog page)
- WhatsApp-style product card grid with images
- Add to cart with quantity controls
- Choose Pickup or Pay on Delivery
- One tap sends a pre-filled order summary to the shop owner on WhatsApp

---

## 🗂️ Project Structure

```
kustomer-v3/
├── backend/                        # Node.js + Express API
│   ├── src/
│   │   ├── index.js                # Server entry point
│   │   ├── models/
│   │   │   ├── User.js             # Shop owner — plans, credits, reseller
│   │   │   ├── Product.js          # Product catalog
│   │   │   ├── Customer.js         # Customer contacts
│   │   │   ├── Message.js          # Broadcast history
│   │   │   ├── Transaction.js      # Payment records
│   │   │   └── ResellerSale.js     # Reseller commissions
│   │   ├── routes/
│   │   │   ├── auth.js             # Signup, login, shop settings
│   │   │   ├── products.js         # Product CRUD + photo upload
│   │   │   ├── customers.js        # Customer CRUD + search
│   │   │   ├── messages.js         # Broadcast history + credit deduction
│   │   │   ├── billing.js          # Subscriptions + credits via Paystack
│   │   │   ├── catalog.js          # PUBLIC — customer-facing catalog
│   │   │   └── reseller.js         # Reseller dashboard + commissions
│   │   └── middleware/
│   │       ├── auth.js             # JWT verification
│   │       └── upload.js           # Cloudinary + Multer photo upload
│   ├── .env.example
│   └── package.json
│
└── frontend/                       # React 18 + Tailwind CSS
    ├── src/
    │   ├── App.js                  # Routes — public /shop/:slug + protected
    │   ├── pages/
    │   │   ├── Login.js            # OPay-style green login screen
    │   │   ├── Signup.js           # Shop registration with referral code
    │   │   ├── Home.js             # Dashboard — credits, stats, quick actions
    │   │   ├── Products.js         # Product management with photo upload
    │   │   ├── Customers.js        # Customer list, search, add
    │   │   ├── Broadcast.js        # WhatsApp broadcast + template picker
    │   │   ├── Billing.js          # Plans, credit top-up, transaction history
    │   │   ├── Reseller.js         # Referral dashboard + commission tracker
    │   │   ├── Settings.js         # Shop settings + account management
    │   │   └── Catalog.js          # PUBLIC — customer product grid + cart
    │   ├── components/
    │   │   ├── BottomNav.js        # Home/Products/Customers/Broadcast/Plans
    │   │   └── PlanBadge.js        # Free/Starter/Pro badge component
    │   ├── context/
    │   │   └── AuthContext.js      # Global auth state
    │   └── utils/
    │       ├── api.js              # Axios instance with JWT interceptor
    │       └── whatsapp.js         # wa.me link builder + order message builder
    └── package.json
```

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (free)
- Cloudinary account (free)
- Paystack account (free)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/kustomer-v3.git
cd kustomer-v3
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/kustomer_v3?appName=Cluster0
JWT_SECRET=any_long_random_string_here
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
APP_URL=http://localhost:5000
```

Start the backend:

```bash
npm run dev
# API running at http://localhost:5000
# Test: http://localhost:5000/api/health
```

### 3. Frontend setup

```bash
cd ../frontend
npm install
```

Create `.env`:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_URL=http://localhost:3000
```

Start the frontend:

```bash
npm start
# App running at http://localhost:3000
```

---

## ☁️ Deployment

### Backend → Render (free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo and set:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | Free |

4. Add all environment variables from your `.env`
5. Deploy — your backend URL will be `https://your-app.onrender.com`

### Frontend → Vercel (free)

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set Root Directory to `frontend`
3. Add environment variables:

| Key | Value |
|---|---|
| `REACT_APP_API_URL` | `https://your-render-url.onrender.com/api` |
| `REACT_APP_URL` | `https://your-app.vercel.app` |

4. Deploy

### Final wiring

After both are deployed, go back to Render → Environment → add:

| Key | Value |
|---|---|
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `APP_URL` | `https://your-render-url.onrender.com` |

Click Save Changes. Done. ✅

---

## 🔌 API Reference

All protected routes require `Authorization: Bearer <token>` header.

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | ❌ | Create shop account |
| POST | `/api/auth/login` | ❌ | Login |
| GET | `/api/auth/me` | ✅ | Get current user |
| PATCH | `/api/auth/shop` | ✅ | Update shop settings |

### Products
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | ✅ | List all products |
| POST | `/api/products` | ✅ | Add product (with photo) |
| PATCH | `/api/products/:id` | ✅ | Update product |
| DELETE | `/api/products/:id` | ✅ | Delete product |

### Customers
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/customers` | ✅ | List + search customers |
| GET | `/api/customers/count` | ✅ | Total customer count |
| POST | `/api/customers` | ✅ | Add customer |
| DELETE | `/api/customers/:id` | ✅ | Remove customer |

### Catalog (public — no auth)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/catalog/:shopSlug` | ❌ | Shop info + in-stock products |

### Billing
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/billing/plans` | ❌ | Plan + credit pack info |
| GET | `/api/billing/me` | ✅ | Current plan + transaction history |
| POST | `/api/billing/subscribe` | ✅ | Start subscription via Paystack |
| POST | `/api/billing/buy-credits` | ✅ | Buy credit pack via Paystack |
| GET | `/api/billing/verify/:ref` | ❌ | Paystack payment callback |

### Reseller
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/reseller/me` | ✅ | Reseller dashboard data |
| POST | `/api/reseller/apply` | ✅ | Activate reseller account |

---

## 💰 Monetisation Models

### Subscriptions
| Plan | Price | Customers | Credits/month |
|---|---|---|---|
| Free | ₦0 | 50 | 30 |
| Starter | ₦2,500/mo | 300 | 500 |
| Pro | ₦6,500/mo | Unlimited | 2,000 |

### Credit Packs (pay-as-you-go)
| Pack | Sends | Price | Per send |
|---|---|---|---|
| Starter | 100 | ₦500 | ₦5 |
| Popular | 500 | ₦2,000 | ₦4 |
| Growth | 1,000 | ₦3,500 | ₦3.5 |
| Scale | 5,000 | ₦15,000 | ₦3 |

### Reseller Program
- Every user can activate a reseller account and get a unique referral code
- Share link: `yourapp.com/signup?ref=CODE`
- Earn **30% commission** on every plan a referred shop purchases
- Commissions tracked automatically in the reseller dashboard

---

## 🛒 How the Order Flow Works

```
Shop owner broadcasts →  "Fresh bread! Order here: kustomer.app/shop/mama-ngozi-4f2a"
         ↓
Customer taps the link → browses product grid with photos
         ↓
Customer adds items to cart → adjusts quantities
         ↓
Chooses: 🏪 Pickup  or  🚚 Pay on Delivery
         ↓
Taps "Send Order via WhatsApp"
         ↓
WhatsApp opens with full order summary pre-filled to shop owner's number
         ↓
Customer taps Send → shop owner confirms ✅
```

Orders are not stored in the database — they flow directly through WhatsApp. No payment infrastructure needed for customers.

---

## 🔒 Security

- Passwords hashed with bcrypt (cost factor 10)
- JWT tokens expire in 30 days
- Every customer/product route checks owner ID — users can only access their own data
- Rate limiting — 200 requests per 15 minutes per IP
- Input validation on all routes via express-validator
- Cloudinary images compressed and resized server-side before storage

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Tailwind CSS, React Router v6 |
| Backend | Node.js, Express |
| Database | MongoDB Atlas |
| Photos | Cloudinary |
| Payments | Paystack |
| Auth | JWT + bcrypt |
| Frontend hosting | Vercel (free) |
| Backend hosting | Render (free) |

---

## 📋 Environment Variables

### Backend `.env`

| Variable | Description | Where to get it |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | MongoDB Atlas → Connect |
| `JWT_SECRET` | Any long random string | Make it up |
| `NODE_ENV` | `production` or `development` | Type it manually |
| `FRONTEND_URL` | Your Vercel URL | After Vercel deploys |
| `APP_URL` | Your Render URL | After Render deploys |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Cloudinary dashboard |
| `PAYSTACK_SECRET_KEY` | Paystack secret key | Paystack → Settings → API Keys |

### Frontend `.env`

| Variable | Description |
|---|---|
| `REACT_APP_API_URL` | Your Render URL + `/api` |
| `REACT_APP_URL` | Your Vercel URL |

---

## 🤝 Contributing

Pull requests are welcome. For major changes please open an issue first to discuss what you would like to change.

---

## 📄 License

MIT — free to use, modify, and deploy.

---

## 👤 Author

Built by James Abah — for African shop owners who want to reach their customers on WhatsApp.

---

*Built with ❤️ for African commerce.*
