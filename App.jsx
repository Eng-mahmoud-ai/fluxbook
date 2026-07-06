import React, { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  LayoutDashboard, ArrowLeftRight, LineChart as LineChartIcon, Settings, Moon, Sun, Plus,
  Wallet, ArrowUpRight, ArrowDownRight, Menu, X, Search, Bell, TrendingUp, TrendingDown,
  Check, Clock, AlertTriangle, Pencil, Trash2, CreditCard, FileSpreadsheet, Tag, Loader2, LogOut,
} from "lucide-react";
import { supabase, supabaseReady, DEFAULT_CATEGORIES } from "./supabase.js";

/* ---------------- helpers ---------------- */
const kes = (n, cents = false) =>
  "KSh " + new Intl.NumberFormat("en-KE", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(Number(n) || 0);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const fmtDate = (d) => d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
const isoDay = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
const STATUSES = ["Completed", "Pending", "Failed"];

/* db row <-> app object mappers */
const fromTxRow = (r) => ({ id: r.id, date: new Date(r.txn_date), desc: r.description, cat: r.category, amount: Number(r.amount), type: r.direction, status: r.status });
const toTxRow = (t) => ({ txn_date: isoDay(t.date), description: t.desc, category: t.cat, amount: t.amount, direction: t.type, status: t.status });

/* ---------------- chart builder ---------------- */
function buildChart(txs, endBalance) {
  const now = new Date(); const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: d.getFullYear() + "-" + d.getMonth(), month: d.toLocaleDateString("en-GB", { month: "short" }), in: 0, out: 0 });
  }
  const idx = {}; months.forEach((m, i) => (idx[m.key] = i));
  let totalNet = 0;
  txs.forEach((t) => {
    if (t.status === "Failed") return;
    const k = t.date.getFullYear() + "-" + t.date.getMonth();
    if (k in idx) { const m = months[idx[k]]; if (t.type === "in") { m.in += t.amount; totalNet += t.amount; } else { m.out += t.amount; totalNet -= t.amount; } }
  });
  let running = endBalance - totalNet;
  months.forEach((m) => { running += m.in - m.out; m.balance = running; });
  return months;
}

/* ---------------- theme ---------------- */
const useTheme = (dark) =>
  useMemo(() => (dark ? {
    app: "bg-slate-950 text-slate-100", sidebar: "bg-slate-900 border-slate-800", card: "bg-slate-900 border-slate-800",
    cardHover: "hover:border-slate-700", subtle: "text-slate-400", faint: "text-slate-500", divide: "divide-slate-800",
    rowHover: "hover:bg-slate-800/60", input: "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500", chip: "bg-slate-800",
    navIdle: "text-slate-400 hover:bg-slate-800 hover:text-slate-100", navActive: "bg-indigo-500/15 text-indigo-300", headerBorder: "border-slate-800",
    grid: "#1e293b", axis: "#64748b", tooltipBg: "#0f172a", tooltipBorder: "#1e293b", overlay: "bg-slate-950/70", track: "bg-slate-800",
  } : {
    app: "bg-gray-50 text-slate-800", sidebar: "bg-white border-gray-200", card: "bg-white border-gray-200",
    cardHover: "hover:border-gray-300", subtle: "text-slate-500", faint: "text-slate-400", divide: "divide-gray-100",
    rowHover: "hover:bg-gray-50", input: "bg-white border-gray-200 text-slate-800 placeholder-slate-400", chip: "bg-gray-100",
    navIdle: "text-slate-500 hover:bg-gray-100 hover:text-slate-900", navActive: "bg-indigo-50 text-indigo-700", headerBorder: "border-gray-200",
    grid: "#eef2f7", axis: "#94a3b8", tooltipBg: "#ffffff", tooltipBorder: "#e5e7eb", overlay: "bg-slate-900/40", track: "bg-gray-100",
  }), [dark]);

const NAV = [
  { key: "Dashboard", icon: LayoutDashboard }, { key: "Transactions", icon: ArrowLeftRight },
  { key: "Forecasting", icon: LineChartIcon }, { key: "Settings", icon: Settings },
];

