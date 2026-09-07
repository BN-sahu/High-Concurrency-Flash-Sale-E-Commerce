"use client";

import { Package, ChevronRight, ShoppingBag } from "lucide-react";
import { useState, useEffect } from "react";

const STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  PENDING: { badge: "badge-warning", label: "Pending" },
  CONFIRMED: { badge: "badge-info", label: "Confirmed" },
  PROCESSING: { badge: "badge-primary", label: "Processing" },
  SHIPPED: { badge: "badge-info", label: "Shipped" },
  DELIVERED: { badge: "badge-success", label: "Delivered" },
  CANCELLED: { badge: "badge-danger", label: "Cancelled" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/orders`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.success) {
          setOrders(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch orders");
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Orders</h1>
          <p className="text-[var(--text-muted)] mt-1">Track your flash drop purchases</p>
        </div>
        {!loading && orders.length > 0 && (
          <a href="/" className="btn-secondary text-sm inline-flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Continue Shopping
          </a>
        )}
      </div>

      {loading ? (
        <div className="min-h-[50vh] flex items-center justify-center">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
          <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
          <p className="text-[var(--text-muted)] mb-6">Your flash drop purchases will appear here</p>
          <a href="/" className="btn-primary inline-flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Shop Flash Drops
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const primaryProduct = order.items?.[0]; // Show the first item as the main product text

            return (
              <a
                key={order.id}
                href={`/orders/${order.id}`}
                className="glass-card p-6 flex items-center justify-between interactive group block"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[var(--surface)] flex items-center justify-center text-2xl">
                    {primaryProduct?.imageUrl || "📦"}
                  </div>
                  <div>
                    <h3 className="font-semibold group-hover:text-[var(--primary)] transition-colors">
                      {primaryProduct ? primaryProduct.productName : `Order ${order.orderNumber}`}
                      {order.itemCount > 1 && ` (+${order.itemCount - 1} items)`}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-[var(--text-muted)]">
                      <span className="font-mono">{order.orderNumber}</span>
                      <span>•</span>
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <span className={`badge ${config.badge}`}>{config.label}</span>
                  <span className="font-bold text-lg">${order.totalAmount.toFixed(2)}</span>
                  <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
