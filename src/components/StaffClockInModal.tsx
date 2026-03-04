import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useTranslation } from 'react-i18next';
import { Clock, User as UserIcon, LogIn, LogOut, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function StaffClockInModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [pin, setPin] = useState('');
  const [activeShift, setActiveShift] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    if (selectedStaff) {
      checkActiveShift(selectedStaff);
    } else {
      setActiveShift(null);
      setMessage('');
    }
  }, [selectedStaff]);

  const fetchStaff = async () => {
    // Fetching from staff_directory. 
    // Assuming 'email' serves as the display name for now if name isn't there
    const { data } = await supabase.from('staff_directory').select('*');
    if (data) setStaffList(data);
  };

  const checkActiveShift = async (userId: string) => {
    setMessage('');
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .single();
    
    if (data) {
      setActiveShift(data);
    } else {
      setActiveShift(null);
    }
  };

  const handleClockAction = async () => {
    if (!selectedStaff) return;
    // In a real app, verify PIN here against the staff record
    // For this demo, we assume PIN = '1234' or match staff password
    
    setLoading(true);

    try {
        if (activeShift) {
            // CLOCK OUT
            const now = new Date();
            const start = new Date(activeShift.clock_in);
            const hours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
            
            // Assume dummy rate of $15/hr if not in DB
            const rate = 15; 
            const pay = hours * rate;

            const { error } = await supabase
                .from('shifts')
                .update({ 
                    clock_out: now.toISOString(),
                    status: 'COMPLETED',
                    total_pay: pay
                })
                .eq('id', activeShift.id);

            if (error) throw error;
            setMessage(`✅ Clocked Out! Duration: ${hours.toFixed(2)} hrs`);
            setTimeout(onClose, 2000);
        } else {
            // CLOCK IN
            const user = staffList.find(s => s.id === selectedStaff);
            const { error } = await supabase.from('shifts').insert({
                user_id: selectedStaff,
                staff_name: user?.email || 'Unknown',
                hourly_rate: 15, // Default snapshot
                status: 'ACTIVE'
            });

            if (error) throw error;
            setMessage(`✅ Clocked In as ${user?.email?.split('@')[0]}!`);
            setTimeout(onClose, 2000);
        }
    } catch (err: any) {
        setMessage('❌ Error: ' + err.message);
    } finally {
        setLoading(false);
        checkActiveShift(selectedStaff); // Refresh status
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{
        background: 'white', padding: '30px', borderRadius: '12px', width: '400px', maxWidth: '90%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)', position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} />
        </button>

        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}>
            <Clock /> Staff Time Clock
        </h2>

        <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Select Staff Member</label>
            <select 
                value={selectedStaff} 
                onChange={e => setSelectedStaff(e.target.value)}
                style={{ width: '100%', padding: '12px', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }}
            >
                <option value="">-- Choose Name --</option>
                {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.email}</option>
                ))}
            </select>
        </div>

        {selectedStaff && (
            <div style={{ textAlign: 'center' }}>
                <div style={{ padding: '15px', background: activeShift ? '#e8f5e9' : '#eceff1', borderRadius: '8px', marginBottom: '20px' }}>
                    Status: <strong style={{ color: activeShift ? '#2e7d32' : '#546e7a' }}>
                        {activeShift ? `CLOCKED IN (${new Date(activeShift.clock_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})` : 'CLOCKED OUT'}
                    </strong>
                </div>

                {message && <div style={{ marginBottom: '15px', fontWeight: 'bold' }}>{message}</div>}

                <button 
                    onClick={handleClockAction}
                    disabled={loading}
                    style={{
                        width: '100%', padding: '15px', borderRadius: '8px', border: 'none',
                        background: activeShift ? '#d32f2f' : '#2e7d32',
                        color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px'
                    }}
                >
                    {activeShift ? <><LogOut /> Clock Out</> : <><LogIn /> Clock In</>}
                </button>
            </div>
        )}
      </div>
    </div>
  );
}
