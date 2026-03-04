import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import ReceiptModal from './components/ReceiptModal'
import InventoryManager from './components/InventoryManager'
import SupplyChain from './components/SupplyChain'
import ModifierManager from './components/ModifierManager'
import { convertToCSV } from './utils/exporter'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function AdminDashboard() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('products') 
  const [variants, setVariants] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([]) 
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  // NEW: Settings State
  const [selectedProductForMods, setSelectedProductForMods] = useState<{id: string, name: string} | null>(null);
  
  const [diningMode, setDiningMode] = useState(false)
  const [kitchenMode, setKitchenMode] = useState(false) // New: KDS Toggle State

  // NEW: Store Config
  const [storeName, setStoreName] = useState('OpenTill Coffee')
  const [storeAddress, setStoreAddress] = useState('123 Code Street')
  const [taxRate, setTaxRate] = useState(10)
  const [currency, setCurrency] = useState('$')
  const [totalProfit, setTotalProfit] = useState(0);

  // State for the Receipt Modal
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<any>(null)

  // FILTER & SEARCH STATES
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderSearch, setOrderSearch] = useState('');

  const [salesData, setSalesData] = useState<any[]>([])
  const [topSelling, setTopSelling] = useState<{name: string, qty: number}[]>([]); // New:
  const [bookings, setBookings] = useState<any[]>([])

  // FORM STATES
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('Coffee')
  const [newPrice, setNewPrice] = useState('') 
  const [newVariantName, setNewVariantName] = useState('Standard')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('cashier')

  // BOOKING FORM STATE
  const [bookingName, setBookingName] = useState('')
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0])
  const [bookingTime, setBookingTime] = useState('19:00')
  const [bookingGuests, setBookingGuests] = useState(2)
  const [bookingPhone, setBookingPhone] = useState('')
  const [bookingTable, setBookingTable] = useState('')

  const [staffPerformance, setStaffPerformance] = useState<{name: string, total: number}[]>([])

  useEffect(() => {
    // Initial fetch for settings
    fetchSettings()

    if (activeTab === 'products') fetchVariants()
    else if (activeTab === 'sales') fetchOrders()
    else if (activeTab === 'staff') fetchStaff()
    else if (activeTab === 'analytics') fetchAnalytics()
    else if (activeTab === 'bookings') fetchBookings()
  }, [activeTab, selectedDate]) // Refresh on date change

  // --- DATA FETCHING ---
  const fetchSettings = async () => {
    // Fetch Dining Mode
    const { data: diningData } = await supabase.from('settings').select('*').eq('key', 'dining_mode').single()
    if (diningData) setDiningMode(diningData.value)

    const { data: kitchenData } = await supabase.from('settings').select('*').eq('key', 'kitchen_display_active').single()
    if (kitchenData) setKitchenMode(kitchenData.value)

    const { data: storeData } = await supabase.from('settings').select('*').in('key', ['store_name', 'store_address', 'tax_rate', 'currency'])
    
    if (storeData) {
      storeData.forEach(setting => {
        if (setting.key === 'store_name') setStoreName(setting.value)
        if (setting.key === 'store_address') setStoreAddress(setting.value)
        if (setting.key === 'tax_rate') setTaxRate(Number(setting.value))
        if (setting.key === 'currency') setCurrency(setting.value)
      })
    }
  }

  const fetchAnalytics = async () => {
    // Determine start/end of selected date
    const start = `${selectedDate}T00:00:00`
    const end = `${selectedDate}T23:59:59`
    
    // Fetch orders for date range
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(cost_at_sale)')
      .gte('created_at', start)
      .lte('created_at', end)
    
    if (data) {
      // Calculate Total COGS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalCOGS = data.reduce((acc: number, order: any) => {
        const orderCost = order.order_items?.reduce((sum: number, item: any) => sum + (item.cost_at_sale || 0), 0) || 0;
        return acc + orderCost;
      }, 0);
      
      setTotalProfit((data.reduce((sum, o) => sum + (o.total_amount || 0), 0) - totalCOGS));

      // Group by hour for chart
      const hours = Array(24).fill(0).map((_, i) => ({ name: `${i}:00`, sales: 0 }))
      
      data.forEach((order: any) => {
        if (!order.created_at) return; 
        const date = new Date(order.created_at);
        if (isNaN(date.getTime())) return;
        const hour = date.getHours()
        hours[hour].sales += (order.total_amount || 0)
      })
      
      setSalesData(hours.filter(h => h.sales > 0)) // Only show active hours

      // Calculate Top Selling Items
      const itemMap: Record<string, number> = {};
      data.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
           const name = item.product_name_snapshot || 'Unknown';
           itemMap[name] = (itemMap[name] || 0) + (item.quantity || 0);
        });
      });
      
      const sortedItems = Object.entries(itemMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, qty]) => ({ name, qty }));
        
      setTopSelling(sortedItems);

      // Calculate Staff Performance
      // Note: This requires orders to have user_id and us to fetch staff list to map IDs to emails/names
      // For now we will use the user_id or 'Unknown'
      const staffSales: Record<string, number> = {}
      
      // Get all unique user IDs involved
      const userIds = [...new Set(data.map((o:any) => o.user_id).filter(Boolean))];
      
      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
          const { data: users } = await supabase.from('staff_directory').select('id, email').in('id', userIds);
          if (users) {
              users.forEach(u => { userMap[u.id] = u.email })
          }
      }

      data.forEach((order: any) => {
          const uid = order.user_id;
          const name = userMap[uid] || (uid ? uid.substring(0,8) : 'Kiosk/Unassigned');
          staffSales[name] = (staffSales[name] || 0) + (order.total_amount || 0);
      })

      setStaffPerformance(Object.entries(staffSales).map(([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total));
    }
  }

  const saveSettings = async () => {
    const updates = [
      { key: 'store_name', value: storeName },
      { key: 'store_address', value: storeAddress },
      { key: 'tax_rate', value: taxRate },
      { key: 'currency', value: currency },
      { key: 'dining_mode', value: diningMode },
      { key: 'kitchen_display_active', value: kitchenMode }
    ]

    for (const update of updates) {
      // Upsert logic (if key exists, update value)
      const { data: existing } = await supabase.from('settings').select('id').eq('key', update.key).single()
      
      if (existing) {
        await supabase.from('settings').update({ value: update.value }).eq('id', existing.id)
      } else {
        await supabase.from('settings').insert(update)
      }
    }
    alert(t('settings_saved'))
  }

  const fetchVariants = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('variants')
      .select('*, products(name, category)')
      .order('name')
    setVariants(data || [])
    setLoading(false)
  }

  const fetchOrders = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          price_at_sale,
          cost_at_sale,
          product_name_snapshot,
          variant_id,
          variants (name)
        )
      `)
      .order('created_at', { ascending: false })
    
    if (error) console.error("Sales Fetch Error:", error)
    setOrders(data || [])
    setLoading(false)
  }

  const fetchStaff = async () => {
    setLoading(true)
    const { data } = await supabase.from('staff_directory').select('*')
    setStaff(data || [])
    setLoading(false)
  }

  const fetchBookings = async () => {
    setLoading(true)
    const start = `${selectedDate}T00:00:00`
    const end = `${selectedDate}T23:59:59`
    
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .gte('booking_time', start)
      .lte('booking_time', end)
      .order('booking_time', { ascending: true })

    if (error) console.error("Bookings Error:", error)
    else setBookings(data || [])
    
    setLoading(false)
  }

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    const ts = `${bookingDate}T${bookingTime}:00`
    
    const { error } = await supabase.from('bookings').insert({
        customer_name: bookingName,
        phone: bookingPhone,
        table_number: bookingTable,
        guests: Number(bookingGuests),
        booking_time: ts,
        status: 'confirmed'
    })

    if (error) alert("Error: " + error.message)
    else {
        alert("Reservation Confirmed!")
        setBookingName('')
        setBookingPhone('')
        setBookingTable('') // Reset table
        if (bookingDate === selectedDate) fetchBookings()
    }
  }

  const updateBookingStatus = async (id: string, status: string) => {
      await supabase.from('bookings').update({ status }).eq('id', id)
      fetchBookings()
  }



  const handleVoidOrder = async (order: any) => {
    if (!confirm("Void this order? Revenue will be deducted and stock will be returned.")) return;

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'VOIDED' })
      .eq('id', order.id);

    if (updateError) return alert("Void failed: " + updateError.message);

    for (const item of order.order_items) {
      if (item.variant_id) {
        const { data: v } = await supabase.from('variants').select('stock_quantity, track_stock').eq('id', item.variant_id).single();
        if (v?.track_stock) {
          await supabase.from('variants').update({ stock_quantity: (v.stock_quantity || 0) + item.quantity }).eq('id', item.variant_id);
        }
      }
    }
    alert("Order Voided Successfully");
    fetchOrders();
  };

  // --- ANALYTICS & SEARCH LOGIC ---
  const filteredOrders = orders.filter(o => {
    const created = o.created_at ? new Date(o.created_at) : null;
    if (!created || isNaN(created.getTime())) return false;
    
    const matchesDate = created.toISOString().split('T')[0] === selectedDate;
    const shortId = (o.id || '').split('-')[0].toUpperCase();
    const searchLower = orderSearch.toLowerCase();
    
    const matchesSearch = (o.id || '').toLowerCase().includes(searchLower) || 
                          shortId.includes(searchLower.toUpperCase()) ||
                          o.order_items?.some((i: any) => (i.product_name_snapshot || '').toLowerCase().includes(searchLower));
    return matchesDate && matchesSearch;
  });

  const dailyTotal = filteredOrders
    .filter(o => o.status !== 'VOIDED')
    .reduce((sum, o) => sum + (o.total_amount || 0), 0) / 100;

  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayTotal = orders
      .filter(o => {
        if (!o.created_at) return false;
        const created = new Date(o.created_at);
        if (isNaN(created.getTime())) return false;
        return o.status !== 'VOIDED' && created.toISOString().split('T')[0] === dateStr;
      })
      .reduce((sum, o) => sum + (o.total_amount || 0), 0) / 100;
    return { date: dateStr, label: d.toLocaleDateString([], { weekday: 'short' }), total: dayTotal };
  }).reverse();

  const maxWeeklyTotal = Math.max(...last7Days.map(d => d.total), 1);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newPrice) return alert("Please fill in Name and Price")
    
    let productId;
    const { data: existingProd } = await supabase.from('products').select('id').eq('name', newName).single()
    
    if (existingProd) { productId = existingProd.id } 
    else {
      const { data: pData } = await supabase.from('products').insert({ name: newName, category: newCategory }).select().single()
      productId = pData.id
    }

    await supabase.from('variants').insert({ 
      product_id: productId, 
      name: newVariantName, 
      price: Math.round(parseFloat(newPrice) * 100),
      stock_quantity: 10,
      track_stock: true 
    })

    setNewName(''); setNewPrice(''); fetchVariants()
  }

  const updateVariantField = async (id: string, field: string, value: any) => {
    setVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
    await supabase.from('variants').update({ [field]: value }).eq('id', id)
  }

  const handleDeleteVariant = async (v: any) => {
    if (confirm(`Delete ${v.products?.name}?`)) {
      await supabase.from('variants').delete().eq('id', v.id)
      fetchVariants()
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.rpc('create_employee', { email: newEmail, password: newPassword, role_name: newRole })
    if (error) alert(error.message); else { alert("Staff created!"); fetchStaff(); }
  }

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#333' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
           <h1 style={{ margin: 0 }}>📦 Admin Portal</h1>
           <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Real-time management for OpenTill POS.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/order" target="_blank" style={{ padding: '10px 20px', background: '#2e7d32', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
              📱 View Menu
            </a>
            <a href="/" style={{ padding: '10px 20px', background: '#333', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
              ← Back to Till
            </a>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '10px' }}>
        {['products', 'stock', 'purchasing', 'sales', 'analytics', 'bookings', 'staff', 'settings'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            style={{ 
              padding: '12px 24px', cursor: 'pointer', fontWeight: 'bold', border: 'none', borderRadius: '8px',
              background: activeTab === tab ? '#000' : '#eee', 
              color: activeTab === tab ? '#fff' : '#000', transition: '0.2s',
              minWidth: '100px'
            }}
          >
            {t(tab).toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '12px', minHeight: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'auto', maxHeight: '80vh' }}>
        
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center' }}>{t('loading')}...</div>
        ) : activeTab === 'products' ? (
          <div style={{ padding: '20px' }}>
            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #eee' }}>
              <form onSubmit={handleCreateProduct} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 2 }}><label style={labelStyle}>Product Name</label><input value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Price ($)</label><input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} style={inputStyle} /></div>
                <button type="submit" style={{ padding: '11px 20px', background: '#1b5e20', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add</button>
              </form>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: '#fafafa' }}>
                  <th style={thStyle}>Product</th><th style={thStyle}>Price</th><th style={thStyle}>Stock Tracking</th><th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {variants.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={tdStyle}>
                        <strong>{v.products?.name}</strong> ({v.name})
                        <button onClick={() => setSelectedProductForMods({id: v.product_id, name: v.products?.name})} style={{ marginLeft: '10px', padding: '2px 5px', fontSize: '0.8rem', cursor: 'pointer', background: '#eaeaea', border: '1px solid #ccc', borderRadius: '4px' }}>⚙️ Modifiers</button>
                    </td>
                    <td style={tdStyle}>
                      <input type="number" step="0.01" value={(v.price / 100).toFixed(2)} onChange={(e) => updateVariantField(v.id, 'price', Math.round(parseFloat(e.target.value) * 100))} style={editInput} />
                    </td>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={v.track_stock} onChange={(e) => updateVariantField(v.id, 'track_stock', e.target.checked)} />
                      <input type="number" disabled={!v.track_stock} value={v.stock_quantity} onChange={(e) => updateVariantField(v.id, 'stock_quantity', parseInt(e.target.value || '0'))} style={{ ...editInput, marginLeft: '10px', opacity: v.track_stock ? 1 : 0.3 }} />
                    </td>
                    <td style={tdStyle}><button onClick={() => handleDeleteVariant(v)} style={delBtn}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        ) : activeTab === 'stock' ? (
          <InventoryManager />
        ) : activeTab === 'purchasing' ? (
          <SupplyChain />
        ) : activeTab === 'analytics' ? (
          <div style={{ padding: '25px', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>{t('analytics')}</h2>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                   <label style={{ marginRight: '10px', fontWeight: 'bold' }}>{t('date')}:</label>
                   <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
                </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#555' }}>{t('total_sales')}</h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2e7d32' }}>
                  {currency}{(salesData.reduce((sum, item) => sum + item.sales, 0) / 100).toFixed(2)}
                </div>
              </div>

              <div style={{ padding: '20px', background: '#fff3e0', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#e65100' }}>Est. Gross Profit</h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#e65100' }}>
                  {currency}{(totalProfit / 100).toFixed(2)}
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>Sales - COGS</p>
              </div>

              <div style={{ padding: '20px', background: '#e3f2fd', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#1565c0' }}>{t('top_selling_items')}</h3>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    {topSelling.length > 0 ? topSelling.map((it, idx) => (
                        <li key={idx} style={{ marginBottom: '5px' }}>
                            <strong>{it.qty}x</strong> {it.name}
                        </li>
                    )) : <div>Loading...</div>}
                </ul>
                <div style={{ marginTop: '15px' }}>
                  <button onClick={() => convertToCSV(topSelling, `Top_Items_${selectedDate}`)} style={{ ...btnStyle, background: '#1976d2', color: 'white', border: 'none', width: '100%' }}>
                     Download Report
                  </button>
                </div>
              </div>

              <div style={{ padding: '20px', background: '#f3e5f5', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#7b1fa2' }}>{t('staff_performance')}</h3>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    {staffPerformance.length > 0 ? staffPerformance.map((s, idx) => (
                        <li key={idx} style={{ marginBottom: '5px' }}>
                           {s.name}: <strong>{currency}{(s.total / 100).toFixed(2)}</strong>
                        </li>
                    )) : <div>No data</div>}
                </ul>
                <div style={{ marginTop: '15px' }}>
                  <button onClick={() => convertToCSV(staffPerformance.map(s => ({ Name: s.name, Sales: (s.total/100).toFixed(2) })), `Staff_Perf_${selectedDate}`)} style={{ ...btnStyle, background: '#8e24aa', color: 'white', border: 'none', width: '100%' }}>
                     Download Report
                  </button>
                </div>
              </div>
            </div>

            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData.map(d => ({ ...d, sales: d.sales / 100 }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${currency}${value}`} />
                  <Bar dataKey="sales" fill="#1565c0" name="Sales ($)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        ) : activeTab === 'bookings' ? (
          <div style={{ padding: '25px', display: 'flex', gap: '30px', flexDirection: 'row' }}>
            {/* Left: Create Booking Form */}
            <div style={{ flex: 1, maxWidth: '350px' }}>
                <div style={{ background: '#f9f9f9', padding:'20px', borderRadius:'10px', position:'sticky', top:'0' }}>
                    <h3 style={{margin:'0 0 15px 0'}}>{t('new_booking')}</h3>
                    <form onSubmit={handleCreateBooking}>
                        <label style={labelStyle}>{t('date')}/{t('time')}</label>
                        <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                            <input type="date" value={bookingDate} onChange={e=>setBookingDate(e.target.value)} style={{flex:1, ...inputStyle}} />
                            <input type="time" value={bookingTime} onChange={e=>setBookingTime(e.target.value)} style={{flex:1, ...inputStyle}} />
                        </div>
                        <label style={labelStyle}>{t('guests')}</label>
                        <input type="number" min="1" value={bookingGuests} onChange={e=>setBookingGuests(Number(e.target.value))} style={{...inputStyle, marginBottom:'10px'}} />
                        
                        <label style={labelStyle}>{t('customer_name')}</label>
                        <input value={bookingName} onChange={e=>setBookingName(e.target.value)} style={{...inputStyle, marginBottom:'10px'}} />
                        
                        <label style={labelStyle}>{t('phone')}</label>
                        <input value={bookingPhone} onChange={e=>setBookingPhone(e.target.value)} style={{...inputStyle, marginBottom:'10px'}} />
                        
                        <label style={labelStyle}>{t('table_number')} (Optional)</label>
                        <input value={bookingTable} onChange={e=>setBookingTable(e.target.value)} style={{...inputStyle, marginBottom:'20px'}} />
                        
                        <button style={{width:'100%', padding:'12px', background:'#000', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>
                            {t('create_booking')}
                        </button>
                    </form>
                </div>
            </div>
            
            {/* Right: Bookings List */}
            <div style={{ flex: 2 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                   <h2 style={{margin:0}}>
                       {isNaN(new Date(selectedDate).getTime()) ? "Select Date" : new Date(selectedDate).toLocaleDateString([], {weekday:'long', month:'long', day:'numeric'})}
                   </h2>
                   <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={inputStyle} />
                </div>
                
                {bookings.length === 0 ? (
                    <div style={{padding:'50px', textAlign:'center', color:'#888', background:'#f9f9f9', borderRadius:'10px'}}>
                        {t('no_bookings')}
                    </div>
                ) : (
                    <div style={{display:'grid', gap:'15px'}}>
                        {bookings.map(book => (
                            <div key={book.id} style={{
                                padding:'15px', 
                                borderLeft:`5px solid ${book.status==='seated'?'#2e7d32':book.status==='cancelled'?'#c62828':'#1565c0'}`,
                                background:'#fff', boxShadow:'0 2px 10px rgba(0,0,0,0.05)', borderRadius:'8px',
                                display:'flex', justifyContent:'space-between', alignItems:'center'
                            }}>
                                <div>
                                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                        <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{new Date(book.booking_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                        <div style={{background:'#eee', padding:'2px 8px', borderRadius:'4px', fontSize:'0.8rem'}}>Table {book.table_number || 'Any'}</div>
                                    </div>
                                    <div style={{fontSize:'1.1rem', marginTop:'5px'}}>{book.customer_name} ({book.guests} ppl)</div>
                                    {book.phone && <div style={{fontSize:'0.85rem', color:'#666', marginTop:'2px'}}>📞 {book.phone}</div>}
                                </div>
                                <div style={{display:'flex', gap:'5px'}}>
                                    {book.status !== 'seated' && book.status !== 'cancelled' && (
                                        <button onClick={()=>updateBookingStatus(book.id, 'seated')} style={{background:'#e8f5e9', border:'1px solid #c8e6c9', color:'#1b5e20', padding:'5px 10px', borderRadius:'4px', cursor:'pointer'}}>{t('seated')}</button>
                                    )}
                                    {book.status !== 'cancelled' && (
                                        <button onClick={()=>updateBookingStatus(book.id, 'cancelled')} style={{background:'#ffebee', border:'1px solid #ffcdd2', color:'#b71c1c', padding:'5px 10px', borderRadius:'4px', cursor:'pointer'}}>{t('cancelled')}</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </div>

        ) : activeTab === 'settings' ? (
          <div style={{ padding: '30px', maxWidth: '600px' }}>
            <h2 style={{ marginTop: 0 }}>{t('settings')}</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>{t('store_name')}</label>
              <input 
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>{t('store_address')}</label>
              <input 
                value={storeAddress}
                onChange={e => setStoreAddress(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>{t('tax_rate')}</label>
                <input 
                  type="number"
                  value={taxRate}
                  onChange={e => setTaxRate(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '6px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>{t('currency_symbol')}</label>
                <select 
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '6px' }}
                >
                  <option value="$">$ (USD)</option>
                  <option value="€">€ (EUR)</option>
                  <option value="£">£ (GBP)</option>
                  <option value="¥">¥ (JPY)</option>
                </select>
              </div>
            </div>

            <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Feature Toggles</h3>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <input 
                  type="checkbox" 
                  id="diningMode" 
                  checked={diningMode} 
                  onChange={e => setDiningMode(e.target.checked)} 
                  style={{ width: '20px', height: '20px', marginRight: '10px' }}
                />
                <label htmlFor="diningMode">Enable Tables & Dining Mode</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input 
                  type="checkbox" 
                  id="kitchenMode" 
                  checked={kitchenMode} 
                  onChange={e => setKitchenMode(e.target.checked)} 
                  style={{ width: '20px', height: '20px', marginRight: '10px' }}
                />
                <label htmlFor="kitchenMode">Enable Kitchen Display System (KDS)</label>
              </div>
            </div>

            <button 
              onClick={saveSettings}
              style={{ 
                width: '100%', padding: '15px', background: '#000', color: 'white', 
                border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' 
              }}
            >
              {t('save_settings')}
            </button>
          </div>
        
        ) : activeTab === 'sales' ? (
          <div style={{ padding: '25px' }}>
            <div style={{ marginBottom: '30px', padding: '20px', background: '#fff', border: '1px solid #eee', borderRadius: '10px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1rem' }}>{t('revenue_trends')}</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '15px', height: '120px' }}>
                {last7Days.map(day => (
                  <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>{currency}{day.total.toFixed(0)}</div>
                    <div style={{ width: '100%', background: day.date === selectedDate ? '#2e7d32' : '#e0e0e0', height: `${(day.total / maxWeeklyTotal) * 100}px`, borderRadius: '3px 3px 0 0' }}></div>
                    <div style={{ fontSize: '0.65rem', color: '#666' }}>{day.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', alignItems: 'flex-end' }}>
               <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{t('search_orders')}</label>
                  <input placeholder={t('search_placeholder')} value={orderSearch} onChange={e => setOrderSearch(e.target.value)} style={{ ...inputStyle, width: '100%', border: '2px solid #eee' }} />
               </div>
               <div>
                  <label style={labelStyle}>{t('date')}</label>
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
               </div>
               <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                  <div style={{ background: '#e8f5e9', padding: '10px 20px', borderRadius: '8px', border: '1px solid #c8e6c9', minWidth: '150px' }}>
                      <small style={{ color: '#2e7d32', fontWeight: 'bold' }}>{filteredOrders.length} {t('orders').toUpperCase()}</small>
                      <h2 style={{ margin: 0, color: '#1b5e20' }}>{currency}{dailyTotal.toFixed(2)}</h2>
                  </div>
                  <button 
                    onClick={() => convertToCSV(filteredOrders.map(o => ({
                        id: o.id,
                        date: new Date(o.created_at).toLocaleString(),
                        total: (o.total_amount / 100).toFixed(2),
                        method: o.payment_method,
                        status: o.status
                    })), `Sales_Report_${selectedDate}`)}
                    style={{ ...btnStyle, background: '#1976d2', color: 'white', border: 'none' }}
                  >
                    📥 Export CSV
                  </button>
               </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: '#fafafa', borderBottom: '2px solid #eee' }}>
                  <th style={thStyle}>{t('order_id')}</th><th style={thStyle}>{t('items')}</th><th style={thStyle}>{t('total')}</th><th style={thStyle}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(sale => (
                  <tr key={sale.id} style={{ borderBottom: '1px solid #eee', opacity: sale.status === 'VOIDED' ? 0.5 : 1 }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 'bold', color: '#1a73e8', fontSize: '0.8rem' }}>#{sale.id.split('-')[0].toUpperCase()}</div>
                      <div style={{ color: '#999', fontSize: '0.75rem' }}>{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      {sale.status === 'VOIDED' && <div style={{color:'red', fontSize:'0.7rem', fontWeight:'bold'}}>{t('voided')}</div>}
                    </td>
                    <td style={tdStyle}>
                      {sale.order_items?.map((item: any, i: number) => (
                        <div key={i} style={{ fontSize: '0.9rem' }}>{item.quantity}x {item.product_name_snapshot}</div>
                      ))}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>{currency}{((sale.total_amount || 0) / 100).toFixed(2)}</td>
                    <td style={tdStyle}>
                      <div style={{display:'flex', gap: '8px'}}>
                        <button onClick={() => setSelectedReceiptOrder(sale)} style={btnStyle}>{t('print_receipt')}</button>
                        {sale.status !== 'VOIDED' && <button onClick={() => handleVoidOrder(sale)} style={{...btnStyle, color: 'red'}}>{t('void_order')}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        ) : activeTab === 'staff' ? (
          <div style={{ padding: '20px' }}>
            <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #eee' }}>
              <h3 style={{ marginTop: 0 }}>{t('staff_directory')}</h3>
              <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '10px' }}>
                <input placeholder={t('email')} value={newEmail} onChange={e => setNewEmail(e.target.value)} style={inputStyle} />
                <input type="password" placeholder={t('password')} value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} />
                <select value={newRole} onChange={e => setNewRole(e.target.value)} style={inputStyle}>
                  <option value="cashier">{t('cashier')}</option>
                  <option value="admin">{t('admin')}</option>
                  <option value="kitchen">{t('kitchen')}</option>
                </select>
                <button type="submit" style={{ padding: '10px 20px', background: 'black', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{t('create_account')}</button>
              </form>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', background: '#fafafa' }}><th style={thStyle}>{t('email')}</th><th style={thStyle}>{t('role')}</th></tr></thead>
              <tbody>{staff.map(s => <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}><td style={tdStyle}>{s.email}</td><td style={tdStyle}>{s.role.toUpperCase()}</td></tr>)}</tbody>
            </table>
          </div>

        ) : null}
      </div>


      {/* RECEIPT MODAL INTEGRATION */}
      {selectedReceiptOrder && (
        <ReceiptModal 
          orderId={selectedReceiptOrder.id}
          subtotal={selectedReceiptOrder.total_amount} 
          discount={selectedReceiptOrder.discount_amount || 0}
          tip={selectedReceiptOrder.tip_amount || 0}
          total={selectedReceiptOrder.total_amount}
          paymentMethod={selectedReceiptOrder.payment_method || 'Cash'} 
          items={selectedReceiptOrder.order_items.map((i: any) => ({
             name: i.product_name_snapshot,
             price: i.price_at_sale,
             quantity: i.quantity
          }))}
          onClose={() => setSelectedReceiptOrder(null)}
        />
      )}

      {/* MODIFIER MANAGER MODAL */}
      {selectedProductForMods && (
        <ModifierManager 
          productId={selectedProductForMods.id} 
          productName={selectedProductForMods.name}
          onClose={() => setSelectedProductForMods(null)} 
        />
      )}
    </div>
  )
}

const labelStyle = { fontSize: '0.7rem', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#666', textTransform: 'uppercase' as const }
const inputStyle = { padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%', boxSizing: 'border-box' as const }
const editInput = { padding: '5px', border: '1px solid #ccc', borderRadius: '4px', width: '80px' }
const thStyle = { padding: '12px 20px', fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' as const }
const tdStyle = { padding: '15px 20px' }
const delBtn = { background: 'none', color: '#d32f2f', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }
const btnStyle = { border: '1px solid #ddd', background: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' as const }