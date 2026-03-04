
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Truck, Package, CheckCircle, XCircle } from 'lucide-react';

export default function SupplyChain() {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(false);
  
  // Suppliers Form
  const [newSupplier, setNewSupplier] = useState({ name: '', contact: '', email: '', phone: '' });
  
  // PO Form
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poItems, setPoItems] = useState<{ingredient_id: string, quantity: number, cost: number}[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);

  // Inline Styles
  const containerStyle: React.CSSProperties = { padding: '20px', fontFamily: 'sans-serif', color: '#333' };
  const tabBtnStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    cursor: 'pointer',
    background: isActive ? '#f0f0f0' : 'transparent',
    border: 'none',
    borderBottom: isActive ? '3px solid #333' : '3px solid transparent',
    fontWeight: isActive ? 'bold' : 'normal',
    display: 'flex', alignItems: 'center', gap: '8px',
    marginRight: '10px',
    fontSize: '1rem',
    color: '#333'
  });
  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '15px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
  };
  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '10px', marginBottom: '10px',
    border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'
  };
  const btnStyle: React.CSSProperties = {
    padding: '10px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
  };

  useEffect(() => {
    fetchSuppliers();
    if (activeTab === 'orders') fetchPurchaseOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const loadIngredients = async () => {
      const { data } = await supabase.from('ingredients').select('*');
      if (data) setIngredients(data);
    };
    loadIngredients();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').order('name');
    if (data) setSuppliers(data);
    setLoading(false);
  };

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name)')
      .order('created_at', { ascending: false });
    if (data) setPurchaseOrders(data);
    setLoading(false);
  };

  const createSupplier = async () => {
    if (!newSupplier.name) return;
    const { error } = await supabase.from('suppliers').insert([{
      name: newSupplier.name,
      contact_name: newSupplier.contact,
      email: newSupplier.email,
      phone: newSupplier.phone
    }]);
    
    if (!error) {
      setNewSupplier({ name: '', contact: '', email: '', phone: '' });
      fetchSuppliers();
    }
  };

  const createPurchaseOrder = async () => {
    if (!selectedSupplierId || poItems.length === 0) return;

    const { data: userData } = await supabase.auth.getUser();

    // 1. Create PO Header
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert([{
        supplier_id: selectedSupplierId,
        status: 'DRAFT',
        branch_id: userData.user?.id 
      }])
      .select()
      .single();

    if (poError || !poData) {
      console.error(poError);
      alert('Error creating PO');
      return;
    }

    // 2. Insert Items
    const itemsToInsert = poItems.map(item => ({
      po_id: poData.id,
      ingredient_id: item.ingredient_id,
      quantity_ordered: item.quantity,
      cost_per_unit: item.cost
    }));

    const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsToInsert);

    if (!itemsError) {
      setIsCreatingPO(false);
      setPoItems([]);
      fetchPurchaseOrders();
    }
  };

  const receiveOrder = async (poId: string) => {
    // Call the database function
    const { error } = await supabase.rpc('receive_purchase_order', { po_id_input: poId });
    
    if (error) {
      alert('Error receiving order: ' + error.message);
    } else {
      fetchPurchaseOrders();
      alert('Stock Updated Successfully');
    }
  };

  return (
    <div style={containerStyle}>
      {/* Header Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('suppliers')} style={tabBtnStyle(activeTab === 'suppliers')}>
          <Truck size={18} /> Suppliers
        </button>
        <button onClick={() => setActiveTab('orders')} style={tabBtnStyle(activeTab === 'orders')}>
          <Package size={18} /> Purchase Orders
        </button>
      </div>

      {/* SUPPLIERS TAB */}
      {activeTab === 'suppliers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '20px' }}>
          {/* Create Supplier Form */}
          <div style={{...cardStyle, height: 'fit-content'}}>
            <h3 style={{ marginTop: 0, display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Plus size={18} /> Add Supplier
            </h3>
            <input placeholder="Company Name" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} style={inputStyle} />
            <input placeholder="Contact Person" value={newSupplier.contact} onChange={e => setNewSupplier({...newSupplier, contact: e.target.value})} style={inputStyle} />
            <input placeholder="Email" value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} style={inputStyle} />
            <input placeholder="Phone" value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} style={inputStyle} />
            <button onClick={createSupplier} style={{ ...btnStyle, width: '100%', backgroundColor: '#2e7d32' }}>
              Create Supplier
            </button>
          </div>

          {/* Suppliers List */}
          <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', alignContent: 'start' }}>
            {suppliers.map(s => (
              <div key={s.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{s.name}</h4>
                  <Truck size={20} color="#666" />
                </div>
                <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '0.9rem' }}>{s.contact_name}</p>
                <div style={{ borderTop: '1px solid #eee', paddingTop: '10px', fontSize: '0.85rem', color: '#555' }}>
                  <div>📧 {s.email || 'N/A'}</div>
                  <div>📞 {s.phone || 'N/A'}</div>
                </div>
              </div>
            ))}
            {suppliers.length === 0 && <div style={{ color: '#888', padding: '20px' }}>No suppliers found.</div>}
          </div>
        </div>
      )}

      {/* PURCHASE ORDERS TAB */}
      {activeTab === 'orders' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Purchase Orders</h2>
            {!isCreatingPO && (
              <button onClick={() => setIsCreatingPO(true)} style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Plus size={18} /> New Order
              </button>
            )}
          </div>

          {isCreatingPO && (
            <div style={{ ...cardStyle, background: '#fcfcfc', border: '1px solid #ccc', animation: 'fadeIn 0.3s' }}>
              <h3 style={{ marginTop: 0 }}>Draft Purchase Order</h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>Select Supplier</label>
                <select 
                  style={{ ...inputStyle, width: '300px' }}
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Add Items Section */}
              <div style={{ background: '#fff', padding: '15px', border: '1px solid #eee', borderRadius: '4px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Add Ingredients</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
                  <select id="ing-select" style={{ ...inputStyle, marginBottom: 0, flex: 2 }}>
                    <option value="">Select Ingredient</option>
                    {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} (Last Cost: ${i.cost_per_unit || 0})</option>)}
                  </select>
                  <input id="ing-qty" type="number" placeholder="Qty" style={{ ...inputStyle, marginBottom: 0, width: '100px' }} />
                  <input id="ing-cost" type="number" placeholder="Cost ($)" style={{ ...inputStyle, marginBottom: 0, width: '100px' }} />
                  <button 
                    onClick={() => {
                        const sel = document.getElementById('ing-select') as HTMLSelectElement;
                        const qty = document.getElementById('ing-qty') as HTMLInputElement;
                        const cost = document.getElementById('ing-cost') as HTMLInputElement;
                        if(sel.value && qty.value && cost.value) {
                            setPoItems([...poItems, { 
                                ingredient_id: sel.value, 
                                quantity: Number(qty.value), 
                                cost: Number(cost.value) 
                            }]);
                            sel.value = ""; qty.value = ""; cost.value = "";
                        }
                    }}
                    style={{ ...btnStyle, padding: '10px 20px', height: '42px' }}
                  >Add Item</button>
                </div>
                
                {poItems.length > 0 && (
                  <div style={{ background: '#f5f5f5', borderRadius: '4px' }}>
                    {poItems.map((item, idx) => {
                        const ingName = ingredients.find(i => i.id === item.ingredient_id)?.name || item.ingredient_id;
                        return (
                            <div key={idx} style={{ padding: '8px 15px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{ingName} x {item.quantity} units</span>
                                <span>${(item.cost * item.quantity).toFixed(2)}</span>
                            </div>
                        )
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                 <button onClick={() => setIsCreatingPO(false)} style={{ ...btnStyle, background: 'transparent', color: '#555', border: '1px solid #ccc' }}>Cancel</button>
                 <button onClick={createPurchaseOrder} style={{ ...btnStyle, background: '#2e7d32' }}>Submit Order</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {purchaseOrders.map(po => {
               const statusColor = po.status === 'RECEIVED' ? '#2e7d32' : po.status === 'DRAFT' ? '#ef6c00' : '#1565c0';
               const statusBg = po.status === 'RECEIVED' ? '#e8f5e9' : po.status === 'DRAFT' ? '#fff3e0' : '#e3f2fd';
               
               return (
                <div key={po.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '1.2rem' }}>PO #{po.id.slice(0, 8).toUpperCase()}</h4>
                        <span style={{ 
                            padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                            background: statusBg, color: statusColor, border: `1px solid ${statusColor}40`
                        }}>
                            {po.status}
                        </span>
                      </div>
                      <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '0.95rem' }}>
                        Supplier: <strong style={{ color: '#333' }}>{po.suppliers?.name || 'Unknown'}</strong>
                        <span style={{ margin: '0 10px', color: '#ccc' }}>|</span>
                        Created: {new Date(po.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div>
                    {po.status !== 'RECEIVED' ? (
                        <button 
                            onClick={() => receiveOrder(po.id)}
                            style={{ 
                                ...btnStyle, 
                                background: '#fff', border: '2px solid #2e7d32', color: '#2e7d32', 
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px'
                            }}
                        >
                            <CheckCircle size={18} /> Receive Stock
                        </button>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#2e7d32', fontWeight: 'bold' }}>
                            <CheckCircle size={18} /> Received
                        </div>
                    )}
                    </div>
                  </div>
                </div>
            )})}
            {purchaseOrders.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>No purchase orders found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
