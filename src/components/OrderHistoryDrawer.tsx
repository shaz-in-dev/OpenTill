import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
  branchId: string | null;
}

export default function OrderHistoryDrawer({ onClose, branchId }: Props) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentOrders();
  }, []);

  const fetchRecentOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, total_amount, payment_method, status, created_at, order_items(quantity, product_name_snapshot)')
      .order('created_at', { ascending: false })
      .limit(20);
    setOrders(data || []);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', maxWidth: '90vw',
          background: 'var(--bg-primary, #fff)', boxShadow: '-4px 0 20px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', zIndex: 1001, animation: 'slideInRight 0.3s ease-out'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--border-color, #eee)' }}>
          <h2 style={{ margin: 0 }}>{t('recent_orders')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}><X size={24} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '15px 20px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#888' }}>{t('loading')}...</p>
          ) : orders.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888' }}>{t('no_orders')}</p>
          ) : (
            orders.map(order => (
              <div key={order.id} style={{
                padding: '12px', marginBottom: '10px', border: '1px solid var(--border-color, #eee)',
                borderRadius: '8px', opacity: order.status === 'VOIDED' ? 0.5 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#1a73e8', fontSize: '0.85rem' }}>#{order.id.split('-')[0].toUpperCase()}</span>
                    {order.status === 'VOIDED' && <span style={{ marginLeft: '6px', color: '#d32f2f', fontSize: '0.7rem', fontWeight: 'bold' }}>VOIDED</span>}
                  </div>
                  <span style={{ fontWeight: 'bold' }}>${((order.total_amount || 0) / 100).toFixed(2)}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>
                  {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {order.payment_method}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                  {order.order_items?.map((item: any, i: number) => (
                    <span key={i}>{i > 0 ? ', ' : ''}{item.quantity}x {item.product_name_snapshot}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