/* ---------------- presentational pieces ---------------- */
function StatusPill({ status, dark }) {
  const map = {
    Completed: { icon: Check, light: "bg-emerald-50 text-emerald-700", dark: "bg-emerald-500/15 text-emerald-300" },
    Pending: { icon: Clock, light: "bg-amber-50 text-amber-700", dark: "bg-amber-500/15 text-amber-300" },
    Failed: { icon: AlertTriangle, light: "bg-red-50 text-red-600", dark: "bg-red-500/15 text-red-300" },
  };
  const s = map[status] || map.Completed; const Icon = s.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${dark ? s.dark : s.light}`}><Icon size={12} strokeWidth={2.5} />{status}</span>;
}

function MetricCard({ theme, label, value, delta, positive, tone, icon: Icon, onEdit, hideDelta }) {
  const toneRing = tone === "in" ? "text-emerald-500 bg-emerald-500/10" : tone === "out" ? "text-red-500 bg-red-500/10" : "text-indigo-500 bg-indigo-500/10";
  const Trend = positive ? TrendingUp : TrendingDown;
  return (
    <div className={`rounded-2xl border p-5 shadow-sm transition-colors ${theme.card} ${theme.cardHover}`}>
      <div className="flex items-start justify-between">
        <span className={`text-sm font-medium ${theme.subtle}`}>{label}</span>
        <div className="flex items-center gap-1.5">
          {onEdit && <button onClick={onEdit} aria-label="Edit balance" className={`grid h-8 w-8 place-items-center rounded-lg ${theme.chip} ${theme.subtle} hover:text-indigo-500`}><Pencil size={14} /></button>}
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${toneRing}`}><Icon size={18} strokeWidth={2.2} /></span>
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      {!hideDelta && <div className="mt-2 flex items-center gap-1.5 text-sm"><span className={`inline-flex items-center gap-0.5 font-semibold ${positive ? "text-emerald-500" : "text-red-500"}`}><Trend size={15} strokeWidth={2.4} />{delta}</span><span className={theme.faint}>vs last month</span></div>}
    </div>
  );
}

