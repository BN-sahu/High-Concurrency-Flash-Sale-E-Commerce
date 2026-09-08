"use client";

import { useState, useEffect } from "react";
import { Zap, ChevronRight, Star } from "lucide-react";

const EMOJI_TO_IMG: Record<string, string> = {
  "🔥": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
  "🎮": "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&q=80",
  "🥽": "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=800&q=80",
  "⌚": "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800&q=80",
  "🚗": "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80",
  "👕": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/products`);
        const data = await res.json();
        if (data.success) {
          setProducts(data.data);
        }
      } catch (err) {
        console.error("Failed to load products", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  return (
    <div className="animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">All <span className="gradient-text">Products</span></h1>
          <p className="text-[var(--text-muted)] text-lg">Browse our full catalog of exclusive flash drops.</p>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-[var(--text-muted)]">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-lg">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const originalPrice = product.price * 1.5;
            const discount = Math.round((1 - product.price / originalPrice) * 100);
            const available = product.availableQuantity || 0;
            const total = product.totalQuantity || (available + 50);
            const isLowStock = available <= 3 && available > 0;
            const isHovered = hoveredProduct === product.id;

            return (
              <a
                key={product.id}
                href={`/products/${product.id}`}
                className="glass-card overflow-hidden flex flex-col interactive group cursor-pointer"
                onMouseEnter={() => setHoveredProduct(product.id)}
                onMouseLeave={() => setHoveredProduct(null)}
                style={{
                  boxShadow: isHovered ? '0 0 30px var(--primary-glow)' : 'none',
                }}
              >
                {/* Product Image - Full Bleed */}
                <div className="relative w-full aspect-square bg-[var(--surface)] overflow-hidden">
                  <div className="absolute top-4 left-4 z-10 flex gap-2">
                    <span className="px-3 py-1 text-sm font-bold bg-[var(--primary)] text-white rounded-full shadow-[0_0_15px_rgba(139,92,246,0.5)] tracking-wide">
                      {discount}% OFF
                    </span>
                    {isLowStock && (
                      <span className="px-3 py-1 text-sm font-bold bg-[var(--danger)] text-white rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                        Low Stock
                      </span>
                    )}
                  </div>
                  
                  {EMOJI_TO_IMG[product.imageUrl] || product.imageUrl?.startsWith('http') ? (
                    <img 
                      src={EMOJI_TO_IMG[product.imageUrl] || product.imageUrl} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-7xl group-hover:scale-110 transition-transform duration-500">
                      {product.imageUrl || "🔥"}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">

                {/* Product Info */}
                <h2 className="font-semibold text-lg mb-2 line-clamp-1">{product.name}</h2>

                <div className="flex items-center gap-1 mb-3">
                  <Star className="w-4 h-4 text-[var(--warning)] fill-[var(--warning)]" />
                  <span className="text-sm font-medium">4.9</span>
                </div>

                {/* Pricing */}
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-2xl font-bold text-[var(--primary)]">
                    ${product.price.toFixed(2)}
                  </span>
                  <span className="text-sm text-[var(--text-muted)] line-through">
                    ${originalPrice.toFixed(2)}
                  </span>
                </div>

                {/* Stock Indicator */}
                <div className="mb-5 mt-auto">
                  <div className="flex justify-between text-sm font-medium text-[var(--text-muted)] mb-2">
                    <span className={isLowStock ? 'text-[var(--danger)] font-bold' : ''}>{available} left</span>
                    <span>{Math.round((available / total) * 100)}% remaining</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--surface)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(available / total) * 100}%`,
                        background: isLowStock
                          ? 'var(--danger)'
                          : 'linear-gradient(90deg, var(--gradient-start), var(--gradient-end))',
                      }}
                    />
                  </div>
                </div>

                {/* CTA */}
                <button 
                  className={`w-full text-sm !py-3 flex items-center justify-center gap-2 ${
                    available === 0 
                      ? 'bg-[var(--surface-raised)] text-[var(--text-muted)] cursor-not-allowed rounded-xl opacity-60' 
                      : 'btn-primary'
                  }`}
                  disabled={available === 0}
                  onClick={(e) => {
                    if (available === 0) e.preventDefault();
                  }}
                >
                  <Zap className="w-4 h-4" />
                  {available === 0 ? "Sold Out" : isLowStock ? "Grab Now!" : "Buy Now"}
                </button>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
