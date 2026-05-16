import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient'; // Adjusted import path assuming typical structure
// If supabaseClient is in src/, need ../supabaseClient

interface Props {
  subtotal: number // Post-discount, post-tax total in cents
  taxAmount?: number // Tax portion in cents, for display
  onCreatePendingOrder?: () => Promise<string | null> // New Prop
  onConfirm: (method: string, tipAmount: number, customerId?: string) => void
  onCancel: () => void
}

export default function PaymentModal({ subtotal, taxAmount = 0, onCreatePendingOrder, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const [tip, setTip] = useState(0)
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitOrderId, setSplitOrderId] = useState<string | null>(null);
  const [splitPayments, setSplitPayments] = useState<{amount: number, method: string, id: string}[]>([]);
  const [splitMethod, setSplitMethod] = useState('CASH');
  const [splitAmountInput, setSplitAmountInput] = useState('');
  
  // CUSTOMER LOYALTY STATE
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [crmActive, setCrmActive] = useState(false)

  // GIFT CARD STATE
  const [giftCardCode, setGiftCardCode] = useState('');
  const [gcBalance, setGcBalance] = useState<number | null>(null);
  const [gcError, setGcError] = useState('');

  // Feature 4: Cash Tendered & Change
  const [showCashTendered, setShowCashTendered] = useState(false);
  const [cashTendered, setCashTendered] = useState('');
  const cashTenderedNum = parseFloat(cashTendered) || 0;

  useEffect(() => {
    checkCrmStatus()
  }, [])

  useEffect(() => {
    if (crmActive && customerSearch.length > 2) {
      searchCustomers()
    } else {
      setCustomers([])
    }
  }, [customerSearch, crmActive])

  const checkCrmStatus = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'crm_enabled').single()
    if (data?.value === 'true') setCrmActive(true)
  }

  const searchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, loyalty_points')
      .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`)
      .limit(5)
    setCustomers(data || [])
  }

  // Helper: Calculate % based on the subtotal
  const addTipPercent = (pct: number) => {
    setTip(Math.round(subtotal * (pct / 100)))
  }

  const finalTotal = subtotal + tip
  const changeAmount = cashTenderedNum - (finalTotal / 100);

  const checkGiftCardBalance = async () => {
    setGcError('');
    setGcBalance(null);
    if(!giftCardCode) return;
    
    // Check local supabase schema for gift_cards
    const { data, error } = await supabase.from('gift_cards').select('balance, status').eq('code', giftCardCode).single();
    
    if (error || !data) {
        setGcError("Invalid Code");
    } else if (data.status !== 'ACTIVE') {
        setGcError(`Card is ${data.status}`);
    } else {
        setGcBalance(data.balance);
    }
  }

  // --- SPLIT BILL LOGIC ---
  const totalPaid = splitPayments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = finalTotal - totalPaid;

  const handleAddSplitPayment = async () => {
    const amt = Math.round(parseFloat(splitAmountInput) * 100);
    if (isNaN(amt) || amt <= 0) return alert("Invalid amount");

    // 1. Ensure Order Exists
    let oid = splitOrderId;
    if (!oid) {
      if (!onCreatePendingOrder) return alert("Split billing not supported in this context.");
      // Create Order
      // Wait, createPendingOrder only deals with CART ITEMS.
      // If we add tip, we assume tip is paid at end or distributed?
      // Logic: Order Total = Product Total. Payments cover Order Total + Tip?
      // Actually, standard POS: Total = Subtotal + Tip.
      // Our createPendingOrder creates order with Order Total = Subtotal (no tip).
      // So payments must cover specific amount.
      // If tip is added in Modal, it increases 'finalTotal'.
      // If payments >= finalTotal, we good.
      // The excess is Tip.
      // But RPC 'add_payment' checks against Order Total.
      // If Order Total in DB is $100, and we pay $110 (10 tip), status becomes COMPLETED.
      
      oid = await onCreatePendingOrder();
      if (!oid) return;
      setSplitOrderId(oid);
    }

    // 2. Add Payment via RPC
    const { data: payData, error } = await supabase.rpc('add_payment', {
      p_order_id: oid,
      p_amount: amt,
      p_method: splitMethod
    });

    if (error || !payData?.success) {
      alert("Payment Failed: " + (error?.message || payData?.message));
      return;
    }

    // 3. Update State
    setSplitPayments([...splitPayments, { amount: amt, method: splitMethod, id: crypto.randomUUID() }]);
    setSplitAmountInput('');

    // 4. Check Completion Local vs Remote
    // The RPC returns status and remaining.
    // If we added Tip locally, 'finalTotal' includes Tip. The DB order total does NOT include tip usually unless updated.
    // So 'remaining' from RPC might be 0 (order paid), but we still owe Tip locally?
    // Let's rely on local math for UX: "Remaining: $X".
    
    if ((totalPaid + amt) >= finalTotal) {
        setTimeout(() => {
           alert("Order Fully Paid!");
           onConfirm('SPLIT', tip, selectedCustomer?.id);
        }, 500);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '450px', width: '90%', textAlign: 'center' }}> 
        <div className="modal-header" style={{ justifyContent: 'center', borderBottom: 'none', marginBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>{t('finalize_payment')}</h2>
        </div>
        
        {/* --- CUSTOMER LOYALTY SECTION --- */}
        {crmActive && (
          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: 'var(--text-secondary)' }}>👤 Customer (Loyalty)</p>
            {selectedCustomer ? (
              <div style={{ background: '#e3f2fd', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #90caf9' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1565c0' }}>{selectedCustomer.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#555' }}>Points: {selectedCustomer.loyalty_points}</div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input 
                  placeholder="Search by Name or Phone..." 
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                />
                {customers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: '6px', zIndex: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    {customers.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomers([]); }}
                        className="customer-search-result"
                        style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}
                      >
                        <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{c.phone} • {c.loyalty_points} pts</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TIP SECTION --- */}
        <div style={{ background: 'var(--bg-primary)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{t('add_gratuity')}</p>
          
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '10px' }}>
            <button onClick={() => setTip(0)} style={btnStyle(tip === 0)}>{t('no_tip')}</button>
            <button onClick={() => addTipPercent(10)} style={btnStyle(false)}>10%</button>
            <button onClick={() => addTipPercent(15)} style={btnStyle(false)}>15%</button>
            <button onClick={() => addTipPercent(20)} style={btnStyle(false)}>20%</button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <label style={{ fontSize: '0.9rem' }}>{t('custom_amount')}: $</label>
            <input 
              type="number" 
              value={(tip / 100).toFixed(2)} 
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                setTip(isNaN(val) ? 0 : Math.round(val * 100))
              }}
              style={{ 
                width: '80px', padding: '5px', textAlign: 'center', fontSize: '1rem',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)'
              }}
            />
          </div>
        </div>

        {/* --- GIFT CARD SECTION --- */}
        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ddd' }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#555', fontSize: '0.9rem' }}>🎁 Pay with Gift Card</p>
            <div style={{ display: 'flex', gap: '5px' }}>
                <input 
                    placeholder="Enter Code or ID" 
                    value={giftCardCode}
                    onChange={e => setGiftCardCode(e.target.value)}
                    style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                <button onClick={checkGiftCardBalance} style={{ padding: '8px 12px', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Check</button>
            </div>
            {gcError && <div style={{ color: 'red', fontSize: '0.8rem', marginTop: '5px' }}>{gcError}</div>}
            {gcBalance !== null && (
                <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span>Balance: ${gcBalance.toFixed(2)}</span>
                        <span style={{ color: gcBalance >= (finalTotal/100) ? 'green' : 'red' }}>
                            {gcBalance >= (finalTotal/100) ? 'Sufficient' : 'Insufficient'}
                        </span>
                    </div>
                    {gcBalance >= (finalTotal/100) && (
                        <button 
                            onClick={() => onConfirm('GIFT_CARD:' + giftCardCode, tip, selectedCustomer?.id)} 
                            style={{ 
                                width: '100%', marginTop: '10px', padding: '10px', 
                                background: '#7b1fa2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' 
                            }}
                        >
                            Complete Payment with Gift Card
                        </button>
                    )}
                </div>
            )}
        </div>

        {/* --- TOTALS --- */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
            <span>{t('bill_amount')}:</span>
            <span>${((subtotal - taxAmount) / 100).toFixed(2)}</span>
          </div>
          {taxAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
              <span>{t('tax')}:</span>
              <span>${(taxAmount / 100).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', color: 'var(--success-color)', fontWeight: 'bold' }}>
            <span>+ {t('tip')}:</span>
            <span>${(tip / 100).toFixed(2)}</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', margin: '10px 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2rem', fontWeight: 'bold' }}>
            <span>{t('total')}:</span>
            <span>${(finalTotal / 100).toFixed(2)}</span>
          </div>
          
          {/* Remaining Balance for Split Logic */}
          {isSplitMode && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', color: '#d32f2f', fontWeight: 'bold', marginTop: '10px' }}>
               <span>Remaining:</span>
               <span>${((finalTotal - totalPaid) / 100).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* --- SPLIT BILL UI --- */}
        {isSplitMode ? (
          <div style={{ marginBottom: '20px', textAlign: 'left', background: '#fff3e0', padding: '15px', borderRadius: '8px', border: '1px solid #ffb74d' }}>
             <h3 style={{ marginTop: 0, color: '#e65100' }}>Split Payment</h3>
             
             {/* List Previous Payments */}
             {splitPayments.map((p, idx) => (
               <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #ffe0b2' }}>
                 <span>{p.method}</span>
                 <span>${(p.amount / 100).toFixed(2)}</span>
               </div>
             ))}

             {/* Add New Payment */}
             <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select value={splitMethod} onChange={e => setSplitMethod(e.target.value)} style={{ padding: '8px', borderRadius: '4px' }}>
                   <option value="CASH">Cash</option>
                   <option value="CARD">Card</option>
                   <option value="GIFT_CARD">Gift Card</option>
                </select>
                <input 
                  type="number" 
                  placeholder="Amount" 
                  value={splitAmountInput}
                  onChange={e => setSplitAmountInput(e.target.value)}
                  style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <button onClick={handleAddSplitPayment} style={{ background: '#e65100', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>
                   Add
                </button>
             </div>
             
             <button onClick={() => setIsSplitMode(false)} style={{ marginTop: '10px', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: '#e65100' }}>
               Back to Standard Payment
             </button>
          </div>
        ) : showCashTendered ? (
          /* Feature 4: Cash Tendered & Change Calculator */
          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '8px', border: '1px solid #a5d6a7', marginBottom: '10px' }}>
              <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#2e7d32' }}>💵 {t('cash_tendered')}</p>
              
              {/* Feature 6: Quick Cash Denomination Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
                {[5, 10, 20, 50, 100, Math.ceil(finalTotal / 100)].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setCashTendered(String(amt))}
                    style={{ padding: '10px', border: '1px solid #c8e6c9', borderRadius: '6px', background: cashTendered === String(amt) ? '#2e7d32' : '#fff', color: cashTendered === String(amt) ? '#fff' : '#333', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem' }}>$</span>
                <input 
                  type="number" 
                  value={cashTendered} 
                  onChange={e => setCashTendered(e.target.value)}
                  style={{ flex: 1, padding: '12px', fontSize: '1.5rem', textAlign: 'center', border: '2px solid #a5d6a7', borderRadius: '6px' }}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              
              {cashTenderedNum > 0 && (
                <div style={{ marginTop: '12px', padding: '10px', borderRadius: '6px', background: changeAmount >= 0 ? '#c8e6c9' : '#ffcdd2', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#555' }}>{t('change_due')}</div>
                  <div style={{ fontSize: '2rem', fontWeight: '900', color: changeAmount >= 0 ? '#1b5e20' : '#c62828' }}>
                    ${changeAmount >= 0 ? changeAmount.toFixed(2) : 'Insufficient'}
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => { if (changeAmount >= 0) onConfirm('CASH', tip, selectedCustomer?.id); }}
              disabled={changeAmount < 0}
              style={{ ...payBtnStyle('#2e7d32'), width: '100%', opacity: changeAmount < 0 ? 0.5 : 1 }}
            >
              💵 {t('confirm_cash')} (${(finalTotal / 100).toFixed(2)})
            </button>
            <button onClick={() => setShowCashTendered(false)} style={{ marginTop: '8px', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: '#666', width: '100%' }}>
              ← {t('back')}
            </button>
          </div>
        ) : (
          <>
            {/* --- CONFIRM BUTTONS --- */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <button onClick={() => setShowCashTendered(true)} style={payBtnStyle('var(--success-color, #2e7d32)')}>💵 {t('cash')}</button>
              <button onClick={() => onConfirm('CARD', tip, selectedCustomer?.id)} style={payBtnStyle('var(--primary-color, #1565c0)')}>💳 {t('card')}</button>
            </div>
            
            {/* Feature 16: Customer Tab */}
            <button 
               onClick={() => {
                 if (!selectedCustomer) return alert(t('select_customer_first'));
                 onConfirm('TAB', tip, selectedCustomer?.id);
               }}
               style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#7b1fa2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
               📋 {t('add_to_tab')}
            </button>
            
            <button 
               onClick={() => setIsSplitMode(true)} 
               style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
               ➗ {t('split_bill')}
            </button>
          </>
        )}

        <button onClick={onCancel} style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}

const btnStyle = (isActive: boolean) => ({
  flex: 1, padding: '10px', cursor: 'pointer',
  background: isActive ? 'var(--text-primary)' : 'var(--bg-secondary)',
  color: isActive ? 'var(--bg-primary)' : 'var(--text-primary)',
  border: '1px solid var(--border-color)', borderRadius: '4px', fontWeight: 'bold' as const
})

const payBtnStyle = (color: string): React.CSSProperties => ({
  flex: 1, padding: '15px', fontSize: '1.2rem', fontWeight: 'bold',
  background: color, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'
})