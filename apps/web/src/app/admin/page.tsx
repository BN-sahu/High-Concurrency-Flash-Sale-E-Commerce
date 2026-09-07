"use client";

import { BarChart3, Package, Users, DollarSign, ShoppingCart, AlertCircle, TrendingUp, Clock } from "lucide-react";

const MOCK_DASHBOARD = {
  products: { total: 24, active: 18 },
  orders: { total: 1247, pending: 5, confirmed: 1200, processing: 42 },
  revenue: { total: 289750.0 },
  reservations: { active: 12 },
  users: { total: 8432 },
};

const MOCK_RECENT_ORDERS = [
  { id: "1", orderNumber: "FS-20240115-A3B9F2", user: "john@example.com", amount: 249.99, status: "CONFIRMED", time: "2 min ago" },
  { id: "2", orderNumber: "FS-20240115-C4D5E6", user: "jane@example.com", amount: 599.99, status: "PENDING", time: "5 min ago" },
  { id: "3", orderNumber: "FS-20240115-F7G8H9", user: "bob@example.com", amount: 149.99, status: "CONFIRMED", time: "12 min ago" },
  { id: "4", orderNumber: "FS-20240115-I1J2K3", user: "alice@example.com", amount: 899.99, status: "PROCESSING", time: "20 min ago" },
];

export default function AdminDashboard() {
  const stats = [
    {
      title: "Total Revenue",
      value: `$${MOCK_DASHBOARD.revenue.total.toLocaleString()}`,
      icon: DollarSign,
      change: "+12.5%",
      color: "var(--success)",
    },
    {
      title: "Total Orders",
      value: MOCK_DASHBOARD.orders.total.toLocaleString(),
      icon: ShoppingCart,
      change: "+8.2%",
      color: "var(--primary)",
    },
    {
      title: "Total Users",
      value: MOCK_DASHBOARD.users.total.toLocaleString(),
      icon: Users,
      change: "+15.3%",
      color: "var(--accent)",
    },
    {
      title: "Active Reservations",
      value: MOCK_DASHBOARD.reservations.active.toString(),
      icon: Clock,
      change: "",
      color: "var(--warning)",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-[var(--text-muted)] mt-1">Flash sale platform overview</p>
        </div>
        <div className="flex gap-3">
          <a href="/admin/products" className="btn-secondary text-sm inline-flex items-center gap-2">
            <Package className="w-4 h-4" />
            Products
          </a>
          <a href="/admin/orders" className="btn-primary text-sm inline-flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            All Orders
          </a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${stat.color}15` }}
              >
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              {stat.change && (
                <span className="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                  <TrendingUp className="w-3 h-3" />
                  {stat.change}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">{stat.title}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6">
            <h2 className="font-semibold mb-4">Recent Orders</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--text-muted)] border-b border-[var(--card-border)]">
                    <th className="pb-3 font-medium">Order</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_RECENT_ORDERS.map((order) => (
                    <tr key={order.id} className="border-b border-[var(--card-border)] last:border-0">
                      <td className="py-3 font-mono text-xs">{order.orderNumber}</td>
                      <td className="py-3 text-[var(--text-secondary)]">{order.user}</td>
                      <td className="py-3 font-medium">${order.amount.toFixed(2)}</td>
                      <td className="py-3">
                        <span className={`badge ${
                          order.status === "CONFIRMED" ? "badge-success" :
                          order.status === "PENDING" ? "badge-warning" : "badge-primary"
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 text-[var(--text-muted)]">{order.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div>
          <div className="glass-card p-6 mb-6">
            <h2 className="font-semibold mb-4">System Health</h2>
            <div className="space-y-3">
              {[
                { label: "PostgreSQL", status: "ok" },
                { label: "Redis", status: "ok" },
                { label: "MongoDB", status: "ok" },
                { label: "Queue (BullMQ)", status: "ok" },
                { label: "Stripe", status: "ok" },
              ].map((svc, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{svc.label}</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${svc.status === "ok" ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`} />
                    <span className={`text-xs ${svc.status === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {svc.status === "ok" ? "Healthy" : "Down"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--warning)]" />
              Quick Stats
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Active Products</span>
                <span className="font-medium">{MOCK_DASHBOARD.products.active}/{MOCK_DASHBOARD.products.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Pending Orders</span>
                <span className="font-medium text-[var(--warning)]">{MOCK_DASHBOARD.orders.pending}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Processing</span>
                <span className="font-medium">{MOCK_DASHBOARD.orders.processing}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Active Reservations</span>
                <span className="font-medium text-[var(--accent)]">{MOCK_DASHBOARD.reservations.active}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
