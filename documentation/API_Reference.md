# OpenTill - API & Developer Reference v2.0

**Status:** Official | **Version:** 2.0 | **Last Updated:** March 2026

---

## 📖 Table of Contents

1.  [**Introduction**](#1-introduction)
2.  [**Core Database RPCs**](#2-core-database-rpcs)
    *   [`sell_items`](#sell_items)
    *   [`increment_gift_card_balance`](#increment_gift_card_balance)
3.  [**Supabase Edge Functions**](#3-supabase-edge-functions)
    *   [Delivery Webhook (`POST /delivery-webhook`)](#delivery-webhook-post-delivery-webhook)
4.  [**Database Schema Breakdown**](#4-database-schema-breakdown)
    *   [`orders` & `order_items`](#orders--order_items)
    *   [`kitchen_tickets`](#kitchen_tickets)
    *   [`products` & `ingredients`](#products--ingredients)
5.  [**Authentication & Headers**](#5-authentication--headers)
6.  [**Errors & Troubleshooting**](#6-errors--troubleshooting)

---

## 1. Introduction

This reference details the backend interfaces for OpenTill. The primary interaction method is via **PostgreSQL Remote Procedure Calls (RPCs)**, ensuring atomic transactions and data integrity.

**Base URL**: `https://<supabase-project>.supabase.co/rest/v1`

---

## 2. Core Database RPCs

**IMPORTANT**: Clients (POS, Web) MUST use these functions for financial transactions. Direct `INSERT` into `orders` is deprecated.

### `sell_items`
**Purpose**: Atomically process a sale, deduct inventory, and create a kitchen ticket.

**Signature**:
```sql
FUNCTION sell_items(order_payload jsonb) RETURNS jsonb
```

**Parameters (JSON Object)**:
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `branchId` | `UUID` | Yes | The store location ID. |
| `totalAmount` | `Integer` | Yes | Transaction total in cents (e.g. 1000 = $10.00). |
| `paymentMethod` | `String` | Yes | 'CASH', 'CARD', 'GIFT_CARD_XX'. |
| `customerName` | `String` | No | Required for delivery/takeaway. |
| `tableNumber` | `String` | No | Table number or "Takeaway". |
| `giftCardCode` | `String` | Cond. | Required if paymentMethod starts with 'GIFT_CARD'. |
| `items` | `Array` | Yes | List of items purchased. |

**Item Object Structure**:
```json
{
  "id": "uuid-of-variant", // If null/empty, stock is not deducted (Custom Item)
  "name": "Latte", 
  "quantity": 1,
  "price": 450, // Unit price in cents
  "modifiers": ["Oat Milk", "Extra Hot"] // Array of strings
}
```

**Returns**:
```json
{
  "success": true,
  "order_id": "uuid-of-created-order"
}
```

---

### `increment_gift_card_balance`
**Purpose**: Top up a gift card. Handles row locking to prevent race conditions.

**Signature**:
```sql
FUNCTION increment_gift_card_balance(card_code_input text, amount numeric) RETURNS jsonb
```

**Parameters**:
| Field | Type | Description |
| :--- | :--- | :--- |
| `card_code_input` | `String` | The unique alphanumeric code. |
| `amount` | `Numeric` | Amount to add (e.g. 50.00). |

**Returns**:
```json
{
  "success": true,
  "new_balance": 150.00
}
```

---

## 3. Supabase Edge Functions

### Delivery Webhook (`POST /delivery-webhook`)
**Endpoint**: `https://<project>.supabase.co/functions/v1/delivery-webhook`

**Purpose**: Ingest orders from UberEats, DoorDash, Deliveroo.

**Headers**:
*   `Authorization`: `Bearer <anon-key>` or Service Role (depending on config).
*   `x-delivery-provider`: `ubereats` | `doordash` | `deliveroo`.

**Request Body**:
```json
{
  "branch_id": "uuid-of-branch",
  "total_amount": 25.50, // Float allowed (converted to cents internally)
  "customer_name": "John Doe",
  "items": [
    {
      "name": "Cheeseburger", // MUST match a variant 'name' in `variants` table
      "quantity": 2,
      "price": 12.00,
      "modifiers": ["No Pickles"]
    }
  ]
}
```

**Response**:
*   **200 OK**: `{ "order_id": "uuid", "success": true }`
*   **400 Bad Request**: `{ "error": "Invalid payload: 'items' required" }`

---

## 4. Database Schema Breakdown

### `orders` & `order_items`
*   **`orders`**: Stores the high-level transaction state.
    *   `status`: 'PENDING', 'COMPLETED', 'VOID'.
    *   `payment_method`: Used for reporting.
*   **`order_items`**: Denormalized line items.
    *   `product_name_snapshot`: Stores the name at time of sale (in case product name changes later).
    *   `variant_id`: Link to `variants` table (nullable).

### `kitchen_tickets`
*   **`items` (JSONB)**: Contains full item details + modifiers for display on KDS.
*   **`status`**: 'PENDING' -> 'COMPLETED'.
*   **`created_at`**: Used for measuring "Time to Ticket" metrics.

### `products`, `variants` & `ingredients`
*   **`products`**: The generic concept (e.g. "Coffee").
*   **`variants`**: Specific sellable unit (e.g. "Coffee - Large").
*   **`ingredients`**: Raw material (e.g. "Coffee Beans").
*   **`product_ingredients`**: Join table defining the recipe.
    *   `quantity_required`: Amount of ingredient used per variant.

---

## 5. Authentication & Headers

**Client Authentication**:
*   All requests require `apikey` and `Authorization: Bearer <token>`.
*   **Anon Key**: Public, limited by RLS. Used by unauthenticated kiosk screens.
*   **Service Role Key**: Private, bypasses RLS. Used strictly by admin scripts/edge functions.

**Custom Headers**:
*   `x-client-info`: Tracking version (e.g. `opentill-pos/2.0`).

---

## 6. Errors & Troubleshooting

**Common PL/pgSQL Errors**:
*   **`P0001`**: Raised via `RAISE EXCEPTION`. Check `message` property.
    *   "Insufficient gift card balance"
    *   "Gift card not found"
*   **`23505`**: Unique violation (e.g. processing same UUID twice).

**Edge Function Logs**:
View logs in Supabase Dashboard > Edge Functions > `delivery-webhook`.

```json
// Example Error Response
{
  "code": "P0001",
  "details": null,
  "hint": null,
  "message": "Insufficient gift card balance"
}
```
