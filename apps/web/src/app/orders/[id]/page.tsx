"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Package, ChevronLeft, CreditCard, MapPin, CheckCircle } from "lucide-react";

const STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  PENDING: { badge: "badge-warning", label: "Pending" },
  CONFIRMED: { badge: "badge-info", label: "Confirmed" },
  PROCESSING: { badge: "badge-primary", label: "Processing" },
  SHIPPED: { badge: "badge-info", label: "Shipped" },
  DELIVERED: { badge: "badge-success", label: "Delivered" },
  CANCELLED: { badge: "badge-danger", label: "Cancelled" },
};

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchOrder() {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/auth/login");
          return;
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/orders/${params.id}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        const data = await res.json();
        
        if (data.success) {
          setOrder(data.data);
        } else {
          setError(data.error || "Order not found");
        }
      } catch (err) {
        setError("Failed to fetch order details");
      } finally {
        setLoading(false);
      }
    }
    
    if (params.id) {
      fetchOrder();
    }
  }, [params.id, router]);

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading order details...</div>;
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => router.push("/orders")} className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--foreground)] mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Orders
        </button>
        <div className="glass-card p-12 text-center text-[var(--danger)]">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p>{error || "Order not found"}</p>
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={() => router.push("/orders")} className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--foreground)] mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Back to Orders
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Order Details
            <span className={`badge ${config.badge} text-sm`}>{config.label}</span>
          </h1>
          <p className="text-[var(--text-muted)] mt-1 font-mono text-sm">
            {order.orderNumber} • Placed on {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h2 className="font-semibold mb-4 text-lg">Items Ordered</h2>
            <div className="space-y-4">
              {order.items.map((item: any) => (
                <div key={item.id} className="flex items-start gap-4 p-4 rounded-lg bg-[var(--surface)]">
                  <div className="w-20 h-20 rounded-xl bg-[var(--surface-raised)] flex items-center justify-center text-3xl shrink-0">
                    {item.imageUrl || "📦"}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{item.productName}</h3>
                    <p className="text-sm text-[var(--text-muted)] mb-2">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lg text-[var(--primary)]">${Number(item.unitPrice).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="font-semibold mb-4 text-lg">Payment Information</h2>
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-[var(--text-muted)] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {order.payment?.status === "COMPLETED" ? (
                    <span className="flex items-center gap-2 text-[var(--success)]"><CheckCircle className="w-4 h-4"/> Payment Successful</span>
                  ) : order.payment?.status === "PENDING" ? (
                    <span className="text-[var(--warning)]">Payment Pending</span>
                  ) : (
                    <span className="text-[var(--danger)]">Payment Failed</span>
                  )}
                </p>
                {order.payment?.confirmedAt && (
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Confirmed on {new Date(order.payment.confirmedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="glass-card p-6 sticky top-24">
            <h2 className="font-semibold mb-4 text-lg">Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Items ({order.items.length})</span>
                <span>${order.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Shipping</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Tax</span>
                <span>$0.00</span>
              </div>
              <div className="border-t border-[var(--card-border)] pt-3 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-[var(--primary)]">${order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
