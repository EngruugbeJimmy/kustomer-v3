import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Desktop branding panel — only visible on screens wider than 1100px
// Sits to the left of the app shell on large screens
const DesktopBrand = () => (
  <div className="desktop-brand">
    <div>
      <div className="pill"><span></span> Africa-first commerce</div>
      <h1>Sell more.<br/>Reach everyone.</h1>
      <p>
        Kustomer helps African shop owners manage customers, 
        broadcast across WhatsApp, SMS and social media, and 
        publish product videos to YouTube — all in one app.
      </p>
    </div>

    <div className="divider"/>

    <div className="stat">
      <div className="stat-number">7</div>
      <div className="stat-label">Marketing channels in one app</div>
    </div>
    <div className="stat">
      <div className="stat-number">₦500</div>
      <div className="stat-label">YouTube product video — no editing needed</div>
    </div>
    <div className="stat">
      <div className="stat-number">₦1,500</div>
      <div className="stat-label">Starter plan — same as one data bundle</div>
    </div>
  </div>
);

// Wrap the app in a layout div so the branding panel
// and the app shell sit side by side on large screens
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
