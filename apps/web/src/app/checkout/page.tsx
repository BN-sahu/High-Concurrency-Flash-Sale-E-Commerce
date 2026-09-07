"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Clock, AlertTriangle, Shield, CheckCircle, CreditCard } from "lucide-react";

const EMOJI_TO_IMG: Record<string, string> = {
  "🔥": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80", // Nike
  "🎮": "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&q=80", // PS5
  "🥽": "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=800&q=80", // VR
  "⌚": "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800&q=80", // Watch
  "🚗": "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80", // Car
  "👕": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80", // Tee
};

import { Suspense } from "react";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [step, setStep] = useState<"loading" | "review" | "payment" | "confirmed" | "error">("loading");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch session details
  useEffect(() => {
    if (!sessionId) {
      setStep("error");
      setError("No session ID provided.");
      return;
    }

    async function fetchSession() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/checkout/status/${sessionId}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.success) {
          setSession(data.data);
          
          // Calculate remaining time
          const expiresAt = new Date(data.data.expiresAt).getTime();
          const now = new Date().getTime();
          const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
          
          setTimeLeft(remainingSeconds);
          setStep("review");
          
          if (remainingSeconds === 0) {
            setStep("error");
            setError("Reservation expired");
          }
        } else {
          setStep("error");
          setError(data.error || "Failed to load session");
        }
      } catch (err) {
        setStep("error");
        setError("Network error loading checkout session");
      }
    }

    fetchSession();
  }, [sessionId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || step === "confirmed" || step === "error" || step === "loading") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setStep("error");
          setError("Reservation expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, step]);

  const handlePayment = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      
      // 1. Generate Razorpay Order from our API
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/checkout/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          checkoutSessionId: sessionId,
          idempotencyKey: crypto.randomUUID()
        })
      });

      const data = await res.json();
      
      if (!data.success) {
        setError(data.error || "Failed to create payment intent");
        setStep("error");
        setLoading(false);
        return;
      }

      // 2. Initialize Razorpay Checkout
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "FlashDrop",
        description: "Flash Sale Purchase",
        order_id: data.razorpayOrderId,
        handler: function (response: any) {
          // Razorpay returns razorpay_payment_id, razorpay_order_id, razorpay_signature
          // The backend webhook will handle actual fulfillment.
          // We can just show success here.
          setStep("confirmed");
        },
        prefill: {
          name: "Test User",
          email: "test@example.com"
        },
        theme: {
          color: "#8B5CF6"
        }
      };

      const rzp = new (window as any).Razorpay(options);
      
      rzp.on("payment.failed", function (response: any) {
        setError(response.error.description || "Payment failed");
        setStep("error");
        setLoading(false);
      });

      rzp.open();
      setLoading(false);

    } catch (err) {
      setError("Payment integration error");
      setStep("error");
      setLoading(false);
    }
  };

  if (step === "loading") {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading checkout...</div>;
  }

  if (step === "confirmed") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 animate-fade-in">
        <div className="glass-card max-w-lg w-full p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[rgba(16,185,129,0.15)] flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[var(--success)]" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Order Confirmed!</h1>
          <p className="text-[var(--text-muted)] mb-6">
            Your flash drop purchase has been secured. You&apos;ll receive a confirmation email shortly.
          </p>
          <div className="flex gap-3">
            <a href="/orders" className="btn-secondary flex-1 text-center">View Orders</a>
            <a href="/" className="btn-primary flex-1 text-center">Continue Shopping</a>
          </div>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft <= 60;

  // Compute totals
  const total = session?.reservations?.reduce((sum: number, res: any) => sum + Number(res.product.price) * res.quantity, 0) || 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">

      {step === "error" && (
        <div className="mb-6 p-4 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[var(--danger)] text-[var(--danger)] flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Checkout Error</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Countdown Banner */}
      {step === "review" && (
        <div className={`glass-card px-4 py-3 mb-6 flex items-center justify-between ${isUrgent ? "border-[var(--danger)]" : ""}`}>
          <div className="flex items-center gap-3">
            {isUrgent ? (
              <AlertTriangle className="w-5 h-5 text-[var(--danger)]" />
            ) : (
              <Clock className="w-5 h-5 text-[var(--primary)]" />
            )}
            <span className={`font-medium ${isUrgent ? "text-[var(--danger)]" : ""}`}>
              {timeLeft === 0 ? "Reservation expired!" : "Complete checkout within"}
            </span>
          </div>
          {timeLeft > 0 && (
            <div className={`font-mono text-2xl font-bold ${isUrgent ? "countdown-urgent" : "text-[var(--primary)]"}`}>
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold mb-6">Checkout</h1>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
            {session?.reservations?.map((res: any) => {
              const displayImage = EMOJI_TO_IMG[res.product?.imageUrl] || res.product?.imageUrl;
              
              return (
              <div key={res.id} className="flex items-start gap-4 py-4 border-b border-[var(--card-border)] last:border-0">
                <div className="w-20 h-20 rounded-lg bg-[var(--surface-raised)] flex items-center justify-center text-3xl overflow-hidden shrink-0">
                  {displayImage?.startsWith('http') ? (
                    <img src={displayImage} alt={res.product?.name} className="w-full h-full object-cover" />
                  ) : (
                    displayImage || "🔥"
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{res.product.name}</h3>
                  <p className="text-sm text-[var(--text-muted)]">Qty: {res.quantity}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="badge badge-success">Reserved</span>
                  </div>
                </div>
                <span className="text-xl font-bold text-[var(--primary)]">${Number(res.product.price).toFixed(2)}</span>
              </div>
              );
            })}
          </div>
        </div>

        {/* Order Total Sidebar */}
        <div>
          <div className="glass-card p-6 sticky top-24">
            <h2 className="font-semibold mb-4">Order Total</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="border-t border-[var(--card-border)] pt-3 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-[var(--primary)]">${total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={loading || timeLeft === 0 || step === "error"}
              className="btn-primary w-full !py-4 mt-6 flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Loading Gateway...
                </>
              ) : timeLeft === 0 ? (
                "Reservation Expired"
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Pay ${total.toFixed(2)}
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[var(--text-muted)]">
              <Shield className="w-4 h-4" />
              Secured by Razorpay.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center">Loading checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
