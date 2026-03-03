import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useTranslation } from 'react-i18next'; // NEW: i18n
import { ArrowLeft } from 'lucide-react'; // NEW: Icon

interface DiningTable {
  id: number
  table_number: string
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED'
}

interface Props {
  onSelect: (tableName: string) => void
  setDiningMode: (mode: boolean) => void // NEW: To go back
}

export default function TableSelection({ onSelect, setDiningMode }: Props) {
  const { t } = useTranslation(); // Hook
  const [tables, setTables] = useState<DiningTable[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch tables from the database you just set up with SQL
  useEffect(() => {
    fetchTables()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTables = async () => {
    setLoading(true)
    
    // 1. Fetch the master list of tables
    const { data: allTables, error: tableError } = await supabase
      .from('dining_tables')
      .select('*')
      .order('id', { ascending: true })

    // 2. Fetch all tables that currently have active items in their cart
    const { data: activeCarts, error: cartError } = await supabase
      .from('table_cart_items')
      .select('table_number')

    if (tableError || cartError) {
      console.error("Error fetching table status:", tableError?.message || cartError?.message)
    } else {
      // 3. Map through all tables and set status to OCCUPIED if their number exists in table_cart_items
      const occupiedTableNames = new Set(activeCarts?.map(c => c.table_number));
      // Standardize logic
      const updatedTables = allTables ? allTables.map((t: any) => ({
        ...t,
        status: occupiedTableNames.has(t.table_number) ? 'OCCUPIED' : 'AVAILABLE'
      })) : [];

      setTables(updatedTables as DiningTable[])
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', fontSize: '1.2rem' }}>
        Loading Floor Plan...
      </div>
    )
  }

  return (
    <div style={{ 
      padding: '40px', 
      textAlign: 'center', 
      height: '100%', 
      overflowY: 'auto',
      boxSizing: 'border-box',
      background: '#f9f9f9',
      position: 'relative' // For absolute positioning of Back button
    }}>
      {/* Back Button to Quick Service */}
      <button 
        onClick={() => setDiningMode(false)}
        style={{
          position: 'absolute',
          top: '40px',
          left: '40px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 15px',
          border: '1px solid #ddd',
          background: 'white',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          color: '#555'
        }}
      >
        <ArrowLeft size={18} />
        {t('quick_service')}
      </button>

      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '2.5rem', fontWeight: '800' }}>{t('dining_mode')}</h1>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>{t('select_table')}</p>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
        gap: '25px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {tables.length === 0 ? (
          <p style={{ gridColumn: '1/-1', color: '#999' }}>No tables configured in database.</p>
        ) : (
          tables.map(table => (
            <button 
              key={table.id} 
              onClick={() => onSelect(table.table_number)}
              // Note: We removed the 'disabled' attribute so you can switch back into an OCCUPIED table to add more items
              style={{ 
                padding: '45px 20px', 
                fontSize: '1.3rem', 
                fontWeight: 'bold', 
                borderRadius: '20px', 
                border: '2px solid',
                borderColor: table.status === 'AVAILABLE' ? '#eee' : '#ffcdd2', 
                background: table.status === 'AVAILABLE' ? 'white' : '#ffebee',
                color: table.status === 'AVAILABLE' ? '#111' : '#c62828',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}
              // Hover effect logic handled via CSS generally, but inline style override for simple hover is tricky in React without state/css modules. 
              // We'll keep it simple or use CSS class if possible, but inline for now.
            >
              {table.table_number}
              <span style={{ 
                fontSize: '0.7rem', 
                textTransform: 'uppercase', 
                letterSpacing: '1px',
                padding: '4px 8px',
                borderRadius: '4px',
                background: table.status === 'AVAILABLE' ? '#e8f5e9' : '#ffcdd2',
                color: table.status === 'AVAILABLE' ? '#2e7d32' : '#c62828'
              }}>
                {table.status}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div style={{ marginTop: '50px', color: '#aaa', fontSize: '0.9rem' }}>
        Table configurations can be managed in the Admin Dashboard.
      </div>
    </div>
  )
}