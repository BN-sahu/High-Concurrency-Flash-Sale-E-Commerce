"use client";

import { useAuth } from "../hooks/useAuth";
import { User, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  const getLinkClass = (path: string) => {
    let isActive = path === "/" ? pathname === "/" : pathname.startsWith(path);
    if (path === "/products" && pathname.startsWith("/checkout")) isActive = true;

    return `relative text-sm font-medium transition-colors py-1 ${
      isActive 
        ? "text-[var(--primary)] after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-[var(--primary)] after:rounded-full" 
        : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
    }`;
  };

  return (
    <nav className="sticky top-0 z-50 glass-card border-b border-[var(--card-border)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center">
                <span className="text-white font-bold text-sm">⚡</span>
              </div>
              <span className="text-xl font-bold gradient-text">FlashDrop</span>
            </a>

            <div className="hidden md:flex items-center gap-6">
              <a href="/" className={getLinkClass("/")}>Home</a>
              <a href="/products" className={getLinkClass("/products")}>Products</a>
              <a href="/orders" className={getLinkClass("/orders")}>Orders</a>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 rounded-full bg-[var(--surface-raised)] flex items-center justify-center border border-[var(--card-border)]">
                    <User className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                  <span className="hidden sm:inline-block font-medium">{user.name || user.email}</span>
                </div>
                <button onClick={logout} className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors" title="Logout">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <a href="/auth/login" className="btn-secondary text-sm !py-2 !px-4">Login</a>
                <a href="/auth/register" className="btn-primary text-sm !py-2 !px-4">Sign Up</a>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
