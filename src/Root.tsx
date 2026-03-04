import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // NEW: i18n
import { Globe, ShoppingCart, User, X, ShoppingBag } from 'lucide-react'; // NEW: Icons for versatility
import { supabase } from './supabaseClient';
import ProductGrid from './components/ProductGrid';
import CartSidebar from './components/CartSidebar';
import ReceiptModal from './components/ReceiptModal';
import PaymentModal from './components/PaymentModal';
import TableSelection from './components/TableSelection'; 
import { deductIngredients } from './utils/inventory';
import './App.css';

// Type definition for items in the cart
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  modifiers?: any[];
  status?: string;
}

interface RootProps {
  userRole: string;
}

export default function Root({ userRole }: RootProps) {
  const { t, i18n } = useTranslation(); // Hook for translations

  // --- State Management ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // --- Table Management States ---
  const [diningModeActive, setDiningModeActive] = useState(false); 
  const [selectedTable, setSelectedTable] = useState<string | null>(null); 
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null); // NEW: Multi-Tenant Branch ID

  // --- NEW: Notification State ---
  const [notification, setNotification] = useState<string | null>(null);

  // --- 1. Load Settings and Persistent Cart ---
  useEffect(() => {
    fetchDiningMode();
    fetchBranchContext(); // NEW: Fetch Branch
  }, []);

  // --- NEW: Multi-Tenant Context Loader ---
  const fetchBranchContext = async () => {
    // For now, we just grab the first branch available. 
    // In a real multi-unit setup, this would be a selection screen or stored in localStorage.
    const { data: branches } = await supabase.from('branches').select('id, name').limit(1);
    if (branches && branches.length > 0) {
      setCurrentBranchId(branches[0].id);
      console.log("Active Branch:", branches[0].name);
    }
  };

  // --- NEW: Notification Listener ---
  useEffect(() => {
    const channel = supabase
      .channel('till_notifications')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kitchen_tickets' },
        (payload) => {
          if (payload.new.status === 'COMPLETED') {
            setNotification(`✅ Order for ${payload.new.table_number} is READY!`);
            setTimeout(() => setNotification(null), 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Every time a table is selected, load its specific saved items from DB
  useEffect(() => {
    if (selectedTable) {
      loadTableCart();
    } else {
      setCart([]); // Clear local view when on floor plan
    }
  }, [selectedTable]);

  const fetchDiningMode = async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'dining_mode')
      .single(); 
    
    if (data) setDiningModeActive(data.value);
  };

  const loadTableCart = async () => {
    if (!selectedTable) return;
    const { data } = await supabase
      .from('table_cart_items')
      .select('*')
      .eq('table_number', selectedTable);
    
    if (data) {
      setCart(data.map(item => ({
        id: item.variant_id,
        name: item.product_name,
        price: item.price_at_addition,
        quantity: item.quantity,
        status: item.status //
      })));
    }
  };

  // --- 2. Add to Cart Logic (Saves to Database) ---
  const addToCart = async (variant: any) => {
    // If Dining Mode is active, items MUST be linked to a table
    if (diningModeActive && !selectedTable) return;

    if (variant.track_stock) {
      // Logic for stock check... simple version: ignore modifiers stock for now, just main item
      const existingInCart = cart.find(i => i.id === variant.id); // Potential bug: matches first one
      const currentQty = existingInCart ? existingInCart.quantity : 0;
      if (currentQty >= variant.stock_quantity) {
        return alert(`Sorry, only ${variant.stock_quantity} left in stock!`);
      }
    }

    const modifiers = variant.modifiers || [];
    const modifierText = modifiers.map((m:any) => `+ ${m.name}`).join(', ');
    const fullName = modifiers.length > 0 ? `${variant.name} \n(${modifierText})` : variant.name;

    if (diningModeActive && selectedTable) {
      // PERSISTENT DB LOGIC: Check if item exists for this table and is still in DRAFT status
      // We search by NAME to differentiate modified items
      const { data: existing } = await supabase
        .from('table_cart_items')
        .select('*')
        .eq('table_number', selectedTable)
        .eq('variant_id', variant.id)
        .eq('product_name', fullName) 
        .eq('status', 'DRAFT') 
        .single();

      if (existing) {
        await supabase.from('table_cart_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
      } else {
        await supabase.from('table_cart_items').insert({
          table_number: selectedTable,
          variant_id: variant.id,
          product_name: fullName,
          price_at_addition: variant.price,
          quantity: 1,
          status: 'DRAFT',
          modifiers: modifiers
        });
        
        await supabase.from('dining_tables').update({ status: 'OCCUPIED' }).eq('table_number', selectedTable);
      }
      loadTableCart(); 
    } else {
      // Fallback for Quick Service (Local State only)
      setCart((prevCart) => {
        const existingItem = prevCart.find((item) => item.id === variant.id && item.name === fullName);
        if (existingItem) {
          return prevCart.map((item) => (item.id === variant.id && item.name === fullName) ? { ...item, quantity: item.quantity + 1 } : item);
        } else {
          return [...prevCart, { id: variant.id, name: fullName, price: variant.price, quantity: 1, modifiers: modifiers }];
        }
      });
    }
  };

  // --- 3. Remove from Cart Logic (Syncs with DB) ---
  const removeFromCart = async (variantId: string, productName?: string) => {
    if (diningModeActive && selectedTable) {
      // Fetch the most recent addition for this variant/product combo
      let query = supabase
        .from('table_cart_items')
        .select('*')
        .eq('table_number', selectedTable)
        .eq('variant_id', variantId);
      
      if (productName) query = query.eq('product_name', productName); // Target specific modified item

      const { data: existing } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        // Handle Voids for items already sent to kitchen
        if (existing.status === 'SENT') {
          if (userRole !== 'manager') {
            return alert("Manager approval required to void sent items.");
          }
          if (!confirm("This item was already sent to the kitchen. Void it?")) return;
          
          // Find the active kitchen ticket to mark it as VOIDED
          const { data: activeTicket } = await supabase
            .from('kitchen_tickets')
            .select('*')
            .eq('table_number', selectedTable)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (activeTicket) {
            const updatedItems = activeTicket.items.map((i: any) => 
              i.name === existing.product_name ? { ...i, void: true } : i
            );
            await supabase.from('kitchen_tickets').update({ items: updatedItems }).eq('id', activeTicket.id);
          }
        }

        if (existing.quantity <= 1) {
          await supabase.from('table_cart_items').delete().eq('id', existing.id);
          
          // Check if table is now empty to revert status to AVAILABLE
          const { data: remaining } = await supabase.from('table_cart_items').select('id').eq('table_number', selectedTable);
          if (!remaining || remaining.length === 0) {
             await supabase.from('dining_tables').update({ status: 'AVAILABLE' }).eq('table_number', selectedTable);
          }
        } else {
          await supabase.from('table_cart_items').update({ quantity: existing.quantity - 1 }).eq('id', existing.id);
        }
      }
      loadTableCart();
    } else {
      // Local state logic
      setCart((prevCart) => {
        const existingItem = prevCart.find((item) => item.id === variantId && (productName ? item.name === productName : true));
        if (!existingItem) return prevCart;
        if (existingItem.quantity === 1) return prevCart.filter((item) => !(item.id === variantId && (productName ? item.name === productName : true)));
        return prevCart.map((item) => (item.id === variantId && (productName ? item.name === productName : true)) ? { ...item, quantity: item.quantity - 1 } : item);
      });
    }
  };

  // --- NEW: Kitchen Routing Logic (Updated for Single Ticket Merging) ---
  const handleSendToKitchen = async () => {
    if (!selectedTable) return;

    // 1. Fetch only items marked as DRAFT
    const { data: draftItems } = await supabase
      .from('table_cart_items')
      .select('*')
      .eq('table_number', selectedTable)
      .eq('status', 'DRAFT');

    if (!draftItems || draftItems.length === 0) return alert("No new items to send.");

    // 2. Check for active ticket to merge
    const { data: activeTicket } = await supabase
      .from('kitchen_tickets')
      .select('*')
      .eq('table_number', selectedTable)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (activeTicket) {
      const mergedItems = [
        ...activeTicket.items,
        ...draftItems.map(i => ({ name: i.product_name, qty: i.quantity, status: 'PENDING' }))
      ];
      await supabase.from('kitchen_tickets').update({ items: mergedItems }).eq('id', activeTicket.id);
    } else {
      // Create new ticket record
      const { error: ticketError } = await supabase.from('kitchen_tickets').insert({
        table_number: selectedTable,
        items: draftItems.map(i => ({ name: i.product_name, qty: i.quantity, status: 'PENDING' })),
        status: 'PENDING'
      });
      if (ticketError) return alert("Kitchen Routing Failed: " + ticketError.message);
    }

    // 3. Update those items to SENT status so they aren't sent again
    await supabase
      .from('table_cart_items')
      .update({ status: 'SENT' })
      .eq('table_number', selectedTable)
      .eq('status', 'DRAFT');

    loadTableCart();
    alert("Kitchen order updated!");
  };

  // --- 4. Checkout Initiation ---
  const handleInitiateCheckout = () => {
    if (cart.length === 0) return alert("Cart is empty!");
    setShowPayment(true);
  };

  // --- 5. Confirm Payment & Clear Table Persistence ---
  const handleConfirmPayment = async (method: 'CASH' | 'CARD', tipAmount: number) => {
    setShowPayment(false);
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = Math.round(subtotal * (discountPercentage / 100));
    const totalAmount = subtotal - discountAmount + tipAmount;

    const payload = {
      branchId: currentBranchId, // NEW: Context passed for multi-unit stock tracking
      totalAmount: totalAmount,
      paymentMethod: method,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        modifiers: item.modifiers || []
      })),
    };

    const { data, error } = await supabase.rpc('sell_items', { order_payload: payload });

    if (error) {
      alert("Transaction Failed!");
    } else {
      // DEDUCT INGREDIENTS
      const ingredientItems = cart.map(item => ({ variant_id: item.id, quantity: item.quantity }));
      deductIngredients(ingredientItems);

      // IF DINING MODE: Clear the saved items and reset table status to AVAILABLE
      if (selectedTable) {
        await supabase.from('table_cart_items').delete().eq('table_number', selectedTable);
        await supabase.from('dining_tables').update({ status: 'AVAILABLE' }).eq('table_number', selectedTable);
      }

      setLastOrder({
        id: data.order_id,
        subtotal: subtotal,
        discount: discountAmount,
        tip: tipAmount,
        total: totalAmount,
        items: [...cart],
        method: method,
      });

      setCart([]);
      setDiscountPercentage(0);
      // setSelectedTable(null); // Commented out to prevent immediate redirect
      setShowReceipt(true);
    }
  };

  // --- Conditional Rendering for Dining Mode ---
  if (diningModeActive && !selectedTable) {
    return <TableSelection onSelect={(table) => setSelectedTable(table)} setDiningMode={setDiningModeActive} />;
  }

  return (
    <div className="app-container">
      {/* --- NEW: Global Header --- */}
      <header className="app-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        height: '60px',
        background: '#1a1a1a', // Dark header
        color: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <ShoppingBag size={24} />
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>OpenTill POS</h1>
          
          <div style={{ display: 'flex', gap: '5px', background: '#333', padding: '4px', borderRadius: '6px', marginLeft: '20px' }}>
            <button 
              onClick={() => setDiningModeActive(false)}
              style={{
                background: !diningModeActive ? '#4caf50' : 'transparent',
                color: !diningModeActive ? 'white' : '#aaa',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.2s'
              }}
            >
              🚀 {t('quick_service')}
            </button>
            <button 
              onClick={() => setDiningModeActive(true)}
              style={{
                background: diningModeActive ? '#ff9800' : 'transparent',
                color: diningModeActive ? 'white' : '#aaa',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.2s'
              }}
            >
              🍽️ {t('dining_mode')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
           {/* Language Switcher */}
           <button 
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: '1px solid #555',
              padding: '6px 12px',
              color: 'white',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <Globe size={16} />
            {i18n.language.toUpperCase()}
          </button>
        </div>
      </header>

      <div className="content-wrapper">
        <div className="main-section">
          {/* Table Serving Header - Now supports switching without data loss */}
          {selectedTable && diningModeActive && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '20px', 
              padding: '15px', 
              background: '#e3f2fd', 
              borderRadius: '8px', 
              border: '1px solid #90caf9',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1565c0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📍 {t('table')}: {selectedTable}
              </span>
              <button 
                onClick={() => setSelectedTable(null)} 
                style={{ 
                  padding: '8px 15px', 
                  background: 'white', 
                  border: '1px solid #1565c0', 
                  color: '#1565c0',
                  borderRadius: '6px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🔄 {t('select_table')}
              </button>
            </div>
          )}

          <ProductGrid key={refreshKey} onAddToCart={addToCart} branchId={currentBranchId} />
        </div>

        <div className="sidebar-section">
          <CartSidebar
            cartItems={cart}
            onCheckout={handleInitiateCheckout}
            onRemoveFromCart={removeFromCart}
            discountPercentage={discountPercentage}
            onSetDiscount={setDiscountPercentage}
            onSendToKitchen={handleSendToKitchen} 
            isDiningMode={diningModeActive} // Pass dining mode to sidebar
            t={t} // Pass translate function
          />
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          subtotal={
            cart.reduce((sum, item) => sum + item.price * item.quantity, 0) *
            (1 - discountPercentage / 100)
          }
          onConfirm={handleConfirmPayment}
          onCancel={() => setShowPayment(false)}
        />
      )}

      {showReceipt && lastOrder && (
        <ReceiptModal
          orderId={lastOrder.id}
          subtotal={lastOrder.subtotal}
          discount={lastOrder.discount}
          tip={lastOrder.tip}
          total={lastOrder.total}
          paymentMethod={lastOrder.method}
          items={lastOrder.items}
          onClose={() => {
            setShowReceipt(false);
            // Trigger refresh to update stock counts in ProductGrid
            setRefreshKey((prev) => prev + 1);
            // New logic: Only redirect to table plan after receipt is closed
            setSelectedTable(null); 
          }}
        />
      )}

      {/* --- NEW: Order Ready Notification Popup --- */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          background: '#2e7d32',
          color: 'white',
          padding: '15px 25px',
          borderRadius: '10px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontWeight: 'bold',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <span>{notification}</span>
          <button 
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}