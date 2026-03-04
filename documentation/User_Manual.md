# OpenTill - Comprehensive User Operations Manual v2.0

**Status:** Official | **Version:** 2.0 | **Last Updated:** March 2026

---

## 📖 Table of Contents

1.  [**Introduction & System Overview**](#1-introduction--system-overview)
2.  [**Getting Started: First-Time Setup**](#2-getting-started-first-time-setup)
3.  [**Role-Based Workflows**](#3-role-based-workflows)
    *   [3.1 Waitstaff & Cashiers](#31-waitstaff--cashiers)
    *   [3.2 Kitchen & Back-of-House](#32-kitchen--back-of-house)
    *   [3.3 Managers](#33-managers)
4.  [**Core POS Operations**](#4-core-pos-operations)
    *   [Starting a Shift](#starting-a-shift)
    *   [Taking Orders (Dine-In vs Takeaway)](#taking-orders-dine-in-vs-takeaway)
    *   [Modifying Items (Notes & Add-ons)](#modifying-items-notes--add-ons)
    *   [Processing Payments](#processing-payments)
    *   [Splitting Bills](#splitting-bills)
    *   [Refunds & Voids](#refunds--voids)
5.  [**Kitchen Display System (KDS)**](#5-kitchen-display-system-kds)
6.  [**Inventory & Stock Management**](#6-inventory--stock-management)
7.  [**Gift Card Management**](#7-gift-card-management)
8.  [**Troubleshooting & Offline Mode**](#8-troubleshooting--offline-mode)

---

## 1. Introduction & System Overview

Welcome to **OpenTill**, the enterprise-grade Point of Sale (POS) system designed for stability, speed, and offline resilience in high-volume hospitality environments.

### Key Capabilities
*   **Offline-First Architecture**: Changes are saved locally and synced automatically when the internet returns.
*   **Real-Time Kitchen Sync**: Orders travel from the POS to the Kitchen screens instantly via WebSocket.
*   **Live Inventory**: Every sale deducts ingredients immediately (e.g., selling a Burger deducts 1 Bun, 1 Patty, 1 Cheese slice).
*   **Role-Based Security**: Strict permissions separate cashier functions from manager audits.

---

## 2. Getting Started: First-Time Setup

Before starting service, ensure your terminal is ready.

### Hardware Checklist
1.  **Touch Terminal**: Ensure the device is powered on.
2.  **Receipt Printer**: Verify paper roll is full and status light is green.
3.  **Network**: Connect to the store Wi-Fi (Staff Network).
4.  **Scanner**: Test the barcode scanner by scanning a sample product.

### Login Process
1.  Tap the OpenTill icon.
2.  Enter your **4-digit Staff PIN**.
    *   *Note: If you forget your PIN, ask a Manager to reset it via the Admin Dashboard.*
3.  Upon successful login, you will land on the **Floor Plan** (for Dine-In) or **Quick Serve** screen.

---

## 3. Role-Based Workflows

### 3.1 Waitstaff & Cashiers
**Focus**: Speed and Accuracy.
*   **Start of Shift**: Count float, log in, check daily specials.
*   **Service**: Take orders, enter modifiers (allergies), process payments, clear tables.
*   **End of Shift**: Print X-Report, count cash, log out.

### 3.2 Kitchen & Back-of-House
**Focus**: Efficiency and Flow.
*   **Station Setup**: Check KDS screen is online.
*   **Order Management**: Watch for new tickets. Start cooking "Green" tickets immediately.
*   **Ticket Bumping**: Tap "Ready" when food is plated to clear the screen.

### 3.3 Managers
**Focus**: Control and Audit.
*   **Live Dashboard**: Monitor Sales Per Hour and open tables.
*   **Staff Management**: Add new users, adjust permissions.
*   **Product Management**: Update prices, add specials, set low-stock alerts.
*   **Reporting**: Generate Z-Reports (End of Day) and export sales data.

---

## 4. Core POS Operations

### Starting a Shift
1.  Log in with your PIN.
2.  Tap **"Shift"** > **"Start Shift"**.
3.  **Float Count**: Enter the opening cash amount (e.g., $200.00).
4.  Tap **Confirm**. A slip prints verifying the start time.

### Taking Orders (Dine-In vs Takeaway)

#### Dine-In Flow
1.  Tap **"Tables"** view.
2.  Select an **Available Table** (Grey). It turns Blue (Occupied).
3.  **Add Guests**: Enter number of covers.
4.  **Select Items**: Tap categories -> Items to add to cart.
5.  Tap **"Send to Kitchen"**.

#### Takeaway Flow
1.  Tap **"Quick Serve"**.
2.  (Optional) Enter Customer Name for call-out.
3.  Add items to cart.
4.  Process payment immediately.

### Modifying Items (Notes & Add-ons)
*   **Variants**: If an item has sizes (e.g., Coffee), a popup asks "Small/Large?".
*   **Modifiers**: Long-press an item in the cart to add extras (e.g., "Extra Cheese").
*   **Custom Notes**: 
    1.  Long-press item line.
    2.  Tap "Note".
    3.  Type instruction (e.g., "ALLERGY: NUTS").
    4.  This prints in **BOLD RED** on the kitchen ticket.

### Processing Payments
1.  Tap **"Pay"** (Bottom Right).
2.  Confirm Total.
3.  Choose Method:
    *   **CASH**: Tap shortcut ($10, $20) or type active amount. System calculates change.
    *   **CARD**: Integrated terminal wakes up -> Tap card -> Approved.
    *   **GIFT CARD**: Scan QR code. System validates balance.
4.  **Receipt**: Print, Email, or Skip.

### Splitting Bills
1.  Open active table.
2.  Tap **"Split Bill"**.
3.  **Split by Item**: Drag items to "Seat 1", "Seat 2".
4.  **Split Evenly**: Tap "Split 3 Ways" etc.
5.  Pay each sub-bill individually.

### Refunds & Voids
*   **Void (Pre-Payment)**: Remove item from cart. Requires Manager PIN if configured.
*   **Refund (Post-Payment)**:
    1.  Go to **Menu** > **History**.
    2.  Find receipt.
    3.  Tap **"Refund"**.
    4.  Select items -> Reason ("Error", "Complaint").
    5.  Refund to **Original Payment Method**.

---

## 5. Kitchen Display System (KDS)

The KDS replaces paper tickets.

*   **New Orders**: Appear on left.
    *   **Green**: < 5 mins old.
    *   **Yellow**: 5-15 mins.
    *   **Red**: > 15 mins (Overdue).
*   **Complete**: Tap "Done" to clear ticket.
*   **Recall**: Go to "Completed" tab to restore a ticket if accidentally cleared.

---

## 6. Inventory & Stock Management

OpenTill tracks "Ingredients" not just "Products".
*   **Recipe Logic**: Selling 1x "Cheeseburger" deducts:
    *   1x Bun
    *   1x Patty
    *   1x Cheese Slice
*   **Stock Check**: Go to Admin > Inventory to see levels.
*   **Out of Stock**: If an item hits 0, the POS button turns grey (Disabled).

**Performing a Stock Take:**
1.  Admin > Inventory > Stock Take.
2.  Count physical items.
3.  Enter counts.
4.  Submit. System records "Variance" as wastage.

---

## 7. Gift Card Management

### Issuing Cards
1.  Menu > Gift Cards > **Issue New**.
2.  Scan blank card.
3.  Load amount ($50).
4.  Process payment.

### Checking Balance
1.  Tap **"Check Balance"**.
2.  Scan customer card.
3.  Screen shows active balance and expiry.

---

## 8. Troubleshooting & Offline Mode

### 🔴 Scenario: "Offline Mode" Banner
**Cause**: Internet lost.
**Action**:
1.  **Do NOT** restart app.
2.  Continue trading. 
    *   ✅ Cash = OK.
    *   ✅ Printing = OK.
    *   ✅ Saving Orders = OK (Saved locally).
    *   ❌ Card Payments = Only if terminal has 4G backup.
3.  When internet returns, banner turns green. Sync happens automatically.

### ⚠️ Scenario: Printer Stuck
1.  Check paper / lid closed.
2.  Check network cable at back of printer.
3.  Turn printer OFF/ON.
4.  If failed, use KDS screen.

### 📞 Support
**Internal Helpdesk**: Ext 555
**Vendor Support**: support@opentill.com (Quote Terminal ID)
