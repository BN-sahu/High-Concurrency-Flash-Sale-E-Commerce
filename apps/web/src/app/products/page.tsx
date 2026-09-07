"use client";

import { useState, useEffect } from "react";
import { Zap, ChevronRight, Star } from "lucide-react";

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
                className="glass-card p-6 interactive group cursor-pointer"
                onMouseEnter={() => setHoveredProduct(product.id)}
                onMouseLeave={() => setHoveredProduct(null)}
                style={{
                  boxShadow: isHovered ? '0 0 30px var(--primary-glow)' : 'none',
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex gap-2">
                    <span className="badge badge-primary">{discount}% OFF</span>
                    {isLowStock && (
                      <span className="badge badge-danger">Low Stock</span>
                    )}
                  </div>
                </div>

                {/* Product Image Placeholder */}
                <div className="w-full aspect-square rounded-xl bg-[var(--surface)] flex items-center justify-center mb-4 text-6xl group-hover:scale-105 transition-transform duration-300">
                  {product.imageUrl || "🔥"}
                </div>

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
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                    <span>{available} left</span>
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
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
