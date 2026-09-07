"use client";

import { useState, useEffect } from "react";
import { Zap, Shield, Clock, TrendingUp, ChevronRight, Star } from "lucide-react";

// MOCK_PRODUCTS removed - now fetching dynamically

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = targetDate.getTime() - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

export default function Home() {
  // Flash sale ends in 4 hours from now
  const [saleEnd] = useState(() => new Date(Date.now() + 4 * 60 * 60 * 1000));
  const countdown = useCountdown(saleEnd);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);

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
      }
    }
    fetchProducts();
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Gradient Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[var(--primary)] opacity-10 blur-[120px]" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[var(--secondary)] opacity-10 blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[var(--accent)] opacity-5 blur-[100px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            {/* Live Badge */}
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-[var(--danger)] bg-[rgba(239,68,68,0.1)]">
              <span className="w-2 h-2 rounded-full bg-[var(--danger)] animate-pulse" />
              <span className="text-sm font-semibold text-[var(--danger)]">LIVE NOW</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
              <span className="gradient-text">Flash Drops</span>
              <br />
              <span className="text-[var(--foreground)]">That Never Oversell</span>
            </h1>

            <p className="text-lg md:text-xl text-[var(--text-muted)] mb-10 max-w-2xl mx-auto leading-relaxed">
              Atomic transactions. Distributed locking. Enterprise-grade reliability.
              When we say limited — we mean it.
            </p>

            {/* Countdown Timer */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <span className="text-sm text-[var(--text-muted)] uppercase tracking-wider">Sale ends in</span>
              <div className="flex gap-2">
                {[
                  { value: countdown.hours, label: "HRS" },
                  { value: countdown.minutes, label: "MIN" },
                  { value: countdown.seconds, label: "SEC" },
                ].map((unit, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="glass-card px-4 py-3 min-w-[60px] glow-primary">
                      <span className="text-2xl md:text-3xl font-bold font-mono text-[var(--primary)]">
                        {String(unit.value).padStart(2, "0")}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] mt-1 tracking-widest">{unit.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#products" className="btn-primary text-lg !py-4 !px-8 pulse-glow inline-flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Shop the Drop
                <ChevronRight className="w-4 h-4" />
              </a>
              <a href="/auth/register" className="btn-secondary text-lg !py-4 !px-8 inline-flex items-center gap-2">
                Create Account
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="border-y border-[var(--card-border)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Shield, label: "Zero Overselling", desc: "Guaranteed by atomic locks" },
              { icon: Zap, label: "< 200ms Response", desc: "Redis-cached inventory" },
              { icon: Clock, label: "10-Min Checkout", desc: "Time-limited reservations" },
              { icon: TrendingUp, label: "1000+ Concurrent", desc: "Battle-tested under load" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-2">
                <item.icon className="w-6 h-6 text-[var(--primary)]" />
                <span className="font-semibold text-sm">{item.label}</span>
                <span className="text-xs text-[var(--text-muted)]">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section id="products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">
              Today&apos;s <span className="gradient-text">Flash Drops</span>
            </h2>
            <p className="text-[var(--text-muted)] mt-2">Limited quantities. First come, first served.</p>
          </div>
          <a href="/products" className="btn-secondary text-sm hidden md:inline-flex items-center gap-2">
            View All <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            // Hardcode some details that are not in the DB for the demo UI
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
                  <span className="text-xs text-[var(--text-muted)]">{product.category}</span>
                </div>

                {/* Product Image Placeholder */}
                <div className="w-full aspect-square rounded-xl bg-[var(--surface)] flex items-center justify-center mb-4 text-6xl group-hover:scale-105 transition-transform duration-300">
                  {product.imageUrl || "🔥"}
                </div>

                {/* Product Info */}
                <h3 className="font-semibold text-lg mb-2 line-clamp-1">{product.name}</h3>

                <div className="flex items-center gap-1 mb-3">
                  <Star className="w-4 h-4 text-[var(--warning)] fill-[var(--warning)]" />
                  <span className="text-sm font-medium">{product.rating}</span>
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
                      ? 'bg-[var(--surface-raised)] text-[var(--text-muted)] cursor-not-allowed rounded-xl' 
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
      </section>

      {/* Architecture Highlight */}
      <section className="border-t border-[var(--card-border)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Built for <span className="gradient-text">Extreme Concurrency</span>
            </h2>
            <p className="text-[var(--text-muted)] text-lg mb-12">
              Our platform processes 1000+ simultaneous purchase attempts with zero overselling.
              Every transaction is atomic, every lock is distributed, every payment is idempotent.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: "Redis Distributed Lock",
                  desc: "Redlock algorithm prevents concurrent inventory modifications",
                  tech: "Redis 7+ / Redlock",
                },
                {
                  title: "PostgreSQL FOR UPDATE",
                  desc: "Row-level locks with SERIALIZABLE isolation for atomic consistency",
                  tech: "PostgreSQL 15+ / Prisma",
                },
                {
                  title: "Razorpay Idempotency",
                  desc: "Every payment uses a unique idempotency key — zero duplicate charges",
                  tech: "Razorpay Orders",
                },
              ].map((item, i) => (
                <div key={i} className="glass-card p-6 text-left flex flex-col items-start">
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4 grow">{item.desc}</p>
                  <span className="badge badge-info mt-auto">{item.tech}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