function InstallmentPanel({ theme, item, onUpdate, onPayment, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(item);
  const remaining = Math.max(0, item.total - item.paid);
  const pct = item.total > 0 ? Math.min(100, (item.paid / item.total) * 100) : 0;
  const done = remaining <= 0;
  const open = () => { setDraft({ label: item.label, total: String(item.total), paid: String(item.paid), monthly: String(item.monthly) }); setEdit(true); };
  const save = () => {
    const total = Math.max(0, parseFloat(draft.total) || 0);
    const paid = Math.min(total, Math.max(0, parseFloat(draft.paid) || 0));
    const monthly = Math.max(0, parseFloat(draft.monthly) || 0);
    onUpdate(item.id, { label: draft.label || "Installment", total, paid, monthly }); setEdit(false);
  };
  const fld = `w-full rounded-xl border px-3 py-2 text-sm tabular-nums outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${theme.input}`;
  const lbl = `mb-1 block text-xs font-semibold ${theme.subtle}`;
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${theme.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500"><CreditCard size={20} strokeWidth={2.2} /></span>
          <div><h3 className="text-base font-semibold">{item.label}</h3><p className={`text-xs ${theme.faint}`}>{kes(item.monthly)} / month</p></div>
        </div>
        {!edit && (
          <div className="flex items-center gap-1">
            <button onClick={open} className={`grid h-8 w-8 place-items-center rounded-lg ${theme.chip} ${theme.subtle} hover:text-indigo-500`} aria-label="Edit installment"><Pencil size={14} /></button>
            <button onClick={() => onDelete(item.id)} className={`grid h-8 w-8 place-items-center rounded-lg ${theme.chip} ${theme.subtle} hover:text-red-500`} aria-label="Delete installment"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      {edit ? (
        <div className="mt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={lbl}>Name</label><input className={fld} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Car loan" /></div>
            <div><label className={lbl}>Total price (KSh)</label><input type="number" className={fld} value={draft.total} onChange={(e) => setDraft({ ...draft, total: e.target.value })} /></div>
            <div><label className={lbl}>Paid so far (KSh)</label><input type="number" className={fld} value={draft.paid} onChange={(e) => setDraft({ ...draft, paid: e.target.value })} /></div>
            <div><label className={lbl}>Monthly installment (KSh)</label><input type="number" className={fld} value={draft.monthly} onChange={(e) => setDraft({ ...draft, monthly: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setEdit(false)} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${theme.card} ${theme.subtle}`}>Cancel</button>
            <button onClick={save} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Save</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div><div className={`text-xs ${theme.faint}`}>Remaining balance</div><div className="mt-0.5 text-2xl font-semibold tabular-nums text-indigo-500">{kes(remaining)}</div></div>
            <div><div className={`text-xs ${theme.faint}`}>Paid so far</div><div className="mt-0.5 text-2xl font-semibold tabular-nums text-emerald-500">{kes(item.paid)}</div></div>
            <div className="col-span-2 sm:col-span-1"><div className={`text-xs ${theme.faint}`}>Total price</div><div className="mt-0.5 text-2xl font-semibold tabular-nums">{kes(item.total)}</div></div>
          </div>
          <div className="mt-4">
            <div className={`mb-1.5 flex justify-between text-xs font-medium ${theme.subtle}`}><span>{pct.toFixed(1)}% paid off</span><span>{done ? "Fully paid 🎉" : `${kes(item.monthly)} due next`}</span></div>
            <div className={`h-2.5 w-full overflow-hidden rounded-full ${theme.track}`}><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
          <button onClick={() => onPayment(item.id)} disabled={done} className={`mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${done ? "cursor-not-allowed bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700"}`}><ArrowUpRight size={16} strokeWidth={2.5} />{done ? "Paid up" : "Record payment"}</button>
        </>
      )}
    </div>
  );
}

function CashFlowChart({ theme, dark, showBalance, data }) {
  const Custom = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="rounded-xl border px-3.5 py-2.5 text-sm shadow-lg" style={{ background: theme.tooltipBg, borderColor: theme.tooltipBorder }}>
        <div className={`mb-1.5 font-semibold ${dark ? "text-slate-100" : "text-slate-800"}`}>{label}</div>
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5" style={{ color: theme.axis }}><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}</span>
            <span className="font-semibold tabular-nums" style={{ color: dark ? "#e2e8f0" : "#1e293b" }}>{kes(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs><linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 12 }} dy={8} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={44} />
        <Tooltip content={<Custom />} cursor={{ fill: dark ? "#ffffff08" : "#00000006" }} />
        <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 13, paddingTop: 8, color: theme.axis }} />
        {showBalance && <Area type="monotone" dataKey="balance" name="Running balance" stroke="#6366f1" strokeWidth={2.5} fill="url(#balFill)" dot={false} activeDot={{ r: 4 }} />}
        <Bar dataKey="in" name="Cash in" fill="#10b981" radius={[6, 6, 0, 0]} barSize={16} />
        <Bar dataKey="out" name="Cash out" fill="#f87171" radius={[6, 6, 0, 0]} barSize={16} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function TransactionModal({ theme, initial, categories, onClose, onSave }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({ desc: initial?.desc || "", amount: initial ? String(initial.amount) : "", type: initial?.type || "in", cat: initial?.cat || (categories[0] || ""), status: initial?.status || "Completed" });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    const amt = parseFloat(form.amount); if (!form.desc.trim() || isNaN(amt) || amt <= 0) return;
    setBusy(true);
    await onSave({ id: isEdit ? initial.id : undefined, date: isEdit ? initial.date : new Date(), desc: form.desc.trim(), cat: form.cat || "Uncategorised", amount: amt, type: form.type, status: form.status });
    setBusy(false);
  };
  const field = `w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${theme.input}`;
  const labelCls = `mb-1.5 block text-xs font-semibold ${theme.subtle}`;
  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 ${theme.overlay}`} onClick={onClose}>
      <div className={`w-full max-w-md rounded-t-3xl border p-6 shadow-2xl sm:rounded-3xl ${theme.card}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-semibold">{isEdit ? "Edit transaction" : "Add transaction"}</h3><button onClick={onClose} className={`grid h-8 w-8 place-items-center rounded-lg ${theme.chip} ${theme.subtle}`}><X size={16} /></button></div>
        <div className={`mb-4 grid grid-cols-2 gap-1 rounded-xl p-1 ${theme.chip}`}>
          {[{ k: "in", label: "Money in", color: "bg-emerald-500" }, { k: "out", label: "Money out", color: "bg-red-500" }].map((o) => (
            <button key={o.k} onClick={() => set("type", o.k)} className={`rounded-lg py-2 text-sm font-medium transition ${form.type === o.k ? `${o.color} text-white shadow-sm` : theme.subtle}`}>{o.label}</button>
          ))}
        </div>
        <div className="space-y-4">
          <div><label className={labelCls}>Description</label><input className={field} placeholder="e.g. Client invoice #1043" value={form.desc} onChange={(e) => set("desc", e.target.value)} /></div>
          <div><label className={labelCls}>Amount</label><div className="relative"><span className={`pointer-events-none absolute left-3.5 top-2.5 text-sm ${theme.faint}`}>KSh</span><input type="number" className={`${field} pl-12`} placeholder="0.00" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></div></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Category</label><input className={field} list="cat-options" value={form.cat} onChange={(e) => set("cat", e.target.value)} placeholder="Type or pick" /><datalist id="cat-options">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
            <div><label className={labelCls}>Status</label><select className={field} value={form.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
        </div>
        <div className="mt-6 flex gap-3"><button onClick={onClose} className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold ${theme.card} ${theme.subtle}`}>Cancel</button><button onClick={save} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">{busy && <Loader2 size={15} className="animate-spin" />}{isEdit ? "Save changes" : "Save transaction"}</button></div>
      </div>
    </div>
  );
}

function SettingsView({ theme, dark, setDark, categories, addCategory, removeCategory, installments, addInstallment, removeInstallment }) {
  const [catDraft, setCatDraft] = useState("");
  const [inst, setInst] = useState({ label: "", total: "", monthly: "", paid: "" });
  const submitCat = async () => { await addCategory(catDraft); setCatDraft(""); };
  const submitInst = async () => { const ok = await addInstallment(inst); if (ok) setInst({ label: "", total: "", monthly: "", paid: "" }); };
  const fld = `w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${theme.input}`;
  const lbl = `mb-1 block text-xs font-semibold ${theme.subtle}`;
  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border p-5 shadow-sm ${theme.card}`}>
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500"><CreditCard size={20} strokeWidth={2.2} /></span><div><h2 className="text-base font-semibold">Installments</h2><p className={`text-xs ${theme.faint}`}>Track anything you're paying off monthly</p></div></div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={lbl}>What is it?</label><input className={fld} value={inst.label} onChange={(e) => setInst({ ...inst, label: e.target.value })} placeholder="e.g. Car loan, Land, Laptop" /></div>
          <div><label className={lbl}>Total price (KSh)</label><input type="number" className={fld} value={inst.total} onChange={(e) => setInst({ ...inst, total: e.target.value })} placeholder="0" /></div>
          <div><label className={lbl}>Monthly installment (KSh)</label><input type="number" className={fld} value={inst.monthly} onChange={(e) => setInst({ ...inst, monthly: e.target.value })} placeholder="0" /></div>
          <div><label className={lbl}>Already paid (KSh) — optional</label><input type="number" className={fld} value={inst.paid} onChange={(e) => setInst({ ...inst, paid: e.target.value })} placeholder="0" /></div>
          <div className="flex items-end"><button onClick={submitInst} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={16} strokeWidth={2.5} />Add installment</button></div>
        </div>
        {installments.length > 0 && (
          <div className={`mt-4 divide-y rounded-xl border ${theme.divide} ${theme.headerBorder}`}>
            {installments.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div><div className="text-sm font-semibold">{it.label}</div><div className={`text-xs ${theme.faint}`}>{kes(Math.max(0, it.total - it.paid))} left · {kes(it.monthly)}/mo</div></div>
                <button onClick={() => removeInstallment(it.id)} aria-label={`Remove ${it.label}`} className={`grid h-8 w-8 place-items-center rounded-lg ${theme.chip} ${theme.subtle} hover:text-red-500`}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`rounded-2xl border p-5 shadow-sm ${theme.card}`}>
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500"><Tag size={20} strokeWidth={2.2} /></span><div><h2 className="text-base font-semibold">Categories</h2><p className={`text-xs ${theme.faint}`}>Add your own, or remove ones you don't use</p></div></div>
        <div className="mt-4 flex gap-2">
          <input value={catDraft} onChange={(e) => setCatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitCat(); }} placeholder="New category name" className={fld} />
          <button onClick={submitCat} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={16} strokeWidth={2.5} />Add</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.length === 0 && <p className={`text-sm ${theme.subtle}`}>No categories yet — add one above.</p>}
          {categories.map((c) => (<span key={c} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${theme.chip} ${theme.subtle}`}>{c}<button onClick={() => removeCategory(c)} aria-label={`Remove ${c}`} className="grid h-4 w-4 place-items-center rounded-full hover:text-red-500"><X size={13} /></button></span>))}
        </div>
      </div>

      <div className={`rounded-2xl border p-5 shadow-sm ${theme.card}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500">{dark ? <Moon size={20} /> : <Sun size={20} />}</span><div><h2 className="text-base font-semibold">Appearance</h2><p className={`text-xs ${theme.faint}`}>{dark ? "Dark mode is on" : "Light mode is on"}</p></div></div>
          <button onClick={() => setDark((d) => !d)} className={`relative h-7 w-12 rounded-full transition ${dark ? "bg-indigo-600" : "bg-gray-300"}`} aria-label="Toggle dark mode"><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${dark ? "left-5" : "left-0.5"}`} /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- config gate (no env vars) ---------------- */
function SetupScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-slate-800" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-indigo-600 text-white"><Wallet size={22} /></div>
        <h1 className="text-xl font-semibold">Connect Supabase to start</h1>
        <p className="mt-2 text-sm text-slate-500">Fluxbook needs your Supabase keys. Create a <code className="rounded bg-gray-100 px-1">.env</code> file (or set them in Netlify → Site settings → Environment variables):</p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">VITE_SUPABASE_URL=https://YOUR-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key</pre>
        <p className="mt-4 text-sm text-slate-500">Then run <code className="rounded bg-gray-100 px-1">supabase-schema.sql</code> in the Supabase SQL editor and reload.</p>
      </div>
    </div>
  );
}

/* ---------------- login screen (accounts are created by the admin) ---------------- */
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) setErr(error.message);
    setBusy(false);
  };
  const field = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-slate-800" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white"><Wallet size={20} /></div>
          <div className="leading-tight"><div className="text-base font-semibold">Fluxbook</div><div className="text-xs text-slate-400">Cash flow</div></div>
        </div>
        <h1 className="text-lg font-semibold">Log in</h1>
        <p className="mt-1 text-sm text-slate-500">Enter the email and password you were given.</p>
        <div className="mt-5 space-y-3">
          <div><label className="mb-1 block text-xs font-semibold text-slate-500">Email</label><input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="you@example.com" /></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-500">Password</label><input type="password" className={field} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="••••••••" /></div>
        </div>
        {err && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        <button onClick={submit} disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
          {busy && <Loader2 size={15} className="animate-spin" />} Log in
        </button>
        <p className="mt-4 text-center text-xs text-slate-400">Accounts are created by the administrator.</p>
      </div>
    </div>
  );
}

