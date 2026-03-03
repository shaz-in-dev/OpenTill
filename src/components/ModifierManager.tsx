import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Trash2, Plus, X } from 'lucide-react'

interface Props {
  productId: string
  productName: string
  onClose: () => void
}

export default function ModifierManager({ productId, productName, onClose }: Props) {
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // New Group State
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupMin, setNewGroupMin] = useState(0)
  const [newGroupMax, setNewGroupMax] = useState(1)
  const [newGroupRequired, setNewGroupRequired] = useState(false)

  // New Modifier State (keyed by group ID to allow adding to multiple groups)
  const [newModifiers, setNewModifiers] = useState<Record<string, { name: string, price: number }>>({})

  useEffect(() => {
    fetchGroups()
  }, [productId])

  const fetchGroups = async () => {
    setLoading(true)
    const { data: groupsData } = await supabase
      .from('modifier_groups')
      .select('*, modifiers(*)')
      .eq('product_id', productId)
      .order('created_at')
    
    setGroups(groupsData || [])
    setLoading(false)
  }

  const addGroup = async () => {
    if (!newGroupName) return
    const { error } = await supabase.from('modifier_groups').insert({
      product_id: productId,
      name: newGroupName,
      min_selection: newGroupMin,
      max_selection: newGroupMax,
      required: newGroupRequired
    })

    if (!error) {
      setNewGroupName('')
      fetchGroups()
    }
  }

  const deleteGroup = async (id: string) => {
    if (confirm('Delete this modifier group?')) {
        await supabase.from('modifier_groups').delete().eq('id', id)
        fetchGroups()
    }
  }

  const addModifier = async (groupId: string) => {
    const mod = newModifiers[groupId]
    if (!mod || !mod.name) return

    const { error } = await supabase.from('modifiers').insert({
      group_id: groupId,
      name: mod.name,
      price_adjustment: mod.price
    })

    if (!error) {
      setNewModifiers({ ...newModifiers, [groupId]: { name: '', price: 0 } })
      fetchGroups()
    }
  }

  const deleteModifier = async (id: string) => {
     await supabase.from('modifiers').delete().eq('id', id)
     fetchGroups()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
       <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '600px', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
          
          <h2>Modifiers for {productName}</h2>
          
          <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
             <h4>Add Modifier Group</h4>
             <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input placeholder="Group Name (e.g. Toppings)" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} style={{ flex: 2, padding: '8px' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={newGroupRequired} onChange={e => setNewGroupRequired(e.target.checked)} /> Required
                </label>
             </div>
             <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label>Min: <input type="number" value={newGroupMin} onChange={e => setNewGroupMin(parseInt(e.target.value))} style={{ width: '50px', padding: '5px' }} /></label>
                <label>Max: <input type="number" value={newGroupMax} onChange={e => setNewGroupMax(parseInt(e.target.value))} style={{ width: '50px', padding: '5px' }} /></label>
                <button onClick={addGroup} style={{ background: '#333', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>Add Group</button>
             </div>
          </div>

          <div>
             {groups.map(g => (
               <div key={g.id} style={{ border: '1px solid #eee', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                      <strong>{g.name} (Select {g.min_selection}-{g.max_selection}) {g.required ? '*' : ''}</strong>
                      <button onClick={() => deleteGroup(g.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0 }}>
                      {g.modifiers?.map((m: any) => (
                          <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #eee' }}>
                             <span>{m.name} (+${(m.price_adjustment / 100).toFixed(2)})</span>
                             <button onClick={() => deleteModifier(m.id)} style={{ color: '#aaa', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                          </li>
                      ))}
                  </ul>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                     <input 
                       placeholder="Option Name" 
                       value={newModifiers[g.id]?.name || ''} 
                       onChange={e => setNewModifiers({...newModifiers, [g.id]: { ...(newModifiers[g.id] || {price: 0}), name: e.target.value }})} 
                       style={{ flex: 2, padding: '5px' }}
                     />
                     <input 
                       type="number" 
                       placeholder="Price (cents)" 
                       value={newModifiers[g.id]?.price || 0} 
                       onChange={e => setNewModifiers({...newModifiers, [g.id]: { ...(newModifiers[g.id] || {name: ''}), price: parseInt(e.target.value) }})} 
                       style={{ flex: 1, padding: '5px' }}
                     />
                     <button onClick={() => addModifier(g.id)} style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}><Plus size={14} /></button>
                  </div>
               </div>
             ))}
          </div>
       </div>
    </div>
  )
}
