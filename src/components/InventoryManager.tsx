import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, AlertCircle, Save } from 'lucide-react';

export default function InventoryManager() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'ingredients' | 'recipes' | 'wastage'>('ingredients');
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [wastageLogs, setWastageLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [newIngredient, setNewIngredient] = useState({ name: '', unit: 'kg', cost: 0, stock: 0, min_stock: 5 });
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<any[]>([]);
  const [newRecipeItem, setNewRecipeItem] = useState({ ingredient_id: '', quantity: 0 });
  const [wastageEntry, setWastageEntry] = useState({ ingredient_id: '', quantity: 0, reason: 'Expired' });

  useEffect(() => {
    fetchIngredients();
    if (activeTab === 'recipes') fetchProducts();
    if (activeTab === 'wastage') fetchWastageLogs();
  }, [activeTab]);

  const fetchIngredients = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ingredients').select('*').order('name');
    if (error) console.error('Error fetching ingredients:', error);
    else setIngredients(data || []);
    setLoading(false);
  };

  const fetchProducts = async () => {
    // We link recipes to VARIANTS, so we fetch variants with product names
    const { data } = await supabase.from('variants').select('*, products(name)').order('name');
    setProducts(data || []);
  };

  const fetchRecipe = async (variantId: string) => {
    setSelectedProduct(variantId);
    const { data } = await supabase
      .from('product_ingredients')
      .select('*, ingredients(name, unit)')
      .eq('variant_id', variantId);
    setRecipeIngredients(data || []);
  };

  const fetchWastageLogs = async () => {
    const { data } = await supabase
      .from('wastage_logs')
      .select('*, ingredients(name, unit)')
      .order('created_at', { ascending: false })
      .limit(50);
    setWastageLogs(data || []);
  };

  const addIngredient = async () => {
    if (!newIngredient.name) return;
    const { error } = await supabase.from('ingredients').insert([{
      name: newIngredient.name,
      unit: newIngredient.unit,
      cost_per_unit: newIngredient.cost,
      current_stock: newIngredient.stock,
      low_stock_threshold: newIngredient.min_stock
    }]);
    
    if (!error) {
      setNewIngredient({ name: '', unit: 'kg', cost: 0, stock: 0, min_stock: 5 });
      fetchIngredients();
    }
  };

  const addToRecipe = async () => {
    if (!selectedProduct || !newRecipeItem.ingredient_id) return;
    
    const { error } = await supabase.from('product_ingredients').insert([{
      variant_id: selectedProduct,
      ingredient_id: newRecipeItem.ingredient_id,
      quantity_required: newRecipeItem.quantity
    }]);

    if (!error) {
      setNewRecipeItem({ ingredient_id: '', quantity: 0 });
      fetchRecipe(selectedProduct);
    }
  };

  const removeRecipeItem = async (id: string) => {
     await supabase.from('product_ingredients').delete().eq('id', id);
     if (selectedProduct) fetchRecipe(selectedProduct);
  };

  const logWastage = async () => {
    if (!wastageEntry.ingredient_id || wastageEntry.quantity <= 0) return;

    // 1. Log the wastage
    const { error } = await supabase.from('wastage_logs').insert([{
      ingredient_id: wastageEntry.ingredient_id,
      quantity_wasted: wastageEntry.quantity,
      reason: wastageEntry.reason,
      created_at: new Date()
    }]);

    if (!error) {
      // 2. Deduct from stock
      // We need to fetch current stock and update it. 
      // Ideally this is a stored procedure, but doing client-side for MVP.
      const ingredient = ingredients.find(i => i.id === wastageEntry.ingredient_id);
      if (ingredient) {
         await supabase.from('ingredients').update({
           current_stock: ingredient.current_stock - wastageEntry.quantity
         }).eq('id', ingredient.id);
      }

      setWastageEntry({ ingredient_id: '', quantity: 0, reason: 'Expired' });
      fetchWastageLogs();
      fetchIngredients(); // update stock view
    }
  };

  const deleteIngredient = async (id: string) => {
    if(confirm('Are you sure? This will break recipes using this ingredient.')) {
        await supabase.from('ingredients').delete().eq('id', id);
        fetchIngredients();
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('ingredients')}
          style={{ padding: '10px 20px', background: activeTab === 'ingredients' ? '#333' : '#eee', color: activeTab === 'ingredients' ? '#fff' : '#333', border: 'none', borderRadius: '4px' }}
        >
          {t('ingredients')}
        </button>
        <button 
          onClick={() => setActiveTab('recipes')}
          style={{ padding: '10px 20px', background: activeTab === 'recipes' ? '#333' : '#eee', color: activeTab === 'recipes' ? '#fff' : '#333', border: 'none', borderRadius: '4px' }}
        >
          {t('recipes')}
        </button>
        <button 
          onClick={() => setActiveTab('wastage')}
          style={{ padding: '10px 20px', background: activeTab === 'wastage' ? '#333' : '#eee', color: activeTab === 'wastage' ? '#fff' : '#333', border: 'none', borderRadius: '4px' }}
        >
          {t('wastage')}
        </button>
      </div>

      {/* --- INGREDIENTS TAB --- */}
      {activeTab === 'ingredients' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', height: 'fit-content' }}>
            <h3>{t('add_ingredient')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input 
                placeholder={t('ingredient_name')}
                value={newIngredient.name}
                onChange={e => setNewIngredient({...newIngredient, name: e.target.value})}
                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <select 
                  value={newIngredient.unit}
                  onChange={e => setNewIngredient({...newIngredient, unit: e.target.value})}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                  <option value="pcs">pcs</option>
                </select>
                <input 
                  type="number"
                  placeholder={t('cost_per_unit')}
                  value={newIngredient.cost}
                  onChange={e => setNewIngredient({...newIngredient, cost: parseFloat(e.target.value)})}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="number"
                  placeholder={t('current_stock')}
                  value={newIngredient.stock}
                  onChange={e => setNewIngredient({...newIngredient, stock: parseFloat(e.target.value)})}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
                />
                <input 
                  type="number"
                  placeholder={t('low_stock_limit')}
                  value={newIngredient.min_stock}
                  onChange={e => setNewIngredient({...newIngredient, min_stock: parseFloat(e.target.value)})}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
                />
              </div>
              <button 
                onClick={addIngredient}
                style={{ padding: '10px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                <Plus size={16} style={{ marginBottom: '-3px', marginRight: '5px' }} /> {t('add_ingredient')}
              </button>
            </div>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
            <h3>{t('ingredients')} List</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Name</th>
                  <th style={{ padding: '10px' }}>Stock</th>
                  <th style={{ padding: '10px' }}>Unit</th>
                  <th style={{ padding: '10px' }}>Cost</th>
                  <th style={{ padding: '10px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map(ing => (
                  <tr key={ing.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{ing.name}</td>
                    <td style={{ padding: '10px', color: ing.current_stock <= ing.low_stock_threshold ? 'red' : 'inherit', fontWeight: ing.current_stock <= ing.low_stock_threshold ? 'bold' : 'normal' }}>
                      {ing.current_stock}
                      {ing.current_stock <= ing.low_stock_threshold && <AlertCircle size={14} style={{ marginLeft: '5px' }} />}
                    </td>
                    <td style={{ padding: '10px' }}>{ing.unit}</td>
                    <td style={{ padding: '10px' }}>${ing.cost_per_unit}</td>
                    <td style={{ padding: '10px' }}>
                         <button onClick={() => deleteIngredient(ing.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- RECIPES TAB --- */}
      {activeTab === 'recipes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', height: 'fit-content', maxHeight: '500px', overflowY: 'auto' }}>
            <h3>Products</h3>
            {products.map(p => (
              <div 
                key={p.id} 
                onClick={() => fetchRecipe(p.id)}
                style={{ 
                  padding: '10px', 
                  borderBottom: '1px solid #eee', 
                  cursor: 'pointer',
                  background: selectedProduct === p.id ? '#e3f2fd' : 'white'
                }}
              >
                <strong>{p.products?.name}</strong> - {p.name}
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
             <h3>Recipe for Selected Product</h3>
             {!selectedProduct ? <p>Select a product to edit recipe</p> : (
               <>
                 <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
                    <select 
                      value={newRecipeItem.ingredient_id}
                      onChange={e => setNewRecipeItem({...newRecipeItem, ingredient_id: e.target.value})}
                      style={{ padding: '8px', flex: 2, border: '1px solid #ddd', borderRadius: '4px' }}
                    >
                      <option value="">Select Ingredient</option>
                      {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                    </select>
                    <input 
                      type="number"
                      placeholder="Qty"
                      value={newRecipeItem.quantity}
                      onChange={e => setNewRecipeItem({...newRecipeItem, quantity: parseFloat(e.target.value)})}
                      style={{ padding: '8px', width: '80px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <button onClick={addToRecipe} style={{ padding: '8px 15px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px' }}>Add</button>
                 </div>

                 <table style={{ width: '100%' }}>
                   <thead>
                     <tr style={{ textAlign: 'left', background: '#f9f9f9' }}>
                       <th style={{ padding: '10px' }}>Ingredient</th>
                       <th style={{ padding: '10px' }}>Quantity Required</th>
                       <th style={{ padding: '10px' }}>Unit</th>
                       <th style={{ padding: '10px' }}>Remove</th>
                     </tr>
                   </thead>
                   <tbody>
                      {recipeIngredients.map(ri => (
                        <tr key={ri.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px' }}>{ri.ingredients?.name}</td>
                          <td style={{ padding: '10px' }}>{ri.quantity_required}</td>
                          <td style={{ padding: '10px' }}>{ri.ingredients?.unit}</td>
                          <td style={{ padding: '10px' }}>
                            <button onClick={() => removeRecipeItem(ri.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
                          </td>
                        </tr>
                      ))}
                      {recipeIngredients.length === 0 && <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No ingredients linked yet.</td></tr>}
                   </tbody>
                 </table>
               </>
             )}
          </div>
        </div>
      )}

      {/* --- WASTAGE TAB --- */}
      {activeTab === 'wastage' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
           <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', height: 'fit-content' }}>
             <h3>{t('log_wastage')}</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <select 
                  value={wastageEntry.ingredient_id}
                  onChange={e => setWastageEntry({...wastageEntry, ingredient_id: e.target.value})}
                  style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">Select Ingredient</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
                
                <input 
                  type="number"
                  placeholder="Quantity Wasted"
                  value={wastageEntry.quantity}
                  onChange={e => setWastageEntry({...wastageEntry, quantity: parseFloat(e.target.value)})}
                  style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                />

                <select 
                   value={wastageEntry.reason}
                   onChange={e => setWastageEntry({...wastageEntry, reason: e.target.value})}
                   style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="Expired">Expired</option>
                  <option value="Spilled">Spilled/Damaged</option>
                  <option value="Mistake">Order Mistake</option>
                  <option value="Other">Other</option>
                </select>

                <button onClick={logWastage} style={{ padding: '12px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                  Log Wastage & Deduct Stock
                </button>
             </div>
           </div>

           <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
             <h3>Wastage History</h3>
             <table style={{ width: '100%', borderCollapse: 'collapse' }}>
               <thead>
                 <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                   <th style={{ padding: '10px' }}>Date</th>
                   <th style={{ padding: '10px' }}>Ingredient</th>
                   <th style={{ padding: '10px' }}>Qty Wasted</th>
                   <th style={{ padding: '10px' }}>Reason</th>
                 </tr>
               </thead>
               <tbody>
                 {wastageLogs.map(log => (
                   <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                     <td style={{ padding: '10px' }}>{new Date(log.created_at).toLocaleDateString()}</td>
                     <td style={{ padding: '10px' }}>{log.ingredients?.name}</td>
                     <td style={{ padding: '10px' }}>{log.quantity_wasted} {log.ingredients?.unit}</td>
                     <td style={{ padding: '10px' }}>{log.reason}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}
    </div>
  );
}