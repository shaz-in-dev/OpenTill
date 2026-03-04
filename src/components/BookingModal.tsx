import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Clock, User, CheckCircle, AlertTriangle } from 'lucide-react';
import { BookingService } from '../services/BookingService';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function BookingModal({ onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('19:00');
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ tableId: string; duration: number } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessInfo(null);

    try {
      // This calls the "Brain" -> Checks Pacing, Finds Table, Calculates Duration
      const result = await BookingService.createBooking({
        customerName,
        partySize,
        date,
        time
      });

      setSuccessInfo({ tableId: result.tableId, duration: result.duration });
      
      // Auto close after 2 seconds
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);

    } catch (err: any) {
      // Handle logic errors (e.g., "Kitchen capacity reached")
      setError(err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content" style={{ maxWidth: '500px', width: '90%', textAlign: 'left' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>📅 {t('new_booking')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <X size={24} />
          </button>
        </div>

        {/* Success Message */}
        {successInfo ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--success-color)' }}>
            <CheckCircle size={64} style={{ marginBottom: '15px' }} />
            <h3>Booking Confirmed!</h3>
            <p>Table allocated automatically.</p>
            <p>Duration: {successInfo.duration} minutes.</p>
          </div>
        ) : (
          /* Booking Form */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* Error Banner */}
            {error && (
              <div style={{ 
                padding: '12px', 
                background: '#ffebee', 
                color: '#c62828', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                fontSize: '0.9rem'
              }}>
                <AlertTriangle size={18} />
                {error}
              </div>
            )}

            {/* Inputs */}
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Customer Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#999' }} />
                <input 
                  type="text" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Doe"
                  required
                  style={{ 
                    width: '100%', padding: '10px 10px 10px 35px', 
                    borderRadius: '8px', border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)'
                  }} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date</label>
                    <div style={{ position: 'relative' }}>
                        <Calendar size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#999' }} />
                        <input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)}
                        required
                        style={{ 
                            width: '100%', padding: '10px 10px 10px 35px', 
                            borderRadius: '8px', border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)', color: 'var(--text-primary)'
                        }} 
                        />
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Time</label>
                    <div style={{ position: 'relative' }}>
                        <Clock size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#999' }} />
                        <input 
                        type="time" 
                        value={time} 
                        onChange={(e) => setTime(e.target.value)}
                        required
                        style={{ 
                            width: '100%', padding: '10px 10px 10px 35px', 
                            borderRadius: '8px', border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)', color: 'var(--text-primary)'
                        }} 
                        />
                    </div>
                </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Party Size (Covers)</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[2, 4, 6, 8].map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPartySize(size)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: `1px solid ${partySize === size ? 'var(--primary-color)' : 'var(--border-color)'}`,
                      background: partySize === size ? 'var(--primary-color)' : 'var(--bg-primary)',
                      color: partySize === size ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <input 
                  type="number"
                  min="1"
                  max="20"
                  value={partySize}
                  onChange={(e) => setPartySize(parseInt(e.target.value))}
                  style={{
                      marginTop: '10px',
                      width: '100%', padding: '8px', 
                      borderRadius: '8px', border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)', color: 'var(--text-primary)',
                      textAlign: 'center'
                  }}
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              style={{
                marginTop: '10px',
                padding: '15px',
                background: 'var(--success-color)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px'
              }}
            >
              {loading ? 'Checking Availability...' : 'Confirm Booking'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
