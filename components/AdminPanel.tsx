"use client";

import { useEffect, useState } from "react";
import {
  getAdminAnalytics,
  getAdminUsers,
  type AdminUser,
  type Analytics,
} from "@/lib/api";

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAdminUsers(), getAdminAnalytics()])
      .then(([u, a]) => {
        if (cancelled) return;
        setUsers(u.users);
        setAnalytics(a);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const maxMonthly = analytics
    ? Math.max(1, ...analytics.monthly.map((m) => m.count))
    : 1;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-6 md:px-10 py-10 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
              <i className="ph-fill ph-shield-star text-indigo-600" /> Super Admin
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              User directory and month-on-month creative-request analytics.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F0F0F] text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
          >
            <i className="ph ph-chat-circle text-lg" /> Back to chat
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Total Users"
            value={users ? String(users.length) : "—"}
            icon="ph-users"
          />
          <StatCard
            label="Total Requests"
            value={analytics ? String(analytics.total_requests) : "—"}
            icon="ph-sparkle"
          />
          <StatCard
            label="Active Months"
            value={analytics ? String(analytics.monthly.length) : "—"}
            icon="ph-calendar"
          />
        </div>

        {/* Month-on-month */}
        <section className="bg-white border border-gray-200/80 rounded-[20px] p-6 shadow-sm mb-8">
          <h2 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider mb-4">
            Requests — Month on Month
          </h2>
          {analytics && analytics.monthly.length > 0 ? (
            <div className="flex flex-col gap-3">
              {analytics.monthly.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-[12px] font-mono text-gray-500 w-16 shrink-0">{m.month}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative">
                    <div
                      className="h-5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all"
                      style={{ width: `${(m.count / maxMonthly) * 100}%` }}
                    />
                  </div>
                  <span className="text-[13px] font-semibold text-gray-900 w-10 text-right shrink-0">
                    {m.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm italic">No creative requests recorded yet.</p>
          )}
        </section>

        {/* Breakdowns */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <BreakdownCard title="By Brand" data={analytics.by_brand} />
            <BreakdownCard title="By Category" data={analytics.by_category} />
          </div>
        )}

        {/* User directory */}
        <section className="bg-white border border-gray-200/80 rounded-[20px] shadow-sm overflow-hidden">
          <h2 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider px-6 pt-5 pb-3">
            User Directory
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-y border-gray-100">
                  <th className="px-6 py-2 font-semibold">User</th>
                  <th className="px-6 py-2 font-semibold">Email</th>
                  <th className="px-6 py-2 font-semibold">Joined</th>
                  <th className="px-6 py-2 font-semibold">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        {u.picture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.picture} alt="" className="w-7 h-7 rounded-full" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[11px] font-bold">
                            {(u.name || u.email || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[13px] font-medium text-gray-900">{u.name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-[13px] text-gray-600">{u.email}</td>
                    <td className="px-6 py-3 text-[13px] text-gray-500">{formatDate(u.created_at)}</td>
                    <td className="px-6 py-3 text-[13px] text-gray-500">{formatDate(u.last_login)}</td>
                  </tr>
                ))}
                {users && users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-gray-400 text-sm italic">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white border border-gray-200/80 rounded-[20px] p-5 shadow-sm flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
        <i className={`ph-fill ${icon} text-xl`} />
      </div>
      <div>
        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="bg-white border border-gray-200/80 rounded-[20px] p-6 shadow-sm">
      <h2 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider mb-4">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-gray-400 text-sm italic">No data yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map(([label, count]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-[12px] text-gray-600 w-32 truncate shrink-0">{label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  className="h-4 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="text-[12px] font-semibold text-gray-900 w-8 text-right shrink-0">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
