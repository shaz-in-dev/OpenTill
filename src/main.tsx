import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { supabase } from './supabaseClient'
import Root from './Root'
import AdminDashboard from './AdminDashboard'
import Login from './components/Login'
import KitchenDisplay from './components/KitchenDisplay' // New: KDS Screen
import CustomerMenu from './components/CustomerMenu' // New: Online Ordering
import './i18n'; // Import i18n configuration
import './App.css'

function App() {
  const [session, setSession] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      else setLoading(false)
    })

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      else {
        setUserRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', userId)
      .single()
    
    setUserRole(data?.role || 'cashier') 
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/" 
  }

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading System...</div>

  if (!session) return <Login />

  const path = window.location.pathname

  // KITCHEN PAGE ROUTE
  if (path === '/kitchen') {
    return <KitchenDisplay />
  }

  // CUSTOMER MENU ROUTE (No Auth Required)
  if (path === '/order') {
    return <CustomerMenu />
  }

  // ADMIN PAGE ACCESS CONTROL
  if (path === '/admin') {
    if (userRole !== 'manager') {
      return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
          <h1>⛔ Access Denied</h1>
          <p>Only Managers can view this page.</p>
          <a href="/" style={{ color: 'blue' }}>Go Back to Till</a>
        </div>
      )
    }
    return <AdminDashboard />
  }

  // POS PAGE RENDER
  return (
    <div className="app-container">
      {/* --- BRANDED TOP HEADER --- */}
      <div style={{ 
        background: '#1a1a1a', 
        color: 'white', 
        padding: '12px 25px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        fontFamily: 'sans-serif',
        zIndex: 100
      }}>
        {/* BRAND NAME */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px' }}>
            OPENTILL<span style={{ color: '#85ad4e' }}>.</span>
          </span>
          <div style={{ height: '18px', width: '1px', background: '#444' }}></div>
          <span style={{ fontSize: '13px', color: '#888', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px' }}>
            POS System
          </span>
        </div>

        {/* USER INFO & NAVIGATION */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
          <div style={{ fontSize: '14px' }}>
            <span style={{ color: '#666' }}>User:</span> 
            <span style={{ marginLeft: '6px', fontWeight: '600' }}>{session.user.email}</span>
            <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#333', borderRadius: '4px', fontSize: '11px', color: '#aaa' }}>
                {userRole?.toUpperCase()}
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {userRole === 'manager' && (
               <a href="/admin" style={{ 
                 color: 'white', 
                 textDecoration: 'none', 
                 fontWeight: 'bold', 
                 fontSize: '13px',
                 background: '#2e7d32',
                 padding: '6px 14px',
                 borderRadius: '5px',
                 transition: '0.2s'
               }}>
                 ⚙️ Dashboard
               </a>
            )}
            <button 
              onClick={handleLogout}
              style={{ 
                background: 'transparent', 
                border: '1px solid #444', 
                color: '#ff6b6b', 
                cursor: 'pointer', 
                fontSize: '13px',
                padding: '5px 12px',
                borderRadius: '5px',
                fontWeight: '600'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <Root />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)