import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Gift, CreditCard, RotateCcw, Search, PlusCircle } from 'lucide-react';

export default function GiftCardManager() {
  const [activeTab, setActiveTab] = useState<'cards' | 'issue'>('cards');
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Issue Form
  const [newCode, setNewCode] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  useEffect(() => {
    fetchGiftCards();
  }, []);

  const fetchGiftCards = async () => {
    setLoading(true);
    let query = supabase.from('gift_cards').select('*').order('created_at', { ascending: false });
    if (search) {
      query = query.ilike('code', `%${search}%`);
    }
    const { data } = await query;
    if (data) setGiftCards(data);
    setLoading(false);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, I, 1 for clarity
    let result = '';
    for (let i = 0; i < 12; i++) {
        if(i > 0 && i % 4 === 0) result += '-';
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode(result);
  };

  const issueGiftCard = async () => {
    if (!newCode || !initialBalance) return alert("Code and Balance are required");

    const { error } = await supabase.from('gift_cards').insert([{
      code: newCode,
      balance: parseFloat(initialBalance),
      expiry_date: expiryDate ? new Date(expiryDate) : null,
      status: 'ACTIVE'
    }]);

    if (error) {
        alert("Error creating card: " + error.message);
    } else {
      // Log creation as 'ISSUE' transaction
      await supabase.from('gift_card_transactions').insert({
          card_code: newCode,
          amount: parseFloat(initialBalance),
          transaction_type: 'ISSUE'
      });

      alert("Gift Card Issued Successfully!");
      setNewCode('');
      setInitialBalance('');
      setActiveTab('cards');
      fetchGiftCards();
    }
  };

  const rechargeCard = async (code: string) => {
    const amount = prompt(`Enter amount to add to ${code}:`);
    if (!amount || isNaN(parseFloat(amount))) return;

    const val = parseFloat(amount);
    
    // Update Balance
    const { error } = await supabase.rpc('increment_gift_card_balance', { 
        card_code_input: code, 
        amount_input: val 
    });

    // If RPC doesn't exist yet, do it manually for now (though RPC is better for atomicity)
    // We will use a manual update here since I haven't defined increment_gift_card_balance in schema yet
    // Actually, let's just do a manual update + insert for simplicity in this MVP
    
    const { data: card } = await supabase.from('gift_cards').select('balance').eq('code', code).single();
    if(!card) return;

    const newBal = (card.balance || 0) + val;
    
    const { error: updateErr } = await supabase.from('gift_cards').update({ balance: newBal }).eq('code', code);
    
    if(!updateErr) {
        await supabase.from('gift_card_transactions').insert({
            card_code: code,
            amount: val,
            transaction_type: 'RECHARGE'
        });
        fetchGiftCards();
        alert("Recharged Successfully");
    } else {
        alert("Error recharging: " + updateErr.message);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Gift /> Gift Card Management
            </h2>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                    onClick={() => setActiveTab('cards')}
                    style={{ 
                        padding: '10px 20px', background: activeTab === 'cards' ? '#333' : '#eee', 
                        color: activeTab === 'cards' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' 
                    }}
                >
                    All Cards
                </button>
                <button 
                    onClick={() => setActiveTab('issue')}
                    style={{ 
                        padding: '10px 20px', background: activeTab === 'issue' ? '#2e7d32' : '#eee', 
                        color: activeTab === 'issue' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                >
                    <PlusCircle size={16} /> Issue New Card
                </button>
            </div>
        </div>

        {activeTab === 'issue' && (
            <div style={{ background: '#f9f9f9', padding: '25px', borderRadius: '8px', border: '1px solid #eee', maxWidth: '500px', margin: '0 auto' }}>
                <h3 style={{ marginTop: 0 }}>Issue Physical/Digital Card</h3>
                
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Card Code / Number</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                            value={newCode} 
                            onChange={e => setNewCode(e.target.value.toUpperCase())} 
                            placeholder="SCAN OR TYPE CODE" 
                            style={{ flex: 1, padding: '10px', fontSize: '1.1rem', letterSpacing: '2px', border: '1px solid #ccc', borderRadius: '4px' }} 
                        />
                        <button onClick={generateCode} style={{ padding: '10px', cursor: 'pointer' }} title="Generate Random Code">🎲</button>
                    </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Initial Balance ($)</label>
                    <input 
                        type="number" 
                        value={initialBalance} 
                        onChange={e => setInitialBalance(e.target.value)} 
                        placeholder="0.00" 
                        style={{ width: '100%', padding: '10px', fontSize: '1.2rem', border: '1px solid #ccc', borderRadius: '4px' }} 
                    />
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Expiry (Optional)</label>
                    <input 
                        type="date" 
                        value={expiryDate} 
                        onChange={e => setExpiryDate(e.target.value)} 
                        style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} 
                    />
                </div>

                <button 
                    onClick={issueGiftCard}
                    style={{ width: '100%', padding: '15px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    Activate Card
                </button>
            </div>
        )}

        {activeTab === 'cards' && (
            <div>
                <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '10px', top: '12px', color: '#888' }} />
                        <input 
                            placeholder="Search by Card Number..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchGiftCards()}
                            style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '25px', border: '1px solid #ddd', fontSize: '1rem' }}
                        />
                    </div>
                    <button onClick={fetchGiftCards} style={{ padding: '10px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: '25px', cursor: 'pointer' }}>Search</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                    {giftCards.map(card => (
                        <div key={card.code} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={{ background: card.status === 'ACTIVE' ? '#e8f5e9' : '#ffebee', color: card.status === 'ACTIVE' ? '#2e7d32' : '#c62828', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    {card.status}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>
                                    Exp: {card.expiry_date ? new Date(card.expiry_date).toLocaleDateString() : 'Never'}
                                </span>
                            </div>
                            
                            <div style={{ fontSize: '1.4rem', fontFamily: 'monospace', letterSpacing: '1px', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
                                {card.code}
                            </div>
                            
                            <div style={{ fontSize: '2rem', color: '#1565c0', fontWeight: 'bold', marginBottom: '15px' }}>
                                ${card.balance.toFixed(2)}
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button 
                                    onClick={() => rechargeCard(card.code)}
                                    style={{ flex: 1, padding: '8px', background: '#fff', border: '1px solid #1565c0', color: '#1565c0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 'bold' }}
                                >
                                    <PlusCircle size={16} /> Recharge
                                </button>
                                <button 
                                    style={{ flex: 1, padding: '8px', background: '#f5f5f5', border: '1px solid #ddd', color: '#555', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                    onClick={() => alert("History feature coming soon")}
                                >
                                    <RotateCcw size={16} /> History
                                </button>
                            </div>
                        </div>
                    ))}
                    {giftCards.length === 0 && !loading && (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#999', gridColumn: '1 / -1' }}>No gift cards found. Issue one to get started.</div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}
