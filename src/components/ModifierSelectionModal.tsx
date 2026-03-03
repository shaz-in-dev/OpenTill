import { useState } from 'react';

interface Modifier {
  id: string
  name: string
  price_adjustment: number
}

interface ModifierGroup {
  id: string
  name: string
  min_selection: number
  max_selection: number
  required: boolean
  modifiers: Modifier[]
}

interface Props {
  product: any
  variant: any
  onConfirm: (selectedModifiers: Modifier[]) => void
  onCancel: () => void
}

export default function ModifierSelectionModal({ product, variant, onConfirm, onCancel }: Props) {
  const [selections, setSelections] = useState<Record<string, string[]>>({}); // group_id -> modifier_id[]

  const toggleModifier = (group: ModifierGroup, modId: string) => {
    const current = selections[group.id] || [];
    const isSelected = current.includes(modId);
    
    if (isSelected) {
      setSelections({ ...selections, [group.id]: current.filter(id => id !== modId) });
    } else {
      if (group.max_selection === 1) {
        // Single select (radio behavior)
        setSelections({ ...selections, [group.id]: [modId] });
      } else {
        // Multi select check max
        if (current.length < group.max_selection) {
          setSelections({ ...selections, [group.id]: [...current, modId] });
        }
      }
    }
  };

  const calculateTotal = () => {
    let total = variant.price;
    product.modifier_groups?.forEach((g: ModifierGroup) => {
      const groupSelections = selections[g.id] || [];
      groupSelections.forEach(modId => {
        const mod = g.modifiers.find(m => m.id === modId);
        if (mod) total += mod.price_adjustment;
      });
    });
    return total;
  };

  const isValid = () => {
    // Check required groups
    return product.modifier_groups?.every((g: ModifierGroup) => {
      if (g.required) {
        const count = (selections[g.id] || []).length;
        return count >= g.min_selection;
      }
      return true;
    });
  };

  const handleConfirm = () => {
    if (!isValid()) return alert('Please complete required selections.');
    
    const flatModifiers: Modifier[] = [];
    product.modifier_groups?.forEach((g: ModifierGroup) => {
        (selections[g.id] || []).forEach(modId => {
            const mod = g.modifiers.find(m => m.id === modId);
            if (mod) flatModifiers.push(mod);
        });
    });
    
    onConfirm(flatModifiers);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2500 }}>
       <div style={{ background: 'white', padding: '25px', borderRadius: '12px', width: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
          <h2 style={{ marginTop: 0 }}>Customize {product.name}</h2>
          <p style={{ color: '#666' }}>Variant: {variant.name}</p>

          {product.modifier_groups?.map((g: ModifierGroup) => (
             <div key={g.id} style={{ marginBottom: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                   <strong>{g.name} {g.required && <span style={{ color: 'red' }}>*</span>}</strong>
                   <span style={{ fontSize: '0.8rem', color: '#666' }}>
                     {g.max_selection === 1 ? 'Select 1' : `Select ${g.min_selection}-${g.max_selection}`}
                   </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                   {g.modifiers.map(m => {
                     const isSelected = (selections[g.id] || []).includes(m.id);
                     return (
                       <div 
                         key={m.id} 
                         onClick={() => toggleModifier(g, m.id)}
                         style={{ 
                            padding: '10px', 
                            border: isSelected ? '2px solid #2e7d32' : '1px solid #ddd', 
                            borderRadius: '6px',
                            background: isSelected ? '#e8f5e9' : 'white',
                            cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between'
                         }}
                       >
                          <span>{m.name}</span>
                          {m.price_adjustment > 0 && <span style={{ color: '#666' }}>+${(m.price_adjustment/100).toFixed(2)}</span>}
                       </div>
                     );
                   })}
                </div>
             </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
             <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
               Total: ${(calculateTotal() / 100).toFixed(2)}
             </div>
             <div style={{ display: 'flex', gap: '10px' }}>
               <button onClick={onCancel} style={{ padding: '10px 20px', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
               <button onClick={handleConfirm} disabled={!isValid()} style={{ padding: '10px 20px', background: isValid() ? '#2e7d32' : '#ccc', color: 'white', border: 'none', borderRadius: '6px', cursor: isValid() ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                 Add to Order
               </button>
             </div>
          </div>
       </div>
    </div>
  );
}