/* ---------------- main app ---------------- */
export default function App() {
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  const [txs, setTxs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [balanceBase, setBalanceBase] = useState(0);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState("");
  const balanceInputRef = useRef(null);
  const theme = useTheme(dark);

  /* ---- track the logged-in user ---- */
  useEffect(() => {
    if (!supabaseReady) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const logout = async () => { await supabase.auth.signOut(); setTxs([]); setInstallments([]); setCategories([]); setBalanceBase(0); };

  /* ---- load everything from Supabase (per user) ---- */
  useEffect(() => {
    if (!supabaseReady || !user) { setLoading(false); return; }
    (async () => {
      try {
        setLoading(true);
        const [txRes, catRes, instRes, setRes] = await Promise.all([
          supabase.from("transactions").select("*").order("txn_date", { ascending: false }),
          supabase.from("categories").select("*").order("name"),
          supabase.from("installments").select("*").order("label"),
          supabase.from("settings").select("*").maybeSingle(),
        ]);
        if (txRes.error) throw txRes.error;
        if (catRes.error) throw catRes.error;
        if (instRes.error) throw instRes.error;
        setTxs((txRes.data || []).map(fromTxRow));
        let cats = (catRes.data || []).map((r) => r.name);
        if (cats.length === 0) {
          await supabase.from("categories").insert(DEFAULT_CATEGORIES.map((name) => ({ name })));
          cats = DEFAULT_CATEGORIES;
        }
        setCategories(cats);
        setInstallments((instRes.data || []).map((r) => ({ id: r.id, label: r.label, total: Number(r.total), paid: Number(r.paid), monthly: Number(r.monthly) })));
        if (setRes.data) setBalanceBase(Number(setRes.data.balance_base));
        else { await supabase.from("settings").insert({ balance_base: 0 }); setBalanceBase(0); }
      } catch (e) { setErrorMsg(e.message || String(e)); }
      finally { setLoading(false); }
    })();
  }, [user]);

  const metrics = useMemo(() => {
    const cutoff = daysAgo(30); let cashIn = 0, cashOut = 0;
    txs.forEach((t) => { if (t.date >= cutoff && t.status !== "Failed") { if (t.type === "in") cashIn += t.amount; else cashOut += t.amount; } });
    return { cashIn, cashOut, balance: balanceBase + cashIn - cashOut };
  }, [txs, balanceBase]);

  const chartData = useMemo(() => buildChart(txs, metrics.balance), [txs, metrics.balance]);
  const sortedTx = useMemo(() => [...txs].sort((a, b) => b.date - a.date), [txs]);

  useEffect(() => { if (editingBalance && balanceInputRef.current) balanceInputRef.current.focus(); }, [editingBalance]);

  const fail = (e) => setErrorMsg(e.message || String(e));

  /* ---- transaction ops ---- */
  const openAdd = () => { setEditingTx(null); setModalOpen(true); };
  const openEdit = (t) => { setEditingTx(t); setModalOpen(true); };
  const saveTx = async (t) => {
    try {
      if (t.id) {
        const { error } = await supabase.from("transactions").update(toTxRow(t)).eq("id", t.id);
        if (error) throw error;
        setTxs((prev) => prev.map((x) => (x.id === t.id ? t : x)));
      } else {
        const { data, error } = await supabase.from("transactions").insert(toTxRow(t)).select().single();
        if (error) throw error;
        setTxs((prev) => [fromTxRow(data), ...prev]);
      }
      setModalOpen(false); setEditingTx(null);
    } catch (e) { fail(e); }
  };
  const deleteTx = async (id) => {
    try { const { error } = await supabase.from("transactions").delete().eq("id", id); if (error) throw error; setTxs((prev) => prev.filter((x) => x.id !== id)); } catch (e) { fail(e); }
  };
  const clearAll = async () => {
    try { const { error } = await supabase.from("transactions").delete().eq("user_id", user.id); if (error) throw error; setTxs([]); setConfirmClear(false); } catch (e) { fail(e); }
  };

  /* ---- category ops ---- */
  const addCategory = async (name) => {
    const v = (name || "").trim(); if (!v || categories.some((c) => c.toLowerCase() === v.toLowerCase())) return;
    try { const { error } = await supabase.from("categories").insert({ name: v }); if (error) throw error; setCategories((prev) => [...prev, v]); } catch (e) { fail(e); }
  };
  const removeCategory = async (c) => {
    try { const { error } = await supabase.from("categories").delete().eq("name", c); if (error) throw error; setCategories((prev) => prev.filter((x) => x !== c)); } catch (e) { fail(e); }
  };

  /* ---- installment ops ---- */
  const addInstallment = async ({ label, total, monthly, paid }) => {
    const name = (label || "").trim();
    const t = Math.max(0, parseFloat(total) || 0);
    const m = Math.max(0, parseFloat(monthly) || 0);
    const p = Math.min(t, Math.max(0, parseFloat(paid) || 0));
    if (!name || t <= 0) return false;
    try {
      const { data, error } = await supabase.from("installments").insert({ label: name, total: t, paid: p, monthly: m }).select().single();
      if (error) throw error;
      setInstallments((prev) => [...prev, { id: data.id, label: data.label, total: Number(data.total), paid: Number(data.paid), monthly: Number(data.monthly) }]);
      return true;
    } catch (e) { fail(e); return false; }
  };
  const updateInstallment = async (id, patch) => {
    try { const { error } = await supabase.from("installments").update(patch).eq("id", id); if (error) throw error; setInstallments((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))); } catch (e) { fail(e); }
  };
  const removeInstallment = async (id) => {
    try { const { error } = await supabase.from("installments").delete().eq("id", id); if (error) throw error; setInstallments((prev) => prev.filter((x) => x.id !== id)); } catch (e) { fail(e); }
  };
  const recordPayment = async (id) => {
    const it = installments.find((x) => x.id === id); if (!it) return;
    const remaining = Math.max(0, it.total - it.paid); if (remaining <= 0) return;
    const pay = Math.min(it.monthly, remaining);
    try {
      const { data, error } = await supabase.from("transactions").insert(toTxRow({ date: new Date(), desc: `${it.label} — installment`, cat: "Installments", amount: pay, type: "out", status: "Completed" })).select().single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("installments").update({ paid: it.paid + pay }).eq("id", id);
      if (e2) throw e2;
      setTxs((prev) => [fromTxRow(data), ...prev]);
      setInstallments((prev) => prev.map((x) => (x.id === id ? { ...x, paid: x.paid + pay } : x)));
    } catch (e) { fail(e); }
  };

  /* ---- balance ops ---- */
  const startEditBalance = () => { setBalanceDraft(String(metrics.balance)); setEditingBalance(true); };
  const commitBalance = async () => {
    const v = parseFloat(balanceDraft);
    if (!isNaN(v)) {
      const base = v - metrics.cashIn + metrics.cashOut;
      try { const { error } = await supabase.from("settings").update({ balance_base: base }).eq("user_id", user.id); if (error) throw error; setBalanceBase(base); } catch (e) { fail(e); }
    }
    setEditingBalance(false);
  };
  const cancelBalance = () => setEditingBalance(false);

  /* ---- excel export (all transaction columns) ---- */
  const exportExcel = () => {
    const rows = sortedTx.map((t) => ({
      Date: t.date.toLocaleDateString("en-GB"),
      Description: t.desc,
      Category: t.cat,
      Direction: t.type === "in" ? "Money in" : "Money out",
      "Amount (KSh)": t.type === "in" ? t.amount : -t.amount,
      Status: t.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Date: "", Description: "No transactions", Category: "", Direction: "", "Amount (KSh)": "", Status: "" }]);
    ws["!cols"] = [{ wch: 12 }, { wch: 36 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
    const summaryRows = [
      { Metric: "Current balance", "Value (KSh)": metrics.balance },
      { Metric: "Cash in (30 days)", "Value (KSh)": metrics.cashIn },
      { Metric: "Cash out (30 days)", "Value (KSh)": metrics.cashOut },
    ];
    installments.forEach((it) => summaryRows.push({ Metric: it.label + " — remaining", "Value (KSh)": Math.max(0, it.total - it.paid) }));
    const summary = XLSX.utils.json_to_sheet(summaryRows); summary["!cols"] = [{ wch: 30 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summary, "Summary");
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "fluxbook-cashflow.xlsx";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  if (!supabaseReady) return <SetupScreen />;
  if (authLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-slate-500" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="flex items-center gap-3"><Loader2 className="animate-spin" size={20} /> Loading…</div>
    </div>
  );
  if (!user) return <LoginScreen />;
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-slate-500" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="flex items-center gap-3"><Loader2 className="animate-spin" size={20} /> Loading your data…</div>
    </div>
  );

  const balanceValue = editingBalance ? (
    <div className="mt-1 flex items-center gap-2">
      <div className="relative flex-1"><span className={`pointer-events-none absolute left-3 top-2 text-sm ${theme.faint}`}>KSh</span>
        <input ref={balanceInputRef} type="number" value={balanceDraft} onChange={(e) => setBalanceDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commitBalance(); if (e.key === "Escape") cancelBalance(); }} className={`w-full rounded-xl border py-2 pl-12 pr-3 text-lg font-semibold tabular-nums outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${theme.input}`} /></div>
      <button onClick={commitBalance} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"><Check size={17} /></button>
      <button onClick={cancelBalance} className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${theme.chip} ${theme.subtle}`}><X size={17} /></button>
    </div>
  ) : kes(metrics.balance);

  const Sidebar = (
    <aside className={`flex h-full w-64 flex-col border-r ${theme.sidebar}`}>
      <div className="flex items-center gap-2.5 px-5 py-5"><div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm"><Wallet size={18} strokeWidth={2.4} /></div><div className="leading-tight"><div className="text-sm font-semibold">Fluxbook</div><div className={`text-xs ${theme.faint}`}>Cash flow</div></div></div>
      <nav className="mt-2 flex-1 space-y-1 px-3">{NAV.map(({ key, icon: Icon }) => (<button key={key} onClick={() => { setActive(key); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active === key ? theme.navActive : theme.navIdle}`}><Icon size={18} strokeWidth={2.1} />{key}</button>))}</nav>
      <div className={`m-3 rounded-2xl border p-4 ${theme.card}`}>
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="truncate text-sm font-semibold">{user?.email}</span></div>
        <button onClick={logout} className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-semibold ${theme.card} ${theme.subtle} hover:text-red-500`}><LogOut size={15} />Log out</button>
      </div>
    </aside>
  );

  const showCards = active === "Dashboard" || active === "Transactions";
  const showInstallments = active === "Dashboard";
  const showChart = active === "Dashboard" || active === "Forecasting";
  const showTx = active === "Dashboard" || active === "Transactions";
  const showSettings = active === "Settings";

  return (
    <div className={`flex min-h-screen w-full ${theme.app}`}>
      <div className="hidden lg:block">{Sidebar}</div>
      {sidebarOpen && (<div className="fixed inset-0 z-40 lg:hidden"><div className={`absolute inset-0 ${theme.overlay}`} onClick={() => setSidebarOpen(false)} /><div className="absolute left-0 top-0 h-full">{Sidebar}</div></div>)}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={`sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3.5 backdrop-blur sm:px-6 ${theme.headerBorder} ${dark ? "bg-slate-950/80" : "bg-gray-50/80"}`}>
          <button onClick={() => setSidebarOpen(true)} className={`grid h-9 w-9 place-items-center rounded-lg lg:hidden ${theme.chip} ${theme.subtle}`}><Menu size={18} /></button>
          <div className="min-w-0"><h1 className="truncate text-lg font-semibold tracking-tight">{active}</h1><p className={`hidden text-xs sm:block ${theme.faint}`}>{new Date().toLocaleDateString("en-GB", { weekday: "long", month: "long", day: "numeric" })}</p></div>
          <div className="ml-auto flex items-center gap-2">
            <div className={`hidden items-center gap-2 rounded-xl border px-3 py-2 md:flex ${theme.card}`}><Search size={15} className={theme.faint} /><input placeholder="Search" className={`w-28 bg-transparent text-sm outline-none ${theme.subtle}`} /></div>
            <button className={`grid h-9 w-9 place-items-center rounded-lg border ${theme.card} ${theme.subtle}`}><Bell size={17} /></button>
            <button onClick={() => setDark((d) => !d)} aria-label="Toggle dark mode" className={`grid h-9 w-9 place-items-center rounded-lg border ${theme.card} ${theme.subtle}`}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
            <button onClick={openAdd} className="hidden items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:flex"><Plus size={17} strokeWidth={2.5} />Add transaction</button>
          </div>
        </header>

        {errorMsg && (
          <div className="mx-auto mt-4 flex w-full max-w-6xl items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="rounded-lg p-1 hover:bg-red-100"><X size={15} /></button>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {showSettings ? (
            <SettingsView theme={theme} dark={dark} setDark={setDark} categories={categories} addCategory={addCategory} removeCategory={removeCategory} installments={installments} addInstallment={addInstallment} removeInstallment={removeInstallment} />
          ) : (
            <>
              {showCards && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <MetricCard theme={theme} label="Current balance" value={balanceValue} delta="+5.2%" positive tone="balance" icon={Wallet} onEdit={editingBalance ? undefined : startEditBalance} hideDelta={editingBalance} />
                  <MetricCard theme={theme} label="Cash in · 30 days" value={kes(metrics.cashIn)} delta="+12.4%" positive tone="in" icon={ArrowUpRight} />
                  <MetricCard theme={theme} label="Cash out · 30 days" value={kes(metrics.cashOut)} delta="+3.1%" positive={false} tone="out" icon={ArrowDownRight} />
                </div>
              )}

              {showInstallments && installments.length > 0 && (
                <div className="mt-5">
                  <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Installments</h2><button onClick={() => setActive("Settings")} className="text-sm font-semibold text-indigo-500 hover:text-indigo-600">+ New installment</button></div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{installments.map((it) => (<InstallmentPanel key={it.id} theme={theme} item={it} onUpdate={updateInstallment} onPayment={recordPayment} onDelete={removeInstallment} />))}</div>
                </div>
              )}

              {showChart && (
                <div className={`mt-5 rounded-2xl border p-5 shadow-sm ${theme.card}`}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Cash in vs. cash out</h2><p className={`text-xs ${theme.faint}`}>Last 6 months · from your transactions</p></div><button onClick={() => setShowBalance((s) => !s)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${showBalance ? "border-indigo-500/40 text-indigo-500" : `${theme.card} ${theme.subtle}`}`}>{showBalance ? "Hide" : "Show"} balance line</button></div>
                  <CashFlowChart theme={theme} dark={dark} showBalance={showBalance} data={chartData} />
                </div>
              )}

              {showTx && (
                <div className={`mt-5 overflow-hidden rounded-2xl border shadow-sm ${theme.card}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <h2 className="text-base font-semibold">Recent transactions</h2>
                    <div className="flex items-center gap-2">
                      <button onClick={exportExcel} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/10"><FileSpreadsheet size={14} />Export Excel</button>
                      {confirmClear ? (
                        <div className="flex items-center gap-1.5"><span className={`text-xs ${theme.subtle}`}>Clear all?</span><button onClick={clearAll} className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600">Yes</button><button onClick={() => setConfirmClear(false)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${theme.chip} ${theme.subtle}`}>No</button></div>
                      ) : (
                        <button onClick={() => setConfirmClear(true)} disabled={!txs.length} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${txs.length ? "border-red-500/40 text-red-500 hover:bg-red-500/10" : `${theme.card} ${theme.faint} cursor-not-allowed`}`}><Trash2 size={14} />Clear all</button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead><tr className={`border-t text-left text-xs uppercase tracking-wide ${theme.headerBorder} ${theme.faint}`}><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 font-semibold">Description</th><th className="px-5 py-3 font-semibold">Category</th><th className="px-5 py-3 text-right font-semibold">Amount</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr></thead>
                      <tbody className={`divide-y ${theme.divide}`}>
                        {sortedTx.length === 0 && (<tr><td colSpan={6} className={`px-5 py-10 text-center ${theme.subtle}`}>No transactions yet. Add your first one to get started.</td></tr>)}
                        {sortedTx.map((t) => (
                          <tr key={t.id} className={`transition-colors ${theme.rowHover}`}>
                            <td className={`whitespace-nowrap px-5 py-3.5 tabular-nums ${theme.subtle}`}>{fmtDate(t.date)}</td>
                            <td className="px-5 py-3.5 font-medium">{t.desc}</td>
                            <td className="px-5 py-3.5"><span className={`rounded-md px-2 py-1 text-xs font-medium ${theme.chip} ${theme.subtle}`}>{t.cat}</span></td>
                            <td className={`whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums ${t.type === "in" ? "text-emerald-500" : "text-red-500"}`}>{t.type === "in" ? "+" : "−"}{kes(t.amount, true)}</td>
                            <td className="px-5 py-3.5"><StatusPill status={t.status} dark={dark} /></td>
                            <td className="px-5 py-3.5"><div className="flex items-center justify-end gap-1"><button onClick={() => openEdit(t)} aria-label="Edit transaction" className={`grid h-8 w-8 place-items-center rounded-lg ${theme.subtle} hover:bg-indigo-500/10 hover:text-indigo-500`}><Pencil size={15} /></button><button onClick={() => deleteTx(t.id)} aria-label="Delete transaction" className={`grid h-8 w-8 place-items-center rounded-lg ${theme.subtle} hover:bg-red-500/10 hover:text-red-500`}><Trash2 size={15} /></button></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <button onClick={openAdd} aria-label="Add transaction" className="fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition hover:scale-105 hover:bg-indigo-700 active:scale-95 sm:hidden"><Plus size={24} strokeWidth={2.5} /></button>
      {modalOpen && <TransactionModal theme={theme} initial={editingTx} categories={categories} onClose={() => { setModalOpen(false); setEditingTx(null); }} onSave={saveTx} />}
    </div>
  );
}
