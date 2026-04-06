import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ShoppingCart, User, X, ShoppingBag, WifiOff, PauseCircle, PlayCircle, Clock, Star, History, StickyNote, PlusCircle } from 'lucide-react';
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { saveOfflineOrder, saveOfflineKitchenTicket } from './utils/offlineDb'
import { supabase } from './supabaseClient';
import ProductGrid from './components/ProductGrid';
import CartSidebar from './components/CartSidebar';
import ReceiptModal from './components/ReceiptModal';
import PaymentModal from './components/PaymentModal';
import TableSelection from './components/TableSelection'; 
import StaffClockInModal from './components/StaffClockInModal';
import OrderHistoryDrawer from './components/OrderHistoryDrawerEntry';
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
  note?: string;
}

// Held/Parked order interface
export interface HeldOrder {
  id: string;
  label: string;
  items: CartItem[];
  discountPercentage: number;
  orderType: string;
  orderNote: string;
  heldAt: string;
}

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

interface RootProps {
  userRole: string;
}

export default function Root({ userRole }: RootProps) {
  const { t, i18n } = useTranslation(); // Hook for translations
  const isOnline = useNetworkStatus();

  // --- State Management ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null); // NEW: Track pending order ID
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // --- Table Management States ---
  const [diningModeActive, setDiningModeActive] = useState(false); 
  const [selectedTable, setSelectedTable] = useState<string | null>(null); 
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null); // NEW: Multi-Tenant Branch ID
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false); // NEW: Responsive Mobile Cart Toggle
  const [taxRate, setTaxRate] = useState(0); // NEW: Tax Rate for Calculation

  const [showClockIn, setShowClockIn] = useState(false);

  // --- Notification State ---
  const [notification, setNotification] = useState<string | null>(null);

  // --- Feature 1: Order Notes ---
  const [orderNote, setOrderNote] = useState('');

  // --- Feature 2: Hold/Park Orders ---
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldOrders, setShowHeldOrders] = useState(false);

  // --- Feature 5: Order Type ---
  const [orderType, setOrderType] = useState<OrderType>('dine_in');

  // --- Feature 8: Reprint Last Receipt ---
  const [canReprintLast, setCanReprintLast] = useState(false);

  // --- Feature 13: Daily Sales Widget ---
  const [dailySalesTotal, setDailySalesTotal] = useState(0);
  const [dailyOrderCount, setDailyOrderCount] = useState(0);

  // --- Feature 15: Order History Drawer ---
  const [showOrderHistory, setShowOrderHistory] = useState(false);

  // --- Feature 7: Open/Custom Item ---
  const [showOpenItem, setShowOpenItem] = useState(false);
  const [openItemName, setOpenItemName] = useState('');
  const [openItemPrice, setOpenItemPrice] = useState('');


  // --- 1. Load Settings and Persistent Cart ---
  useEffect(() => {
    fetchDiningMode();
    fetchBranchContext();
    fetchDailySales();
    loadHeldOrders();
  }, []);

  // --- NEW: Multi-Tenant Context Loader ---
  const fetchBranchContext = async () => {
    // For now, we just grab the first branch available. 
    // In a real multi-unit setup, this would be a selection screen or stored in localStorage.
    const { data: branches } = await supabase.from('branches').select('id, name').limit(1);
    const branch = branches?.[0];
    if (branch) {
      setCurrentBranchId(branch.id);
      console.log("Active Branch:", branch.name);
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
    // 1. Fetch Dining Mode
    const { data: dining } = await supabase.from('settings').select('value').eq('key', 'dining_mode').single(); 
    if (dining) setDiningModeActive(dining.value);

    // 2. Fetch Tax Rate (FIX: Phantom Tax Rate Bug)
    const { data: tax } = await supabase.from('settings').select('value').eq('key', 'tax_rate').single();
    if (tax) setTaxRate(Number(tax.value) || 0);
  };

  const loadTableCart = async () => {
    if (!selectedTable) return;
    const { data } = await supabase
      .from('table_cart_items')
      .select('*')
      .eq('table_number', selectedTable)
      .eq('branch_id', currentBranchId); // Filter by Branch!
    
    if (data) {
      setCart(data.map(item => ({
        id: item.variant_id,
        name: item.product_name,
        price: item.price_at_addition,
        quantity: item.quantity,
        status: item.status,
        modifiers: item.modifiers || [],
        note: item.note || ''
      })));
    }
  };

  // --- Feature 13: Daily Sales Widget ---
  const fetchDailySales = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, count } = await supabase
      .from('orders')
      .select('total_amount', { count: 'exact' })
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .neq('status', 'VOIDED');
    if (data) {
      setDailySalesTotal(data.reduce((sum, o) => sum + (o.total_amount || 0), 0));
      setDailyOrderCount(count || 0);
    }
  };

  // --- Feature 2: Hold/Park Order ---
  const loadHeldOrders = () => {
    try {
      const saved = localStorage.getItem('opentill_held_orders');
      if (saved) setHeldOrders(JSON.parse(saved));
    } catch { /* noop */ }
  };

  const holdCurrentOrder = () => {
    if (cart.length === 0) return alert(t('empty_cart'));
    const held: HeldOrder = {
      id: crypto.randomUUID(),
      label: selectedTable ? `Table ${selectedTable}` : `Order #${heldOrders.length + 1}`,
      items: [...cart],
      discountPercentage,
      orderType,
      orderNote,
      heldAt: new Date().toISOString(),
    };
    const updated = [...heldOrders, held];
    setHeldOrders(updated);
    localStorage.setItem('opentill_held_orders', JSON.stringify(updated));
    setCart([]);
    setDiscountPercentage(0);
    setOrderNote('');
    setNotification(t('order_held'));
    setTimeout(() => setNotification(null), 3000);
  };

  const recallHeldOrder = (id: string) => {
    const order = heldOrders.find(o => o.id === id);
    if (!order) return;
    if (cart.length > 0 && !confirm(t('recall_confirm'))) return;
    setCart(order.items);
    setDiscountPercentage(order.discountPercentage);
    setOrderType(order.orderType as OrderType);
    setOrderNote(order.orderNote);
    const updated = heldOrders.filter(o => o.id !== id);
    setHeldOrders(updated);
    localStorage.setItem('opentill_held_orders', JSON.stringify(updated));
    setShowHeldOrders(false);
  };

  const deleteHeldOrder = (id: string) => {
    const updated = heldOrders.filter(o => o.id !== id);
    setHeldOrders(updated);
    localStorage.setItem('opentill_held_orders', JSON.stringify(updated));
  };

  // --- Feature 7: Open/Custom Item ---
  const addOpenItem = () => {
    const price = Math.round(parseFloat(openItemPrice) * 100);
    if (!openItemName || isNaN(price) || price <= 0) return alert('Enter valid name and price');
    const item: CartItem = {
      id: `open-${crypto.randomUUID()}`,
      name: openItemName,
      price,
      quantity: 1,
      modifiers: [],
      note: '',
    };
    setCart(prev => [...prev, item]);
    setOpenItemName('');
    setOpenItemPrice('');
    setShowOpenItem(false);
  };

  // --- Feature 1: Update Item Note ---
  const updateItemNote = async (itemId: string, itemName: string, note: string) => {
    setCart(prev => prev.map(item =>
      item.id === itemId && item.name === itemName ? { ...item, note } : item
    ));

    if (diningModeActive && selectedTable) {
      await supabase
        .from('table_cart_items')
        .update({ note })
        .eq('table_number', selectedTable)
        .eq('branch_id', currentBranchId)
        .eq('variant_id', itemId)
        .eq('product_name', itemName)
        .eq('status', 'DRAFT');
    }
  };

  // --- Feature 3: Quantity Adjustment ---
  const incrementCartItem = async (variantId: string, productName?: string) => {
    if (diningModeActive && selectedTable) {
      const { data: existing } = await supabase
        .from('table_cart_items')
        .select('*')
        .eq('table_number', selectedTable)
        .eq('branch_id', currentBranchId)
        .eq('variant_id', variantId)
        .eq('product_name', productName || '')
        .eq('status', 'DRAFT')
        .single();
      if (existing) {
        await supabase.from('table_cart_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
      }
      loadTableCart();
    } else {
      setCart(prev => prev.map(item =>
        item.id === variantId && (productName ? item.name === productName : true)
          ? { ...item, quantity: item.quantity + 1 } : item
      ));
    }
  };

  // --- 2. Add to Cart Logic (Saves to Database) ---
  const addToCart = async (variant: any) => {
    // If Dining Mode is active, items MUST be linked to a table
    if (diningModeActive && !selectedTable) return;

    if (variant.track_stock) {
      // Logic for stock check... 
      // 1. Get quantity in CURRENT cart
      const currentQty = cart.filter(i => i.id === variant.id).reduce((sum, i) => sum + i.quantity, 0);
      
      // 2. NEW: Get quantity in OTHER active tables (prevent Overbooking)
      // FIX: Ensure we only check THIS branch
      const { data: globalDrafts } = await supabase
        .from('table_cart_items')
        .select('quantity')
        .eq('variant_id', variant.id)
        .eq('branch_id', currentBranchId); // Filter by Branch!
      
      const globalQty = globalDrafts ? globalDrafts.reduce((acc, row) => acc + row.quantity, 0) : 0;
      
      if ((currentQty + globalQty) >= variant.stock_quantity) {
        return alert(`Sorry, only ${variant.stock_quantity} left in stock! (Currently held in other carts)`);
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
        .eq('branch_id', currentBranchId)
        .single();

      if (existing) {
        await supabase.from('table_cart_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
      } else {
        await supabase.from('table_cart_items').insert({
          branch_id: currentBranchId,
          table_number: selectedTable,
          variant_id: variant.id,
          product_name: fullName,
          price_at_addition: variant.price,
          quantity: 1,
          status: 'DRAFT',
          modifiers: modifiers,
          note: ''
        });
        
        await supabase
          .from('dining_tables')
          .update({ status: 'OCCUPIED' })
          .eq('table_number', selectedTable)
          .eq('branch_id', currentBranchId);
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
        .eq('branch_id', currentBranchId)
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
          const { data: remaining } = await supabase.from('table_cart_items').select('id').eq('table_number', selectedTable).eq('branch_id', currentBranchId);;
          if (!remaining || remaining.length === 0) {
             await supabase.from('dining_tables').update({ status: 'AVAILABLE' }).eq('table_number', selectedTable).eq('branch_id', currentBranchId);
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
      .eq('status', 'DRAFT')
      .eq('branch_id', currentBranchId); // Filter by Branch!

    if (!draftItems || draftItems.length === 0) return alert("No new items to send.");

    // 2. Check for active ticket to merge
    const { data: activeTicket } = await supabase
      .from('kitchen_tickets')
      .select('*')
      .eq('table_number', selectedTable)
      .eq('status', 'PENDING')
      .eq('branch_id', currentBranchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (activeTicket) {
      const mergedItems = [
        ...activeTicket.items,
        ...draftItems.map(i => ({
          name: i.product_name,
          qty: i.quantity,
          status: 'PENDING',
          note: i.note || ''
        }))
      ];
      await supabase.from('kitchen_tickets').update({ items: mergedItems }).eq('id', activeTicket.id);
    } else {
      // Create new ticket record
      const { error: ticketError } = await supabase.from('kitchen_tickets').insert({
        branch_id: currentBranchId,
        table_number: selectedTable,
        items: draftItems.map(i => ({
          name: i.product_name,
          qty: i.quantity,
          status: 'PENDING',
          note: i.note || ''
        })),
        status: 'PENDING'
      });
      if (ticketError) return alert("Kitchen Routing Failed: " + ticketError.message);
    }

    // 3. Update those items to SENT status so they aren't sent again
    await supabase
      .from('table_cart_items')
      .update({ status: 'SENT' })
      .eq('table_number', selectedTable)
      .eq('status', 'DRAFT')
      .eq('branch_id', currentBranchId); // Filter by Branch!

    loadTableCart();
    alert("Kitchen order updated!");
  };

  // --- 4. Checkout Initiation ---
  const handleInitiateCheckout = () => {
    if (cart.length === 0) return alert("Cart is empty!");
    setShowPayment(true);
  };

  // --- 5. Confirm Payment & Clear Table Persistence ---
  
  // NEW: Create Pending Order for Split Bill
  const handleCreatePendingOrder = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = Math.round(subtotal * (discountPercentage / 100));
    
    // Calculate Tax
    const totalTax = cart.reduce((sum, item) => {
        const tax = (item.price * item.quantity) * (taxRate / 100);
        return sum + tax;
    }, 0);

    const totalAmount = Math.round(subtotal - discountAmount + totalTax); 
    
    const payload = {
      branchId: currentBranchId,
      userId: user?.id,
      totalAmount: totalAmount,
      paymentMethod: 'PENDING',
      tableNumber: selectedTable, 
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        modifiers: item.modifiers || []
      })),
      skipKds: !!selectedTable
    };
    
    const { data, error } = await supabase.rpc('sell_items', { order_payload: payload });
    if (error) {
      alert("Error initializing split order: " + error.message);
      return null;
    }
    return data.order_id;
  };

  const handleConfirmPayment = async (method: string, tipAmount: number, customerId?: string) => {
    setShowPayment(false);
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = Math.round(subtotal * (discountPercentage / 100));
    const totalTax = cart.reduce((sum, item) => {
        // Find product tax rate if available, else use global taxRate
        // Assuming item doesn't carry tax info, we use global taxRate
        const tax = (item.price * item.quantity) * (taxRate / 100);
        return sum + tax;
    }, 0);

    const totalAmount = Math.round(subtotal - discountAmount + totalTax + tipAmount);

    // --- OFFLINE CHECK ---
    if (!isOnline) {
      if (method.startsWith('GIFT_CARD:')) {
        alert("Gift Cards require internet connection");
        return;
      }

      const offlinePayload = {
        branchId: currentBranchId,
        totalAmount: totalAmount,
        paymentMethod: method,
        customerId: customerId,
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          modifiers: item.modifiers || []
        })),
        created_at: new Date().toISOString()
      };

      try {
        await saveOfflineOrder(offlinePayload);
        
        // KDS OFFLINE LOGIC
        await saveOfflineKitchenTicket({
            table_number: selectedTable || 'Takeaway',
            items: cart.map(i => ({ 
                name: i.name, 
                qty: i.quantity, 
                status: 'PENDING',
                modifiers: i.modifiers // Optional: Include modifiers for kitchen
            })),
            status: 'PENDING',
            created_at: new Date().toISOString(),
            is_offline: true
        } as any);

        setCart([]);
        if (selectedTable) localStorage.removeItem(`order_${selectedTable}`);
        alert("Order saved offline. Will sync when online.");
      } catch (err) {
        console.error("Offline Save Error", err);
        alert("Failed to save order offline.");
      }
      return;
    }

    // --- GIFT CARD LOGIC START ---
    let giftCardCode = "";
    if (method.startsWith('GIFT_CARD:')) {
        giftCardCode = method.split(':')[1] || '';
        // 1. Process Payment First (Secure Funds)
        const { error: gcError } = await supabase.rpc('process_gift_card_payment', {
            card_code_input: giftCardCode,
            amount_input: totalAmount / 100, // Convert cents to dollars/unit
            order_id_input: 'PENDING'
        });

        if (gcError) {
            alert("Gift Card Payment Failed: " + gcError.message);
            return;
        }
    }
    // --- GIFT CARD LOGIC END ---

    // Generate User Context
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      branchId: currentBranchId,
      userId: user?.id,
      totalAmount: totalAmount,
      paymentMethod: method.startsWith('GIFT_CARD') ? 'GIFT_CARD' : method,
      orderType: orderType,
      orderNote: orderNote,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        modifiers: item.modifiers || [],
        note: item.note || ''
      })),
      skipKds: !!selectedTable
    };

    const { data, error } = await supabase.rpc('sell_items', { order_payload: payload });

    if (error) {
      alert("Transaction Failed!");
      // TODO: Logic to refund Gift Card if order creation fails
    } else {
      // HANDLE LOYALTY update
      if (customerId && data?.order_id) {
         // Link order to customer
         await supabase.from('orders').update({ customer_id: customerId }).eq('id', data.order_id);
         
         // Calculate points (e.g. 1 point per $1/£1 spent)
         // totalAmount is in cents, so divide by 100
         const pointsEarned = Math.floor(totalAmount / 100);
         
         // Update customer stats
         // We use an RPC or raw query ideally to be atomic, but read-update-write is okay for now
         const { data: cust } = await supabase.from('customers').select('loyalty_points, total_spend').eq('id', customerId).single();
         if (cust) {
            await supabase.from('customers').update({
                loyalty_points: (cust.loyalty_points || 0) + pointsEarned,
                total_spend: (cust.total_spend || 0) + totalAmount,
                last_visit: new Date().toISOString()
            }).eq('id', customerId);
         }
      }

      // DEDUCT INGREDIENTS - NOW HANDLED BY RPC 'sell_items'
      // const ingredientItems = cart.map(item => ({ variant_id: item.id, quantity: item.quantity }));
      // deductIngredients(ingredientItems);

      // IF DINING MODE: Clear the saved items and reset table status to AVAILABLE
      if (selectedTable) {
        await supabase.from('table_cart_items').delete().eq('table_number', selectedTable).eq('branch_id', currentBranchId);
        await supabase.from('dining_tables').update({ status: 'AVAILABLE' }).eq('table_number', selectedTable).eq('branch_id', currentBranchId);
      }

      setLastOrder({
        id: data.order_id,
        subtotal: subtotal,
        discount: discountAmount,
        tip: tipAmount,
        total: totalAmount,
        items: [...cart],
        method: method,
        orderType: orderType,
        orderNote: orderNote,
      });

      setCart([]);
      setDiscountPercentage(0);
      setOrderNote('');
      setCanReprintLast(true);
      fetchDailySales();
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
            {/* Feature 13: Daily Sales Widget */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(46,125,50,0.3)', padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: '#81c784' }}>{dailyOrderCount} orders</span>
              <span style={{ color: '#a5d6a7', fontWeight: 'bold' }}>${(dailySalesTotal / 100).toFixed(2)}</span>
            </div>

            {/* Feature 2: Hold/Park Order */}
            <button
              onClick={holdCurrentOrder}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.1)', border: 'none', padding: '6px 10px', color: '#ffb74d', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
            >
              <PauseCircle size={16} />
              {t('hold')}
            </button>

            {heldOrders.length > 0 && (
              <button
                onClick={() => setShowHeldOrders(!showHeldOrders)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ff9800', border: 'none', padding: '6px 10px', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', position: 'relative' }}
              >
                <PlayCircle size={16} />
                {t('recall')} ({heldOrders.length})
              </button>
            )}

            {/* Feature 15: Order History */}
            <button
              onClick={() => setShowOrderHistory(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.1)', border: 'none', padding: '6px 10px', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              <History size={16} />
            </button>

            {/* Feature 8: Reprint last receipt */}
            {canReprintLast && lastOrder && (
              <button
                onClick={() => setShowReceipt(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.1)', border: 'none', padding: '6px 10px', color: '#90caf9', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                🖨️ {t('reprint')}
              </button>
            )}

            {/* Staff Clock In */}
            <button 
              onClick={() => setShowClockIn(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', border: 'none', padding: '6px 12px', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
            >
              <User size={16} />
              {t('clock_in')}
            </button>

           {/* Language Switcher */}
           <button 
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #555', padding: '6px 12px', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
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

          {/* Feature 5: Order Type & Feature 7: Open Item */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', background: '#f5f5f5', padding: '3px', borderRadius: '8px' }}>
              {(['dine_in', 'takeaway', 'delivery'] as OrderType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  style={{
                    padding: '6px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem',
                    background: orderType === type ? '#1a1a1a' : 'transparent',
                    color: orderType === type ? '#fff' : '#666',
                    transition: 'all 0.2s'
                  }}
                >
                  {type === 'dine_in' ? '🍽️' : type === 'takeaway' ? '🥡' : '🚚'} {t(type)}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowOpenItem(!showOpenItem)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px dashed #aaa', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: '#555' }}
            >
              <PlusCircle size={14} />
              {t('open_item')}
            </button>
          </div>

          {/* Feature 7: Open Item Form */}
          {showOpenItem && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', padding: '12px', background: '#fff8e1', borderRadius: '8px', border: '1px solid #ffe082', alignItems: 'center' }}>
              <input placeholder={t('item_name')} value={openItemName} onChange={e => setOpenItemName(e.target.value)} style={{ flex: 2, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <input type="number" step="0.01" placeholder={t('price')} value={openItemPrice} onChange={e => setOpenItemPrice(e.target.value)} style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <button onClick={addOpenItem} style={{ padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ {t('add_item')}</button>
            </div>
          )}

          <ProductGrid key={refreshKey} onAddToCart={addToCart} branchId={currentBranchId} />
        </div>

        {!isMobileCartOpen && (
          <div 
            className="mobile-cart-toggle" 
            onClick={() => setIsMobileCartOpen(!isMobileCartOpen)}
          >
            <ShoppingBag size={24} />
            <div className="badge">{cart.reduce((sum, i) => sum + i.quantity, 0)}</div>
          </div>
        )}

        {isMobileCartOpen && (
          <div className="mobile-backdrop" onClick={() => setIsMobileCartOpen(false)}></div>
        )}

        <div className={`sidebar-section ${isMobileCartOpen ? 'open' : ''}`}>
          <div className="mobile-cart-header">
            <h3>Current Order</h3>
            <button onClick={() => setIsMobileCartOpen(false)}>×</button>
          </div>
          <CartSidebar
            cartItems={cart}
            onCheckout={() => {
              setShowPayment(true);
              setIsMobileCartOpen(false);
            }}
            onRemoveFromCart={removeFromCart}
            onIncrementItem={incrementCartItem}
            onUpdateItemNote={updateItemNote}
            discountPercentage={discountPercentage}
            onSetDiscount={setDiscountPercentage}
            onSendToKitchen={handleSendToKitchen} 
            isDiningMode={diningModeActive} 
            t={t} 
            taxRate={taxRate}
            orderNote={orderNote}
            onSetOrderNote={setOrderNote}
            orderType={orderType}
          />
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          subtotal={
            cart.reduce((sum, item) => sum + item.price * item.quantity, 0) *
            (1 - discountPercentage / 100)
          }
          onCreatePendingOrder={handleCreatePendingOrder}
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
          orderNote={lastOrder.orderNote}
          orderType={lastOrder.orderType}
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

      {/* Staff Clock In Overlay */}
      {showClockIn && <StaffClockInModal onClose={() => setShowClockIn(false)} />}

      {/* Feature 2: Held Orders Popup */}
      {showHeldOrders && (
        <div className="modal-overlay" onClick={() => setShowHeldOrders(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>⏸️ {t('held_orders')}</h2>
              <button onClick={() => setShowHeldOrders(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            {heldOrders.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '30px' }}>{t('no_held_orders')}</p>
            ) : (
              heldOrders.map(order => (
                <div key={order.id} style={{ padding: '12px', marginBottom: '10px', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{order.label}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>{order.items.length} items - {new Date(order.heldAt).toLocaleTimeString()}</div>
                    <div style={{ fontSize: '0.75rem', color: '#aaa' }}>${(order.items.reduce((s, i) => s + i.price * i.quantity, 0) / 100).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => recallHeldOrder(order.id)} style={{ padding: '8px 14px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{t('recall')}</button>
                    <button onClick={() => deleteHeldOrder(order.id)} style={{ padding: '8px 14px', background: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Feature 15: Order History Drawer */}
      {showOrderHistory && <OrderHistoryDrawer onClose={() => setShowOrderHistory(false)} branchId={currentBranchId} />}
    </div>
  );
}