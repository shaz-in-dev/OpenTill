# OpenTill - Open Source Restaurant POS

OpenTill is a modern, offline-first Point of Sale (POS) system designed for restaurants, cafes, and bars. Built with **React**, **Vite**, and **Supabase**, it offers a comprehensive suite of features to manage your hospitality business efficiently.

![OpenTill](https://via.placeholder.com/800x400?text=OpenTill+Dashboard)

## 🚀 Key Features

*   **Point of Sale (POS)**: Fast and intuitive interface for taking orders. Supports Cash, Card, and Gift Card payments.
*   **Offline Resilience**: 
    *   **PWA**: Installable as a native app.
    *   **IndexedDB Caching**: Continue taking orders even when the internet goes down. Orders sync automatically when connectivity is restored.
*   **Kitchen Display System (KDS)**: 
    *   Digital ticket screen for the kitchen.
    *   Works offline! (Syncs with local POS data).
    *   Supports partial item completion and order voiding.
*   **Inventory & Supply Chain**:
    *   Track ingredients and products.
    *   Manage Suppliers and create Purchase Orders (POs) with Draft/Sent/Received workflows.
    *   Recipe management: Link ingredients to active products for automatic deduction.
*   **Staff Management**:
    *   Role-based access (Admin, Manager, Cashier, Kitchen).
    *   Clock In/Out tracking with labor cost estimation.
*   **CRM & Loyalty**:
    *   Customer database with purchase history.
    *   Loyalty points system (Earn & Redeem).
*   **Table Management**: Visual table selection and booking/reservation system.
*   **Integration Ready**: 
    *   **Delivery Webhooks**: Accept orders from delivery platforms (UberEats/Deliveroo) directly into your POS via Supabase Edge Functions.

## 🛠 Tech Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **State/Caching**: Supabase Client, Dexie.js (IndexedDB), React Query (implied via hooks)
*   **Styling**: CSS Modules, Lucide React (Icons)
*   **Charts**: Recharts
*   **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
*   **PWA**: Vite Plugin PWA, Workbox

## 📦 Prerequisites

*   **Node.js** (v18 or higher)
*   **npm** or **yarn**
*   **Supabase Account**: You need a Supabase project for the database and authentication.

## ⚡ Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/drafthacker2889/OpenTill.git
    cd OpenTill
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Configuration:**
    Create a `.env` file in the root directory (or `.env.local`):
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
    *(Note: You can find these in your Supabase Project Settings -> API)*

4.  **Database Setup:**
    *   Copy the content of `database_schema.sql`.
    *   Go to your Supabase Dashboard -> SQL Editor.
    *   Paste and run the script to create all necessary tables and relationships.
    *   *Tip: Ensure you enable the `uuid-ossp` extension if it's not already enabled.*

5.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    The app will start at `http://localhost:5173`.

## 🏗 Building for Production

To create a production build (PWA ready):

```bash
npm run build
```

This generates the `dist/` folder, which can be deployed to Vercel, Netlify, or any static host.

## 🔌 Delivery Webhooks (Edge Functions)

OpenTill supports incoming webhooks for delivery orders.

1.  **Deploy the Function:**
    Ensure you have the Supabase CLI installed and logged in.
    ```bash
    supabase functions deploy delivery-webhook
    ```
2.  **Webhook URL:**
    Your webhook endpoint will be: `https://[your-project-ref].supabase.co/functions/v1/delivery-webhook`
3.  **Payload Format:**
    Send a POST request with the following JSON structure:
    ```json
    {
      "branch_id": "optional-uuid",
      "total_amount": 15.50,
      "items": [
        { "name": "Latte", "quantity": 2, "modifiers": ["Oat Milk"] },
        { "name": "Croissant", "quantity": 1 }
      ]
    }
    ```
    *Header requirement*: `x-delivery-provider: ubereats` (or deliveroo/justeat/etc).

## 🌍 Internationalization

OpenTill supports multiple languages via `i18next`. Translation files are located in `src/locales/`.

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
