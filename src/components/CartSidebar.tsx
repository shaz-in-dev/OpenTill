import { CartItem } from '../Root'
import { TFunction } from 'i18next'; // Type for translation function

interface Props {
  cartItems: CartItem[]
  onCheckout: () => void
  onRemoveFromCart: (id: string, name?: string) => void
  discountPercentage: number
  onSetDiscount: (val: number) => void
  onSendToKitchen: () => void // New prop for kitchen routing
  isDiningMode: boolean; // NEW: To toggle Kitchen UI
  t: TFunction; // NEW: i18n
}

export default function CartSidebar({ 
  cartItems, 
  onCheckout, 
  onRemoveFromCart, 
  discountPercentage, 
  onSetDiscount,
  onSendToKitchen,
  isDiningMode,
  t
}: Props) {
  
  // Calculate Math
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const discountAmount = Math.round(subtotal * (discountPercentage / 100))
  const finalTotal = subtotal - discountAmount

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
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '12px', 
                paddingBottom: '12px', 
                borderBottom: '1px solid #f0f0f0',
                opacity: (item as any).status === 'SENT' ? 0.7 : 1 // Visual feedback for sent items
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={() => onRemoveFromCart(item.id, item.name)}
                  style={{ 
                    background: '#eda8b2', 
                    color: '#fb1919', 
                    border: 'none', 
                    borderRadius: '6px', 
                    width: '28px', 
                    height: '28px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 'bold',
                    fontSize: '16px'
                  }}
                >
                  -
                </button>
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {item.name} 
                    {(item as any).status === 'SENT' && <span style={{ marginLeft: '8px', color: '#2e7d32', fontSize: '0.7rem' }}>✓ Sent</span>}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#888' }}>x{item.quantity}</div>
                </div>
              </div>
              <div style={{ fontWeight: '600' }}>
                ${((item.price * item.quantity) / 100).toFixed(2)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- BOTTOM SECTION (Fixed at bottom) --- */}
      <div className="order-summary-footer">
        
        {/* NEW: Kitchen Action Button - Only in Dining Mode */}
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
                {pct === 0 ? 'None' : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Math Summary */}
        <div style={{ marginBottom: '20px', fontSize: '0.95rem', color: '#666' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>{t('subtotal')}</span>
            <span>${(subtotal / 100).toFixed(2)}</span>
          </div>
          {discountPercentage > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e53935' }}>
              <span>{t('discount')} ({discountPercentage}%)</span>
              <span>-${(discountAmount / 100).toFixed(2)}</span>
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
              ${(finalTotal / 100).toFixed(2)}
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