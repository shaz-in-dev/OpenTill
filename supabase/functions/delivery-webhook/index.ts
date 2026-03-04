// Follows Deno/Supabase Edge Functions structure
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const payload = await req.json()
    const provider = req.get('x-delivery-provider') || 'generic'

    console.log(`Received order from ${provider}`, payload)

    // 1. Validate Payload
    if (!payload.items || !Array.isArray(payload.items)) {
        throw new Error("Invalid payload: 'items' array is required")
    }

    // 2. Prepare items for RPC (Map external IDs to internal variants if possible)
    // For now, we assume the webhook sends 'name' matching our variants or exact variant_id
    // Real implementation would look up SKU or External ID map
    
    let variantMap = new Map();
    const itemNames = payload.items.map((i: any) => i.name).filter(Boolean);

    if (itemNames.length > 0) {
        const { data: variants } = await supabaseClient
            .from('variants')
            .select('id, name, price')
            .in('name', itemNames)
        
        if (variants) {
            variantMap = new Map(variants.map((v: any) => [v.name, v]))
        }
    }

    const cleanItems = payload.items.map((item: any) => {
        const found = variantMap.get(item.name)
        
        // Defensive check for price
        const unitPrice = item.price 
            ? Math.round(Number(item.price) * 100) 
            : (found?.price || 0);

        return {
            id: found?.id || null, // Allow null for non-stock items
            name: item.name,
            price: unitPrice, 
            quantity: Number(item.quantity) || 1,
            modifiers: item.modifiers || []
        }
    })

    // 3. Call Atomic RPC
    const rpcPayload = {
        branchId: payload.branch_id || 'a798abd7-2ab8-4419-8bb6-d77bd584a2bf', // Fallback ID
        totalAmount: payload.total_amount ? Math.round(Number(payload.total_amount) * 100) : 0,
        paymentMethod: `ONLINE_${String(provider).toUpperCase()}`,
        items: cleanItems,
        customerName: payload.customer_name || 'Delivery Customer',
        tableNumber: 'DELIVERY'
    }

    const { data, error } = await supabaseClient.rpc('sell_items', {
        order_payload: rpcPayload
    })

    if (error) throw error

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const err = error as Error
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
