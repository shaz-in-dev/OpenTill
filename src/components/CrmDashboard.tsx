import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useTranslation } from 'react-i18next';
import { User, Phone, Mail, Award, Clock, DollarSign, Search, Plus, Trash2 } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  loyalty_points: number;
  total_spend: number;
  last_visit: string;
}

export default function CrmDashboard() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Create Form State
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('last_visit', { ascending: false });
    
    if (error) console.error('Error fetching customers:', error);
    else setCustomers(data || []);
    setLoading(false);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return alert('Name is required');

    const { error } = await supabase.from('customers').insert({
      name: newName,
      email: newEmail || null,
      phone: newPhone || null,
      loyalty_points: 0,
      total_spend: 0
    });

    if (error) {
      alert('Error creating customer: ' + error.message);
    } else {
      alert('Customer added!');
      setIsCreating(false);
      setNewName(''); setNewEmail(''); setNewPhone('');
      fetchCustomers();
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div style={{ padding: '20px', display: 'flex', gap: '30px', height: '100%', alignItems: 'flex-start' }}>
      
      {/* LEFT: Customer List */}
      <div style={{ flex: 1, background: '#fff', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '70vh' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>👥 Customers</h3>
          <button 
            onClick={() => setIsCreating(true)} 
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#000', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            <Plus size={16} /> New
          </button>
        </div>
        
        <div style={{ padding: '15px', background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input 
              placeholder="Search customers..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }} 
            />
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div> : (
            filteredCustomers.map(c => (
              <div 
                key={c.id} 
                onClick={() => setSelectedCustomer(c)}
                style={{ 
                  padding: '15px 20px', borderBottom: '1px solid #eee', cursor: 'pointer',
                  background: selectedCustomer?.id === c.id ? '#e3f2fd' : 'white',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#333' }}>{c.name}</div>
                <div style={{ display: 'flex', gap: '15px', fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                  {c.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {c.phone}</span>}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2e7d32', fontWeight: 'bold' }}><Award size={12} /> {c.loyalty_points} pts</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Detail View or Create Form */}
      <div style={{ flex: 1.5 }}>
        {isCreating ? (
          <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Add New Customer</h2>
              <button onClick={() => setIsCreating(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Full Name *</label>
                <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} placeholder="John Doe" />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Email</label>
                <input style={inputStyle} value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="john@example.com" />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Phone</label>
                <input style={inputStyle} value={newPhone} onChange={e => setNewPhone(e.target.value)} type="tel" placeholder="(555) 123-4567" />
              </div>
              <button type="submit" style={{ width: '100%', padding: '12px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Save Customer</button>
            </form>
          </div>
        ) : selectedCustomer ? (
          <div style={{ background: '#fff', padding: '0', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e88e5 0%, #1565c0 100%)', color: 'white', padding: '30px' }}>
              <h1 style={{ margin: '0 0 10px 0', fontSize: '2rem' }}>{selectedCustomer.name}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', opacity: 0.9 }}>
                 {selectedCustomer.email && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={16} /> {selectedCustomer.email}</div>}
                 {selectedCustomer.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={16} /> {selectedCustomer.phone}</div>}
              </div>
            </div>

            <div style={{ padding: '30px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              <div style={statCardStyle}>
                <div style={{ color: '#f57f17' }}><Award size={32} /></div>
                <div>
                   <div style={statLabelStyle}>Loyalty Points</div>
                   <div style={statValueStyle}>{selectedCustomer.loyalty_points}</div>
                </div>
              </div>
              <div style={statCardStyle}>
                <div style={{ color: '#2e7d32' }}><DollarSign size={32} /></div>
                <div>
                   <div style={statLabelStyle}>Lifetime Spend</div>
                   <div style={statValueStyle}>${(selectedCustomer.total_spend / 100).toFixed(2)}</div>
                </div>
              </div>
              <div style={statCardStyle}>
                <div style={{ color: '#1565c0' }}><Clock size={32} /></div>
                <div>
                   <div style={statLabelStyle}>Last Visit</div>
                   <div style={{ ...statValueStyle, fontSize: '1.2rem' }}>{new Date(selectedCustomer.last_visit).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
            
            <div style={{ padding: '0 30px 30px 30px' }}>
              <h3>📝 Recent Activity</h3>
              <p style={{ color: '#888', fontStyle: 'italic' }}>Transaction history coming soon...</p>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
            <User size={64} style={{ marginBottom: '20px', opacity: 0.2 }} />
            <h3>Select a customer to view details</h3>
          </div>
        )}
      </div>

    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' as const };
const statCardStyle = { background: '#f8f9fa', padding: '20px', borderRadius: '10px', display: 'flex', gap: '15px', alignItems: 'center' };
const statLabelStyle = { fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' as const, fontWeight: 'bold' as const, marginBottom: '5px' };
const statValueStyle = { fontSize: '1.5rem', fontWeight: 'bold' as const, color: '#333' };
