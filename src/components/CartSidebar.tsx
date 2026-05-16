import { useState } from 'react'
import type { CartItem, OrderType } from '../Root'
import type { TFunction } from 'i18next';
import { StickyNote, Plus, Minus } from 'lucide-react';

interface Props {
  cartItems: CartItem[]
  onCheckout: () => void
  onRemoveFromCart: (id: string, name?: string) => void
  onIncrementItem: (id: string, name?: string) => void
  onUpdateItemNote: (id: string, name: string, note: string) => void
  discountPercentage: number
  onSetDiscount: (val: number) => void
  onSendToKitchen: () => void
  isDiningMode: boolean;
  t: TFunction;
  taxRate?: number;
  orderNote: string;
  onSetOrderNote: (note: string) => void;
  orderType: OrderType;
  currency?: string;
}

export default function CartSidebar({ 
  cartItems, 
  onCheckout, 
  onRemoveFromCart, 
  onIncrementItem,
  onUpdateItemNote,
  discountPercentage, 
  onSetDiscount,
  onSendToKitchen,
  isDiningMode,
  t,
  taxRate = 0,
  orderNote,
  onSetOrderNote,
  orderType,
  currency = '$',
}: Props) {
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  
  // Calculate Math
  const subtotalRaw = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const discountAmount = Math.round(subtotalRaw * (discountPercentage / 100))
  const afterDiscount = subtotalRaw - discountAmount
  
  // FIX: Tax Calculation
  const taxAmount = Math.round(afterDiscount * (taxRate / 100))
  const finalTotal = afterDiscount + taxAmount

  // Helper to check for new items that haven't been "Sent" yet
  const hasNewItems = cartItems.some(item => (item as any).status === 'DRAFT' || !(item as any).status)

  return (
    <div className="cart-sidebar-inner">
      {/* --- HEADER (Fixed) --- */}
      <div className="sidebar-header">
        <h2 style={{ marginTop: 0, fontSize: '1.5rem' }}>{t('cart')}</h2>
      </div>
      
      {/* --- CART ITEMS LIST (Scrollable Middle Container) --- */}
      <div className="order-items-container">
        {cartItems.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', marginTop: '20px' }}>
            {t('empty_cart')}
          </p>
        ) : (
          cartItems.map(item => (
            <div 
              key={`${item.id}-${item.name}`} 
              style={{ 
                marginBottom: '12px', 
                paddingBottom: '12px', 
                borderBottom: '1px solid #f0f0f0',
                opacity: (item as any).status === 'SENT' ? 0.7 : 1
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Quantity Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button 
                      onClick={() => onIncrementItem(item.id, item.name)}
                      disabled={(item as any).status === 'SENT'}
                      style={{ 
                        background: '#e8f5e9', color: '#2e7d32', border: 'none', borderRadius: '4px', 
                        width: '24px', height: '24px', cursor: 'pointer', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', fontSize: '14px'
                      }}
                    >
                      <Plus size={12} />
                    </button>
                    <button 
                      onClick={() => onRemoveFromCart(item.id, item.name)}
                      style={{ 
                        background: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '4px', 
                        width: '24px', height: '24px', cursor: 'pointer', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', fontSize: '14px'
                      }}
                    >
                      <Minus size={12} />
                    </button>
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {item.name} 
                      {(item as any).status === 'SENT' && <span style={{ marginLeft: '8px', color: '#2e7d32', fontSize: '0.7rem' }}>✓ Sent</span>}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>x{item.quantity}</div>
                    {item.note && (
                      <div style={{ fontSize: '0.75rem', color: '#ff9800', fontStyle: 'italic', marginTop: '2px' }}>
                        📝 {item.note}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <div style={{ fontWeight: '600' }}>
                    {currency}{((item.price * item.quantity) / 100).toFixed(2)}
                  </div>
                  <button
                    onClick={() => setEditingNoteFor(editingNoteFor === `${item.id}-${item.name}` ? null : `${item.id}-${item.name}`)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.note ? '#ff9800' : '#ccc', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    <StickyNote size={12} /> {t('note')}
                  </button>
                </div>
              </div>
              {/* Inline Note Editor */}
              {editingNoteFor === `${item.id}-${item.name}` && (
                <div style={{ marginTop: '6px', marginLeft: '36px' }}>
                  <input
                    type="text"
                    placeholder={t('add_note_placeholder')}
                    value={item.note || ''}
                    onChange={e => onUpdateItemNote(item.id, item.name, e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #ffe082', borderRadius: '4px', fontSize: '0.8rem', background: '#fffde7', boxSizing: 'border-box' }}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') setEditingNoteFor(null); }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* --- BOTTOM SECTION (Fixed at bottom) --- */}
      <div className="order-summary-footer">

        {/* Order Type Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
          <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', background: orderType === 'dine_in' ? '#e3f2fd' : orderType === 'takeaway' ? '#fff3e0' : '#fce4ec', color: orderType === 'dine_in' ? '#1565c0' : orderType === 'takeaway' ? '#e65100' : '#c2185b' }}>
            {orderType === 'dine_in' ? '🍽️' : orderType === 'takeaway' ? '🥡' : '🚚'} {t(orderType)}
          </span>
        </div>
        
        {/* Order Note */}
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder={t('order_note_placeholder')}
            value={orderNote}
            onChange={e => onSetOrderNote(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', background: orderNote ? '#fffde7' : '#fafafa' }}
          />
        </div>
        
        {/* Kitchen Action Button - Only in Dining Mode */}
        {isDiningMode && cartItems.length > 0 && (
          <button 
            onClick={onSendToKitchen}
            disabled={!hasNewItems}
            style={{ 
              width: '100%', 
              padding: '12px', 
              background: hasNewItems ? '#2e7d32' : '#eee', 
              color: hasNewItems ? 'white' : '#aaa', 
              borderRadius: '8px', 
              border: 'none', 
              fontWeight: 'bold', 
              marginBottom: '15px',
              cursor: hasNewItems ? 'pointer' : 'not-allowed',
              transition: '0.2s'
            }}
          >
            🍳 {hasNewItems ? t('send_kitchen') : t('kitchen_updated')}
          </button>
        )}

        {/* Discount Toggles */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ 
            fontSize: '0.8rem', 
            fontWeight: 'bold', 
            color: '#aaa', 
            textTransform: 'uppercase', 
            marginBottom: '8px' 
          }}>
            {t('discount')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[0, 10, 20, 50].map(pct => (
              <button 
                key={pct}
                onClick={() => onSetDiscount(pct)} 
                style={{ 
                  padding: '8px', 
                  cursor: 'pointer', 
                  background: discountPercentage === pct ? 'black' : 'white', 
                  color: discountPercentage === pct ? 'white' : '#333', 
                  border: discountPercentage === pct ? '1px solid black' : '1px solid #ddd', 
                  borderRadius: '6px', 
                  fontSize: '0.9rem', 
                  fontWeight: '600', 
                  transition: '0.2s'
                }}
              >
                {pct === 0 ? t('none') : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Math Summary */}
        <div style={{ marginBottom: '20px', fontSize: '0.95rem', color: '#666' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>{t('subtotal')}</span>
            <span>{currency}{(subtotalRaw / 100).toFixed(2)}</span>
          </div>
          {discountPercentage > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e53935', marginBottom: '6px' }}>
              <span>{t('discount')} ({discountPercentage}%)</span>
              <span>-{currency}{(discountAmount / 100).toFixed(2)}</span>
            </div>
          )}
          
          {/* TAX LINE */}
          {taxRate > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9em' }}>
              <span>{t('tax') || 'Tax'} ({taxRate}%)</span>
              <span>{currency}{(taxAmount / 100).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Split Footer Layout */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '15px', 
          borderTop: '2px solid var(--border-color)', 
          paddingTop: '20px' 
        }}>
          
          {/* Left: Total Amount */}
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontSize: '0.85rem', 
              color: 'var(--text-secondary)', 
              textTransform: 'uppercase', 
              fontWeight: 'bold' 
            }}>
              {t('total')}
            </div>
            <div style={{ fontSize: '2.2rem', fontWeight: '800', lineHeight: '1' }}>
              {currency}{(finalTotal / 100).toFixed(2)}
            </div>
          </div>

          {/* Right: Pay Button */}
          <button 
            onClick={onCheckout}
            disabled={cartItems.length === 0}
            className="pay-now-button"
            style={{ 
              flex: 1.5, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '8px' 
            }}
          >
            {t('pay_now')} ➔
          </button>
        </div>
      </div>
    </div>
  )
}