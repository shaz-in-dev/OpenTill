// Follows Deno/Supabase Edge Functions structure
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Optimize client for Edge Functions (no auth persistence)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // CORS check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }), { 
        status: 405, headers: corsHeaders 
    })
  }

  try {
    const payload = await req.json()
    const provider = req.headers.get('x-delivery-provider') || 'generic' // e.g., 'ubereats'

    console.log(`Received order from ${provider}`, payload);

    // 1. Map External Items to Internal Variant IDs (Availability Check)
    const externalItems = payload.items || []
    
    // Skip DB lookup if no items
    let variantMap = new Map();
    if (externalItems.length > 0) {
        const itemNames = externalItems.map((i: any) => i.name);
        
        // Fetch variants by name to get correct UUIDs for stock tracking
        const { data: variants } = await supabase
            .from('variants')
            .select('id, name, price')
            .in('name', itemNames)
        
        if (variants) {
            variantMap = new Map(variants.map((v: any) => [v.name, v]))
        }
    }

    const mappedItems = externalItems.map((i: any) => {
        const foundVariant = variantMap.get(i.name)
        if (!foundVariant) {
            console.warn(`Item not found in DB: ${i.name}. processing as unlinked item.`);
        }
        return {
            id: foundVariant?.id || null, // Will be null if not found (Stock won't deduct, but order proceeds)
            name: i.name,
            price: i.price ? Math.round(i.price * 100) : (foundVariant?.price || 0), // Prefer payload price, fallback to DB
            quantity: i.quantity || 1,
            modifiers: i.modifiers || []
        }
    })

    // 2. Prepare Payload for sell_items RPC
    const rpcPayload = {
        branchId: payload.branch_id || 'default',
        totalAmount: payload.total_amount ? Math.round(payload.total_amount * 100) : 0, 
        paymentMethod: `ONLINE_${provider.toUpperCase()}`,
        items: mappedItems
    }

    // 3. Execute Transaction
    const { data: rpcData, error: rpcError } = await supabase.rpc('sell_items', { 
        order_payload: rpcPayload 
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
        throw new Error(`Transaction Failed: ${rpcError.message}`);
    }

    return new Response(JSON.stringify({ 
        success: true, 
        order_id: rpcData, 
        message: `Order processed successfully from ${provider}` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    console.error("Webhook Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
