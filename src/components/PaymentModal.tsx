import React, { useState } from 'react'
import { useTranslation } from 'react-i18next';

interface Props {
  subtotal: number // The bill amount (after discount)
  onConfirm: (method: 'CASH' | 'CARD', tipAmount: number) => void
  onCancel: () => void
}

export default function PaymentModal({ subtotal, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const [tip, setTip] = useState(0)

  // Helper: Calculate % based on the subtotal
  const addTipPercent = (pct: number) => {
    setTip(Math.round(subtotal * (pct / 100)))
  }

  const finalTotal = subtotal + tip

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 2000
    }}>
      <div style={{
        background: 'white', padding: '30px', borderRadius: '12px',
        width: '450px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
      }}>
        
        <h2 style={{ marginTop: 0 }}>{t('finalize_payment')}</h2>
        
        {/* --- TIP SECTION --- */}
        <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#666' }}>{t('add_gratuity')}</p>
          
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
              style={{ width: '80px', padding: '5px', textAlign: 'center', fontSize: '1rem' }}
            />
          </div>
        </div>

        {/* --- TOTALS --- */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', color: '#666' }}>
            <span>{t('bill_amount')}:</span>
            <span>${(subtotal / 100).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', color: '#2e7d32', fontWeight: 'bold' }}>
            <span>+ {t('tip')}:</span>
            <span>${(tip / 100).toFixed(2)}</span>
          </div>
          <div style={{ borderTop: '1px solid #ddd', margin: '10px 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2rem', fontWeight: 'bold' }}>
            <span>{t('total')}:</span>
            <span>${(finalTotal / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* --- CONFIRM BUTTONS --- */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <button onClick={() => onConfirm('CASH', tip)} style={payBtnStyle('#2e7d32')}>💵 {t('cash')}</button>
          <button onClick={() => onConfirm('CARD', tip)} style={payBtnStyle('#1565c0')}>💳 {t('card')}</button>
        </div>

        <button onClick={onCancel} style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: '#888' }}>
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}

const btnStyle = (isActive: boolean) => ({
  flex: 1, padding: '10px', cursor: 'pointer',
  background: isActive ? 'black' : 'white',
  color: isActive ? 'white' : 'black',
  border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold' as const
})

const payBtnStyle = (color: string) => ({
  flex: 1, padding: '15px', fontSize: '1.2rem', fontWeight: 'bold' as const,
  background: color, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'
})