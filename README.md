# 🏪 OpenTill - Enterprise-Grade Open Source POS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdrafthacker2889%2FOpenTill)
[![Supabase](https://img.shields.io/badge/Built%20with-Supabase-green)](https://supabase.com)
[![React](https://img.shields.io/badge/Frontend-React%2018-blue)](https://react.dev)

**OpenTill** is a robust, offline-first Point of Sale (POS) system engineered for the modern hospitality industry. From bustling cafes to fine dining restaurants, OpenTill provides a seamless experience for staff and powerful insights for owners—completely open source.

🔗 **Live Demo**: [https://open-till-imaj.vercel.app/](https://open-till-imaj.vercel.app/)

---

## ✨ Features at a Glance

### 🖥️ **Robust Point of Sale (POS)**
*   **Quick Service & Dining Modes**: Toggle between fast-casual counter service and full tableside ordering with a visual table map.
*   **Atomic Transactions**: Utilizing PostgreSQL RPCs (`sell_items`) to ensure **stock deduction**, **financial recording**, and **staff attribution** happen in a single, fail-safe database transaction. Zero race conditions.
    *   *Prevents overselling even during high-traffic periods.*
    *   *Accurate Tax Calculation*: Built-in logic handles complex tax scenarios reliably.
*   **Multi-Branch Support**: Tenant isolation logic ensures orders, stock, and tables are siloed by branch ID, preventing data leaks in multi-location setups.
*   **True Offline Resilience**: Built on **Dexie.js** and **Workbox**, the POS works completely offline.
    *   Orders are stored locally in IndexedDB.
    *   **Auto-Sync**: Background synchronization pushes offline sales and kitchen tickets the moment connectivity returns.

### 🍳 **Intelligent Kitchen Display System (KDS)**
*   **Real-Time Fire**: Orders appear instantly on kitchen screens via **Supabase Realtime** websockets.
*   **Smart Routing**: Items are routed to specific stations (e.g., Drinks bar vs. Hot Food).
*   **Syncs with Offline POS**: Even if the POS loses internet, it continues to function and will push queued tickets to the KDS once reconnected.

### 📦 **Inventory & Supply Chain**
*   **Recipe-Based Deduction**: Define ingredients (e.g., "Coffee Bean", "Milk", "Sugar") for products. Selling a "Latte" automatically deducts 18g of beans and 200ml of milk.
*   **Low Stock Alerts**: Visual warnings when ingredients dip below thresholds.
*   **Supplier Management**: Create and track Purchase Orders (PO) to restock efficiently.

### 💳 **Customer & Loyalty**
*   **Self-Service Menu**: A dedicated customer-facing interface for QR code ordering at the table.
    *   *Secure*: Pricing is calculated server-side to prevent tampering.
*   **Integrated Loyalty**: Earn points per transaction and redeem for discounts.
*   **Gift Cards**: Issue, redeem, and recharge gift cards with secure balance tracking.

### 🔌 **Open API & Integrations**
*   **Delivery Webhooks**: Ready-to-use **Supabase Edge Functions** to ingest orders from UberEats/Deliveroo webhooks directly into your POS.
*   **Developer Friendly**: Full TypeScript codebase, strict typing, and a documented SQL schema.

---

## 🛠️ Technology Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **State Management**: React Query (Server state), Context API (App state)
*   **Database**: Supabase (PostgreSQL)
*   **Offline Storage**: Dexie.js (IndexedDB wrapper)
*   **Authentication**: Supabase Auth
*   **Styling**: CSS Modules, Lucide React Icons
*   **Hosting**: Vercel (Frontend), Supabase (Backend/Database)

---

## 📸 Screenshots

| POS Interface | Admin Dashboard |
|:---:|:---:|
| ![POS](https://via.placeholder.com/400x250?text=Point+of+Sale+UI) | ![Admin](https://via.placeholder.com/400x250?text=Analytics+Admin) |

| Kitchen Display | Inventory |
|:---:|:---:|
| ![KDS](https://via.placeholder.com/400x250?text=Kitchen+Display+System) | ![Stock](https://via.placeholder.com/400x250?text=Inventory+Management) |

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   npm or yarn
*   A free [Supabase](https://supabase.com) account.

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/drafthacker2889/OpenTill.git
cd OpenTill
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Migration

1.  Navigate to your Supabase Dashboard -> **SQL Editor**.
2.  Open the file `database_schema.sql` from this repository.
3.  Copy and paste the contents into the SQL Editor and run it. This will create all tables, stored procedures, and triggers.

### 4. Running Locally

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:5173` to launch the app.

---

## ☁️ Deployment

### Frontend (Vercel)
This project is optimized for Vercel.
1.  Push your code to GitHub.
2.  Import the project into Vercel.
3.  Add the Environment Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Vercel Settings.
4.  Deploy!

### Backend Functions (Webhooks)
To deploy the Delivery Webhook edge function:

```bash
supabase login
supabase functions deploy delivery-webhook --project-ref your-project-ref
```

**Webhook URL:** `https://[project-ref].supabase.co/functions/v1/delivery-webhook`

---

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for review.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
