import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useTranslation } from 'react-i18next'; // NEW: i18n support
import ModifierSelectionModal from './ModifierSelectionModal';

interface Variant {
  id: string
  name: string
  price: number
  stock_quantity: number
  track_stock: boolean
}

interface Product {
  id: string
  name: string
  category: string 
  variants: Variant[]
  modifier_groups?: any[]
}

interface Props {
  onAddToCart: (item: any) => void
  branchId: string | null
}

export default function ProductGrid({ onAddToCart, branchId }: Props) {
  const { t } = useTranslation(); // Hook
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [selectedCategory, setSelectedCategory] = useState("All") 
  const [searchQuery, setSearchQuery] = useState("") 

  // --- MODIFIERS ---
  const [selectedProductForMods, setSelectedProductForMods] = useState<any | null>(null);
  const [selectedVariantForMods, setSelectedVariantForMods] = useState<any | null>(null);

  // --- CATEGORY COLOR MAPPING ---
  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'coffee': return '#795548'   // Brown
      case 'snacks': return '#ff9800'   // Orange
      case 'drinks': return '#03a9f4'   // Blue
      case 'food': return '#4caf50'     // Green
      default: return '#9e9e9e'         // Grey
    }
  }

  const fetchProducts = async () => {
    // Determine query: include branch_specific stock 
    const { data, error } = await supabase
      .from('products')
      .select(`
        *, 
        variants(
          *, 
          branch_product_stock(branch_id, stock_quantity)
        ), 
        modifier_groups(*, modifiers(*))
      `)
      .order('name')
    
    if (error) console.error('Error fetching products:', error)
    else {
      // Process Data to merge stock correctly based on branchId
      const processed = (data || []).map((p: any) => ({
        ...p,
        variants: p.variants.map((v: any) => {
           // Find stock for this branch, or default to 0 if tracking is enabled but no record found
           const branchStockRecord = v.branch_product_stock?.find((s: any) => s.branch_id === branchId);
           return {
             ...v,
             // If tracking is off, we say 9999. If on, we use the branch record or 0.
             stock_quantity: v.track_stock ? (branchStockRecord ? branchStockRecord.stock_quantity : 0) : 9999
           }
        })
      }));
      setProducts(processed)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (branchId) fetchProducts()
  }, [branchId])

  const handleProductClick = (product: any, variant: any) => {
     // Check if product has modifiers
     if (product.modifier_groups && product.modifier_groups.length > 0) {
        setSelectedProductForMods(product);
        setSelectedVariantForMods(variant);
     } else {
        // No modifiers -> Direct Add
        onAddToCart({
          id: variant.id,
          name: `${product.name} (${variant.name})`,
          price: variant.price,
          track_stock: variant.track_stock, 
          stock_quantity: variant.stock_quantity, // Calculated from branch logic
          modifiers: []
        });
     }
  };

  const confirmModifiers = (modifiers: any[]) => {
      if (!selectedProductForMods || !selectedVariantForMods) return;
      
      const totalPrice = selectedVariantForMods.price + modifiers.reduce((sum, m) => sum + m.price_adjustment, 0);
      
      onAddToCart({
          id: selectedVariantForMods.id,
          name: `${selectedProductForMods.name} (${selectedVariantForMods.name})`,
          price: totalPrice,
          original_price: selectedVariantForMods.price,
          
          track_stock: selectedVariantForMods.track_stock, 
          stock_quantity: selectedVariantForMods.stock_quantity,
          modifiers: modifiers
      });
      
      setSelectedProductForMods(null);
      setSelectedVariantForMods(null);
  };

  // Generate category list from data
  const categories = ["All", ...Array.from(new Set(products.map(p => p.category || "Uncategorized")))]

  // Filter products based on search and category
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>{t('loading_product')}</div>

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      {/* --- SEARCH AND CATEGORY FILTERS --- */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text"
          placeholder={t('search_placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '15px', fontSize: '1.1rem',
            border: '1px solid #ddd', borderRadius: '8px', marginBottom: '15px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.05)', boxSizing: 'border-box'
          }}
        />

        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`category-filter-btn ${selectedCategory === cat ? 'active' : ''}`}
              style={{
                // Overriding background only if active and not All/Uncat to show category color
                background: selectedCategory === cat && cat !== 'All' ? getCategoryColor(cat) : undefined,
                borderColor: selectedCategory === cat && cat !== 'All' ? getCategoryColor(cat) : undefined,
                color: selectedCategory === cat && cat !== 'All' ? '#fff' : undefined
              }}
            >
              {cat === "All" ? t('all') : cat === "Uncategorized" ? t('uncategorized') : cat}
            </button>
          ))}
        </div>
      </div>

      {/* --- PRODUCT TILES GRID --- */}
      <div className="product-grid">
        {filteredProducts.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', gridColumn: '1/-1' }}>No products found.</p>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="product-card">
              
              {/* Category Color Strip */}
              <div style={{ height: '6px', width: '100%', backgroundColor: getCategoryColor(product.category) }}></div>

              <div className="product-card-content">
                <h3>{product.name}</h3>

                <div 
                  className="product-category"
                  style={{ color: getCategoryColor(product.category) }}
                >
                  {product.category}
                </div>
                
                <div style={{ flex: 1 }}></div>

                {/* Variant Purchase Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {product.variants.map((variant) => {
                    const isOutOfStock = variant.track_stock && variant.stock_quantity <= 0
                    
                    return (
                      <button
                        key={variant.id}
                        disabled={isOutOfStock}
                        onClick={() => handleProductClick(product, variant)}
                        className="variant-btn"
                        style={{
                           // Keep the subtle category border tint if desired, otherwise rely on CSS
                           borderColor: !isOutOfStock ? `${getCategoryColor(product.category)}40` : undefined
                        }}
                      >
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                            {variant.name === 'Standard' ? t('add_item') : variant.name}
                          </div>
                          {/* STOCK INDICATOR */}
                          {variant.track_stock && !isOutOfStock && (
                            <div style={{ 
                              fontSize: '0.7rem', 
                              color: variant.stock_quantity < 5 ? 'var(--danger-color)' : 'var(--success-color)', 
                              fontWeight: 'bold' 
                            }}>
                              {variant.stock_quantity} left
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                          {isOutOfStock ? 'SOLD OUT' : `$${(variant.price / 100).toFixed(2)}`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {selectedProductForMods && selectedVariantForMods && (
        <ModifierSelectionModal 
           product={selectedProductForMods} 
           variant={selectedVariantForMods} 
           onConfirm={confirmModifiers}
           onCancel={() => { setSelectedProductForMods(null); setSelectedVariantForMods(null); }}
        />
      )}

    </div>
  )
}