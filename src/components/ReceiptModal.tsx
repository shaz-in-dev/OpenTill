import React from 'react'
import { useTranslation } from 'react-i18next';

interface Props {
  orderId: string
  subtotal: number
  discount: number
  tip: number         // <--- NEW PROP
  total: number
  paymentMethod: string 
  items: any[]
  onClose: () => void
}

export default function ReceiptModal({ orderId, subtotal, discount, tip, total, paymentMethod, items, onClose }: Props) {
  const { t } = useTranslation();
  
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000
    }}>
      <div className="receipt" style={{
        background: 'white',
        padding: '40px',
        width: '300px',
        fontFamily: 'Courier New, monospace', 
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        textAlign: 'center'
      }}>
        
        <h2 style={{ marginBottom: '5px', textTransform: 'uppercase' }}>OpenTill Coffee</h2>
        <p style={{ fontSize: '0.8rem', margin: 0 }}>123 Code Street, Tech City</p>
        <p style={{ fontSize: '0.8rem', margin: 0 }}>Tel: 555-0199</p>
        <div style={{ borderBottom: '1px dashed #000', margin: '15px 0' }}></div>

        <div style={{ textAlign: 'left', fontSize: '0.9rem' }}>
          <p><strong>{t('order_id')}:</strong> {orderId.slice(0, 8)}</p>
          <p><strong>{t('date')}:</strong> {new Date().toLocaleDateString()}</p>
          <p><strong>{t('time')}:</strong> {new Date().toLocaleTimeString()}</p>
          <p><strong>{t('method')}:</strong> {paymentMethod}</p> 
        </div>
        <div style={{ borderBottom: '1px dashed #000', margin: '15px 0' }}></div>

        <div style={{ textAlign: 'left', fontSize: '0.9rem', marginBottom: '15px' }}>
          {items.map((item, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>{item.quantity}x {item.name.replace('(', '- ').replace(')', '')}</span>
              <span>${(item.price * item.quantity / 100).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div style={{ borderBottom: '1px dashed #000', margin: '15px 0' }}></div>

        {/* --- FINANCIAL BREAKDOWN --- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
          <span>{t('subtotal')}</span>
          <span>${(subtotal / 100).toFixed(2)}</span>
        </div>

        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span>{t('discount')}</span>
            <span>-${(discount / 100).toFixed(2)}</span>
          </div>
        )}

        {/* SHOW TIP ONLY IF > 0 */}
        {tip > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span>{t('tip')}</span>
            <span>${(tip / 100).toFixed(2)}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem', marginTop: '10px' }}>
          <span>{t('total').toUpperCase()}</span>
          <span>${(total / 100).toFixed(2)}</span>
        </div>

        <div style={{ borderBottom: '1px dashed #000', margin: '20px 0' }}></div>
        <p style={{ fontSize: '0.8rem' }}>{t('thank_you')}</p>

        <div className="no-print" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: '#eee', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{t('close')}</button>
          <button onClick={handlePrint} style={{ flex: 1, padding: '10px', background: 'black', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{t('print')}</button>
        </div>

      </div>
    </div>
  )
}