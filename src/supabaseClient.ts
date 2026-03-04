import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // throw new Error('Missing Supabase Environment Variables')
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; margin: 20px;">
      <h3>Configuration Error</h3>
      <p>Missing Supabase Environment Variables.</p>
      <p>Please check your <code>.env</code> file locally or <strong>Environment Variables</strong> in your Vercel project settings.</p>
      <p>Required: <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code></p>
    </div>
  `;
  throw new Error('Missing Supabase Environment Variables');
}

// This is the single connection we will use across the whole app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)