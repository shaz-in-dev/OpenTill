import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useTranslation } from 'react-i18next'
import { deductIngredients } from '../utils/inventory'
import ModifierSelectionModal from './ModifierSelectionModal'
export default function CustomerMenu() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [customerName, setCustomerName] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [orderSent, setOrderSent] = useState(false)
  const [selectedVariantForMods, setSelectedVariantForMods] = useState<any>(null)

  useEffect(() => {
    fetchMenu()
  }, [])

  const fetchMenu = async () => {
    const { data } = await supabase
      .from('variants')
      .select('*, products(name, category, image_url, modifier_groups(*, modifiers(*)))')
      .gt('price', 0) // Only show priced items
      
    if (data) setProducts(data)
  }

  const addToCart = (variant: any, modifiers: any[] = []) => {
    const modString = JSON.stringify(modifiers.map(m => m.id).sort())
    
    // Find existing item with same variant ID AND same modifiers
    const existing = cart.find(c => {
        const cMods = JSON.stringify((c.modifiers || []).map((m: any) => m.id).sort())
        return c.id === variant.id && cMods === modString
    })

    if (existing) {
      setCart(cart.map(c => {
          const cMods = JSON.stringify((c.modifiers || []).map((m: any) => m.id).sort())
          return (c.id === variant.id && cMods === modString) ? { ...c, quantity: c.quantity + 1 } : c
      }))
    } else {
      // Calculate adjusted price
      const modTotal = modifiers.reduce((sum, m) => sum + m.price_adjustment, 0)
      setCart([...cart, { ...variant, price: variant.price + modTotal, quantity: 1, modifiers: modifiers }])
    }
  }

  const handleProductClick = (variant: any) => {
      if (variant.products?.modifier_groups?.length > 0) {
          setSelectedVariantForMods(variant)
      } else {
          addToCart(variant)
      }
  }

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index))
  }

  const submitOrder = async () => {
    if (cart.length === 0) return alert("Cart is empty!")
    if (!customerName) return alert("Please enter your name")

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        total_amount: total,
        payment_method: 'online', // Or 'pay_at_counter'
        status: 'pending', // Will show on KDS
        customer_name: customerName, // Need to ensure column exists or just store in metadata
        table_number: tableNumber
      })
      .select()
      .single()

    if (error) {
      alert("Order Failed: " + error.message)
    } else {
      // Add Items
      const items = cart.map(item => ({
        order_id: order.id,
        variant_id: item.id,
        quantity: item.quantity,
        price_at_sale: item.price,
        product_name_snapshot: item.products.name + (item.name !== 'Standard' ? ` (${item.name})` : ''),
        modifiers: item.modifiers || []
      }))

      await supabase.from('order_items').insert(items)
      
      // Deduct Ingredients
      deductIngredients(items)

      setOrderSent(true)
      setCart([])
    }
  }

  if (orderSent) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ color: '#2e7d32' }}>✅ {t('order_received')}</h1>
        <p>{t('order_thanks', { name: customerName })}</p>
        <p>Please wait at your table {tableNumber && `(${tableNumber})`}.</p>
        <button onClick={() => setOrderSent(false)} style={btnStyle}>{t('place_another')}</button>
      </div>
    )
  }

  const categories = ['All', ...Array.from(new Set(products.map(p => p.products?.category || 'Uncategorized')))]
  const filteredProducts = activeCategory === 'All' 
    ? products 
    : products.filter(p => p.products?.category === activeCategory)

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) / 100

  return (
    <div style={{ fontFamily: 'sans-serif', paddingBottom: '80px' }}>
      {/* HEADER */}
      <div style={{ background: '#000', color: 'white', padding: '15px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ margin: 0 }}>{t('online_menu_title')}</h2>
          <div style={{ fontSize: '0.9rem' }}>👋 Welcome!</div>
        </div>
      </div>

      {/* CATEGORY BAR */}
      <div style={{ overflowX: 'auto', display: 'flex', gap: '10px', padding: '15px 20px', background: '#f8f8f8' }}>
        {categories.map(cat => (
          <button 
            key={cat} 
            onClick={() => setActiveCategory(cat)}
            style={{ 
              padding: '8px 16px', borderRadius: '20px', border: 'none', whiteSpace: 'nowrap',
              background: activeCategory === cat ? '#000' : '#fff', 
              color: activeCategory === cat ? '#fff' : '#000',
              fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* MENU GRID */}
      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px', maxWidth: '800px', margin: '0 auto' }}>
        {filteredProducts.map(p => (
          <div key={p.id} style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', background: 'white', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '120px', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
              {products[0]?.products?.image_url ? <img src={p.products.image_url} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : 'No Image'}
            </div>
            <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{p.products?.name}</div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>{p.name !== 'Standard' ? p.name : ''}</div>
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 'bold' }}>${(p.price / 100).toFixed(2)}</div>
                <button onClick={() => handleProductClick(p)} style={{ background: '#000', color: '#fff', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}>+</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CART FLOATING BAR */}
      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', padding: '20px', borderTop: '1px solid #eee', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <strong>{t('your_order')} ({cart.reduce((s,i)=>s+i.quantity,0)} items)</strong>
              <strong>Total: ${cartTotal.toFixed(2)}</strong>
            </div>
            
            <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '15px', background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
              {cart.map((item, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                   <span>{item.quantity}x {item.products?.name} {item.modifiers && item.modifiers.length > 0 && <span style={{fontSize:'0.8rem', color:'#666'}}>({item.modifiers.map((m:any) => m.name).join(', ')})</span>}</span>
                   <span style={{ cursor: 'pointer', color: 'red' }} onClick={() => removeFromCart(index)}>×</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
               <input placeholder="Your Name" value={customerName} onChange={e => setCustomerName(e.target.value)} style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
               <input placeholder="Table No." value={tableNumber} onChange={e => setTableNumber(e.target.value)} style={{ width: '80px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>

            <button onClick={submitOrder} style={{ width: '100%', padding: '14px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem' }}>
              {t('place_order')} (${cartTotal.toFixed(2)})
            </button>
          </div>
        </div>
      )}

      {selectedVariantForMods && (
        <ModifierSelectionModal 
           product={selectedVariantForMods.products} 
           variant={selectedVariantForMods}
           onConfirm={(mods) => {
              addToCart(selectedVariantForMods, mods);
              setSelectedVariantForMods(null);
           }}
           onCancel={() => setSelectedVariantForMods(null)}
        />
      )}
    </div>
  )
}

const btnStyle = { padding: '10px 20px', background: '#000', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }
