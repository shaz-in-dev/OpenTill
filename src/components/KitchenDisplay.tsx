import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { db } from '../utils/offlineDb'; // Offline Support

interface KitchenTicket {
  id: number;
  table_number: string;
  items: { name: string; qty: number; modifiers?: any[]; void?: boolean; status?: 'PENDING' | 'READY' }[]; 
  status: 'PENDING' | 'COMPLETED' | 'VOIDED';
  created_at: string;
  is_offline?: boolean; // Use to differentiate
}

export default function KitchenDisplay() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now()); // NEW: State for the 30s ticker

  useEffect(() => {
    fetchActiveTickets();

    // NEW: Ticker that updates current time every 30 seconds
    const ticker = setInterval(() => {
      setNow(Date.now());
    }, 30000); 

    // FIXED REAL-TIME SUBSCRIPTION: Listen for ALL changes (Insert, Update, Delete)
    const channel = supabase
      .channel('kitchen_orders_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kitchen_tickets' },
        () => {
          // Re-fetch everything whenever ANY change happens to ensure status sync
          fetchActiveTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(ticker); // Clean up the interval
    };
  }, []);

  const fetchActiveTickets = async () => {
    // 1. Fetch Remote Tickets
    const { data: remoteData, error } = await supabase
      .from('kitchen_tickets')
      .select('*')
      .in('status', ['PENDING', 'VOIDED']) 
      .order('created_at', { ascending: true });

    // 2. Fetch Local Offline Tickets
    const localData = await db.kitchenTickets
        .where('status')
        .notEqual('COMPLETED')
        .toArray();

    // 3. Merge and Sort
    // We treat local tickets as valid.
    const allTickets = [
        ...(remoteData || []),
        ...(localData || []).map(t => ({...t, is_offline: true, items: t.items || []}))
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (!error) {
      if (allTickets.length > tickets.length) {
         playNotificationSound();
      }
      setTickets(allTickets as KitchenTicket[]);
    }
    setLoading(false);
  };

  // --- NEW: Handle Partial Completion (Tap Item) ---
  const toggleItemStatus = async (ticket: KitchenTicket, itemIndex: number) => {
    const newItems = [...ticket.items];
    const currentStatus = newItems[itemIndex].status;
    
    // Toggle between PENDING and READY
    newItems[itemIndex].status = currentStatus === 'READY' ? 'PENDING' : 'READY';

    if (ticket.is_offline) {
        await db.kitchenTickets.update(ticket.id, { items: newItems });
    } else {
        const { error } = await supabase
        .from('kitchen_tickets')
        .update({ items: newItems })
        .eq('id', ticket.id);
    }

    fetchActiveTickets();
  };

  const playNotificationSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(() => console.log("Audio play blocked by browser. Click screen once."));
  };

  const handleComplete = async (id: number, isOffline = false) => {
    if (isOffline) {
        await db.kitchenTickets.update(id, { status: 'COMPLETED' });
    } else {
        // Marking as COMPLETED removes it from this view
        const { error } = await supabase
        .from('kitchen_tickets')
        .update({ status: 'COMPLETED' })
        .eq('id', id);
    }
    
    fetchActiveTickets();
  };

  const getTimeElapsed = (createdAt: string) => {
    const start = new Date(createdAt).getTime();
    const diff = Math.max(0, Math.floor((now - start) / 1000 / 60)); // Uses 'now' state
    return diff;
  };

  if (loading) return <div style={fullScreenCenter}>Loading Kitchen Feed...</div>;

  return (
    <div style={kdsContainer}>
      {/* HEADER */}
      <div style={kdsHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '2px' }}>OPENTILL KDS</h1>
          <span style={liveIndicator}>● LIVE FEED</span>
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
          {tickets.length} ACTIVE TICKETS
        </div>
      </div>

      {/* TICKET GRID */}
      <div style={ticketGrid}>
        {tickets.length === 0 ? (
          <div style={emptyState}>
            <h2>KITCHEN IS CLEAR</h2>
            <p>New orders will appear here automatically.</p>
          </div>
        ) : (
          tickets.map((ticket) => {
            const minutes = getTimeElapsed(ticket.created_at);
            const isLate = minutes >= 10;
            const isVoidedTicket = ticket.status === 'VOIDED'; // Check ticket-level void

            return (
              <div 
                key={`${ticket.is_offline ? 'local' : 'remote'}-${ticket.id}`} 
                style={{
                  ...ticketCard,
                  borderColor: isVoidedTicket ? '#b71c1c' : (isLate ? '#d32f2f' : '#2e7d32'),
                  opacity: isVoidedTicket ? 0.8 : 1,
                  animation: 'slideIn 0.3s ease-out'
                }}
              >
                {/* TICKET HEADER */}
                <div style={{ 
                  ...ticketHeader, 
                  background: isVoidedTicket ? '#b71c1c' : (isLate ? '#d32f2f' : '#2e7d32') 
                }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: '900' }}>{ticket.table_number}</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {isVoidedTicket ? 'CANCELLED' : `${minutes}m ago`}
                  </span>
                </div>

                {/* TICKET ITEMS */}
                <div style={ticketBody}>
                  {ticket.items.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => !isVoidedTicket && toggleItemStatus(ticket, idx)} // Tap for partial complete
                      style={{
                        ...itemRow,
                        cursor: isVoidedTicket ? 'default' : 'pointer',
                        textDecoration: (item.void || isVoidedTicket || item.status === 'READY') ? 'line-through' : 'none',
                        color: (item.void || isVoidedTicket) ? '#d32f2f' : (item.status === 'READY' ? '#85ad4e' : '#fff'),
                        borderLeft: item.status === 'READY' ? '5px solid #85ad4e' : 'none',
                        opacity: item.status === 'READY' ? 0.6 : 1
                      }}
                    >
                      <span style={itemQty}>{item.qty}x</span>
                      <span style={itemName}>{item.name}</span>
                      {item.status === 'READY' && <span style={{fontSize: '0.7rem', color: '#85ad4e', marginLeft: 'auto'}}>READY</span>}
                      {(item.void || isVoidedTicket) && <span style={voidTag}>VOID</span>}
                    </div>
                  ))}
                </div>

                {/* ACTION BUTTON */}
                <button 
                  onClick={() => handleComplete(ticket.id, ticket.is_offline)}
                  style={{
                    ...completeBtn,
                    background: isVoidedTicket ? '#444' : '#333'
                  }}
                >
                  {isVoidedTicket ? 'ACKNOWLEDGE VOID' : 'COMPLETE'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- STYLES (Unchanged) ---
const kdsContainer: React.CSSProperties = { background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: '"Roboto Mono", monospace', padding: '20px', boxSizing: 'border-box' };
const kdsHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#1a1a1a', borderRadius: '8px', marginBottom: '30px', border: '1px solid #333' };
const liveIndicator: React.CSSProperties = { color: '#4caf50', fontSize: '0.9rem', fontWeight: 'bold', animation: 'pulse 2s infinite' };
const ticketGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' };
const ticketCard: React.CSSProperties = { background: '#1a1a1a', borderRadius: '12px', border: '2px solid', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' };
const ticketHeader: React.CSSProperties = { padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' };
const ticketBody: React.CSSProperties = { padding: '20px', flexGrow: 1, minHeight: '150px' };
const itemRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.3rem', marginBottom: '10px', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' };
const itemQty: React.CSSProperties = { fontWeight: 'bold', color: '#ffeb3b' };
const itemName: React.CSSProperties = { fontWeight: 'bold' };
const voidTag: React.CSSProperties = { fontSize: '0.7rem', background: '#d32f2f', color: 'white', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto' };
const completeBtn: React.CSSProperties = { width: '100%', padding: '20px', color: 'white', border: 'none', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', transition: '0.2s', borderTop: '1px solid #444' };
const fullScreenCenter: React.CSSProperties = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0a0a0a', color: '#fff', fontSize: '1.5rem' };
const emptyState: React.CSSProperties = { gridColumn: '1/-1', textAlign: 'center', padding: '100px', color: '#444' };