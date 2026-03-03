import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useTranslation } from 'react-i18next'; // NEW: i18n support

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
}

interface Props {
  onAddToCart: (item: any) => void
}

export default function ProductGrid({ onAddToCart }: Props) {
  const { t } = useTranslation(); // Hook
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  
  const [selectedCategory, setSelectedCategory] = useState("All") 
  const [searchQuery, setSearchQuery] = useState("") 

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
    const { data, error } = await supabase
      .from('products')
      .select('*, variants(*)')
      .order('name')
    
    if (error) console.error('Error fetching products:', error)
    else setProducts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

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
              style={{
                padding: '10px 25px',
                borderRadius: '30px',
                border: 'none',
                cursor: 'pointer',
                background: selectedCategory === cat ? (cat === 'All' ? 'black' : getCategoryColor(cat)) : 'white',
                color: selectedCategory === cat ? 'white' : 'black',
                fontWeight: 'bold',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                whiteSpace: 'nowrap',
                fontSize: '0.9rem',
                transition: '0.2s'
              }}
            >
              {cat === "All" ? t('all') : cat === "Uncategorized" ? t('uncategorized') : cat}
            </button>
          ))}
        </div>
      </div>

      {/* --- PRODUCT TILES GRID --- */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
        gap: '15px',
        alignContent: 'start',
        overflowY: 'auto'
      }}>
        {filteredProducts.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', gridColumn: '1/-1' }}>No products found.</p>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} style={{ 
              background: 'white', 
              borderRadius: '12px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              display: 'flex', 
              flexDirection: 'column', 
              height: '100%',
              minHeight: '160px',
              border: '1px solid #eee'
            }}>
              
              {/* Category Color Strip */}
              <div style={{ height: '8px', width: '100%', backgroundColor: getCategoryColor(product.category) }}></div>

              <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', fontWeight: '800', color: '#222' }}>
                  {product.name}
                </h3>

                <div style={{ 
                  fontSize: '0.75rem', 
                  color: getCategoryColor(product.category), 
                  fontWeight: 'bold', 
                  textTransform: 'uppercase', 
                  marginBottom: '15px'
                }}>
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
                        onClick={() => onAddToCart({
                          id: variant.id,
                          name: `${product.name} (${variant.name})`,
                          price: variant.price,
                          track_stock: variant.track_stock, 
                          stock_quantity: variant.stock_quantity
                        })}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: isOutOfStock ? '#f5f5f5' : '#fff',
                          color: isOutOfStock ? '#aaa' : '#333',
                          border: isOutOfStock ? '1px solid #eee' : `1px solid ${getCategoryColor(product.category)}40`,
                          borderRadius: '8px',
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: '0.1s'
                        }}
                      >
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                            {variant.name === 'Standard' ? 'Add' : variant.name}
                          </div>
                          {/* STOCK INDICATOR MERGED FROM VERSION 1 */}
                          {variant.track_stock && !isOutOfStock && (
                            <div style={{ 
                              fontSize: '0.7rem', 
                              color: variant.stock_quantity < 5 ? '#d32f2f' : '#85ad4e', 
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
    </div>
  )
}