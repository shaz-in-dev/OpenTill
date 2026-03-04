import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient'; // Adjusted import path assuming typical structure
// If supabaseClient is in src/, need ../supabaseClient

interface Props {
  subtotal: number // The bill amount (after discount)
  onConfirm: (method: string, tipAmount: number, customerId?: string) => void
  onCancel: () => void
}

export default function PaymentModal({ subtotal, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const [tip, setTip] = useState(0)
  
  // CUSTOMER LOYALTY STATE
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [crmActive, setCrmActive] = useState(false)

  // GIFT CARD STATE
  const [giftCardCode, setGiftCardCode] = useState('');
  const [gcBalance, setGcBalance] = useState<number | null>(null);
  const [gcError, setGcError] = useState('');

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
                        style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', hover: { background: '#f5f5f5' } }}
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
            <button onClick={() => addTipPercent(20)} , selectedCustomer?.id)} style={payBtnStyle('var(--success-color, #2e7d32)')}>💵 {t('cash')}</button>
          <button onClick={() => onConfirm('CARD', tip, selectedCustomer?.id
          
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
            <span>${(subtotal / 100).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', color: 'var(--success-color)', fontWeight: 'bold' }}>
            <span>+ {t('tip')}:</span>
            <span>${(tip / 100).toFixed(2)}</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', margin: '10px 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2rem', fontWeight: 'bold' }}>
            <span>{t('total')}:</span>
            <span>${(finalTotal / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* --- CONFIRM BUTTONS --- */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <button onClick={() => onConfirm('CASH', tip)} style={payBtnStyle('var(--success-color, #2e7d32)')}>💵 {t('cash')}</button>
          <button onClick={() => onConfirm('CARD', tip)} style={payBtnStyle('var(--primary-color, #1565c0)')}>💳 {t('card')}</button>
        </div>

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

const payBtnStyle = (color: string) => ({
  flex: 1, padding: '15px', fontSize: '1.2rem', fontWeight: 'bold' as const,
  background: color, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'
})