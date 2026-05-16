import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';

interface Props {
  orderId: string
  subtotal: number
  discount: number
  tax?: number
  tip: number
  total: number
  paymentMethod: string
  items: any[]
  orderNote?: string
  orderType?: string
  createdAt?: string
  onClose: () => void
}

export default function ReceiptModal({ orderId, subtotal, discount, tax = 0, tip, total, paymentMethod, items, orderNote, orderType, createdAt, onClose }: Props) {
  const { t } = useTranslation();
  const [emailAddress, setEmailAddress] = useState('');
  const [storeName, setStoreName] = useState('OpenTill');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    const fetchStoreInfo = async () => {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['store_name', 'store_address', 'store_phone', 'currency']);
      if (data) {
        data.forEach(s => {
          if (s.key === 'store_name') setStoreName(s.value);
          if (s.key === 'store_address') setStoreAddress(s.value);
          if (s.key === 'store_phone') setStorePhone(s.value);
          if (s.key === 'currency') setCurrency(s.value);
        });
      }
    };
    fetchStoreInfo();
  }, []);

  const handlePrint = () => window.print();

  const orderDate = createdAt ? new Date(createdAt) : new Date();

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000
    }}>
      <div className="receipt" style={{
        background: 'white',
        padding: '20px',
        width: '90%',
        maxWidth: '350px',
        fontFamily: 'Courier New, monospace',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        textAlign: 'center',
        overflowY: 'auto',
        maxHeight: '90vh'
      }}>
        <h2 style={{ marginBottom: '5px', textTransform: 'uppercase' }}>{storeName}</h2>
        {storeAddress && <p style={{ fontSize: '0.8rem', margin: 0 }}>{storeAddress}</p>}
        {storePhone && <p style={{ fontSize: '0.8rem', margin: 0 }}>Tel: {storePhone}</p>}
        <div style={{ borderBottom: '1px dashed #000', margin: '15px 0' }}></div>

        <div style={{ textAlign: 'left', fontSize: '0.9rem' }}>
          <p><strong>{t('order_id')}:</strong> #{orderId.slice(0, 8).toUpperCase()}</p>
          <p><strong>{t('date')}:</strong> {orderDate.toLocaleDateString()}</p>
          <p><strong>{t('time')}:</strong> {orderDate.toLocaleTimeString()}</p>
          <p><strong>{t('method')}:</strong> {paymentMethod}</p>
          {orderType && <p><strong>{t('order_type')}:</strong> {t(orderType)}</p>}
        </div>
        <div style={{ borderBottom: '1px dashed #000', margin: '15px 0' }}></div>

        <div style={{ textAlign: 'left', fontSize: '0.9rem', marginBottom: '15px' }}>
          {items.map((item, index) => (
            <div key={index} style={{ marginBottom: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.quantity}x {item.name.replace(' | ', ' - ')}</span>
                <span>{currency}{(item.price * item.quantity / 100).toFixed(2)}</span>
              </div>
              {item.note && (
                <div style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic', paddingLeft: '15px' }}>📝 {item.note}</div>
              )}
            </div>
          ))}
        </div>

        {orderNote && (
          <>
            <div style={{ borderBottom: '1px dashed #000', margin: '15px 0' }}></div>
            <div style={{ textAlign: 'left', fontSize: '0.8rem', fontStyle: 'italic', color: '#555' }}>
              <strong>{t('note')}:</strong> {orderNote}
            </div>
          </>
        )}
        <div style={{ borderBottom: '1px dashed #000', margin: '15px 0' }}></div>

        {/* --- FINANCIAL BREAKDOWN --- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
          <span>{t('subtotal')}</span>
          <span>{currency}{(subtotal / 100).toFixed(2)}</span>
        </div>

        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#e53935' }}>
            <span>{t('discount')}</span>
            <span>-{currency}{(discount / 100).toFixed(2)}</span>
          </div>
        )}

        {tax > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span>{t('tax')}</span>
            <span>{currency}{(tax / 100).toFixed(2)}</span>
          </div>
        )}

        {tip > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span>{t('tip')}</span>
            <span>{currency}{(tip / 100).toFixed(2)}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem', marginTop: '10px' }}>
          <span>{t('total').toUpperCase()}</span>
          <span>{currency}{(total / 100).toFixed(2)}</span>
        </div>

        <div style={{ borderBottom: '1px dashed #000', margin: '20px 0' }}></div>
        <p style={{ fontSize: '0.8rem' }}>{t('thank_you')}</p>

        <div className="no-print" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="email"
              placeholder={t('email_receipt_placeholder')}
              value={emailAddress}
              onChange={e => setEmailAddress(e.target.value)}
              style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem' }}
            />
            <button
              disabled
              title="Email receipt coming soon"
              style={{ padding: '8px 12px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'not-allowed', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            >
              📧 {t('email')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', background: '#eee', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{t('close')}</button>
            <button onClick={handlePrint} style={{ flex: 1, padding: '10px', background: 'black', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{t('print')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
