"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Zap, AlertTriangle, Shield, Clock, Star } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";

const EMOJI_TO_IMG: Record<string, string> = {
  "🔥": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80", // Nike
  "🎮": "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&q=80", // PS5
  "🥽": "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=800&q=80", // VR
  "⌚": "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800&q=80", // Watch
  "🚗": "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80", // Car
  "👕": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80", // Tee
};

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/products/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setProduct(data.data);
        } else {
          setError("Product not found");
        }
      } catch (err) {
        setError("Failed to load product");
      } finally {
        setLoading(false);
      }
    }
    if (params.id) {
      fetchProduct();
    }
  }, [params.id]);

  const handleReserve = async () => {
    if (!user) {
      window.location.href = `/auth/login?redirect=/products/${params.id}`;
      return;
    }

    setReserving(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/checkout/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ productId: params.id, quantity: 1 })
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/checkout?sessionId=${data.checkoutSessionId}`);
      } else {
        setError(data.error || "Failed to reserve item");
      }
    } catch (err) {
      setError("Network error during reservation");
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading product...</div>;
  }

  if (error || !product) {
    return <div className="min-h-[50vh] flex items-center justify-center text-[var(--danger)]">{error || "Product not found"}</div>;
  }

  const isLowStock = product.inventory?.availableQuantity <= 3;
  const isSoldOut = product.inventory?.availableQuantity <= 0;
  const displayImage = EMOJI_TO_IMG[product.imageUrl] || product.imageUrl;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Left Column: Image/Visual */}
        <div className="glass-card aspect-square flex items-center justify-center text-9xl bg-[var(--surface)] border border-[var(--card-border)] rounded-3xl overflow-hidden">
          {displayImage?.startsWith('http') ? (
            <img src={displayImage} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            displayImage || "🔥"
          )}
        </div>

        {/* Right Column: Details */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4">
            <span className="badge badge-primary">Flash Sale</span>
            {isLowStock && !isSoldOut && <span className="badge badge-danger">Low Stock</span>}
            {isSoldOut && <span className="badge">Sold Out</span>}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">{product.name}</h1>
          
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-5 h-5 text-[var(--warning)] fill-[var(--warning)]" />
            <span className="text-lg font-medium">4.9</span>
            <span className="text-[var(--text-muted)]">(128 reviews)</span>
          </div>

          <p className="text-lg text-[var(--text-muted)] mb-8 leading-relaxed">
            {product.description}
          </p>

          <div className="flex items-end gap-4 mb-8">
            <span className="text-4xl font-bold text-[var(--primary)]">${product.price.toFixed(2)}</span>
            <span className="text-xl text-[var(--text-muted)] line-through mb-1">${(product.price * 1.5).toFixed(2)}</span>
          </div>

          <div className="glass-card p-6 mb-8">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[var(--text-muted)]">Available Inventory</span>
              <span className="font-bold">{product.inventory?.availableQuantity || 0} units left</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--surface-raised)] overflow-hidden">
              <div 
                className={`h-full ${isLowStock ? 'bg-[var(--danger)]' : 'bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)]'} transition-all duration-500`}
                style={{ width: `${isSoldOut ? 0 : Math.max(5, (product.inventory?.availableQuantity / (product.inventory?.totalQuantity || 100)) * 100)}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[var(--danger)] text-[var(--danger)] flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button 
            onClick={handleReserve}
            disabled={reserving || isSoldOut}
            className={`w-full !py-5 text-lg flex items-center justify-center gap-2 ${
              isSoldOut 
                ? 'bg-[var(--surface-raised)] text-[var(--text-muted)] cursor-not-allowed rounded-xl opacity-60' 
                : 'btn-primary pulse-glow'
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            {reserving ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isSoldOut ? (
              "Sold Out"
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Reserve Now
              </>
            )}
          </button>

          <div className="mt-6 flex flex-col gap-3 text-sm text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--primary)]" />
              <span>Checkout is reserved for 10 minutes once clicked</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--success)]" />
              <span>Zero overselling guarantee with atomic locking</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
