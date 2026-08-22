import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { fetchSalesReport } from "../supabase/sales_report";

/* ---------------- constants ---------------- */

const PAGE_SIZE = 20;

const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/* ---------------- helpers ---------------- */

/** "01-Apr-23" -> JS Date (or null) */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const month = MONTHS[parts[1]];
  const year = 2000 + parseInt(parts[2], 10);
  const day = parseInt(parts[0], 10);
  if (!month || isNaN(year) || isNaN(day)) return null;
  return new Date(year, month - 1, day);
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const inr = (n) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** "Apr-23" -> sortable number 2304 */
const monthSortKey = (my) => {
  if (!my) return 0;
  const [m, y] = my.split("-");
  return (2000 + parseInt(y, 10)) * 100 + (MONTHS[m] || 0);
};

/* ---------------- KPI config ---------------- */

const KPI_DEFS = [
  {
    key: "today",
    label: "Today",
    accent: { bar: "bg-emerald-500", text: "text-emerald-600", soft: "bg-emerald-50", ring: "ring-emerald-500" },
    match: (d, now) => d && sameDay(d, now),
  },
  {
    key: "yesterday",
    label: "Yesterday",
    accent: { bar: "bg-sky-500", text: "text-sky-600", soft: "bg-sky-50", ring: "ring-sky-500" },
    match: (d, now) => {
      if (!d) return false;
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return sameDay(d, y);
    },
  },
  {
    key: "last7",
    label: "Last 7 Days",
    accent: { bar: "bg-orange-500", text: "text-orange-600", soft: "bg-orange-50", ring: "ring-orange-500" },
    match: (d, now) => {
      if (!d) return false;
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return d >= from && d <= now;
    },
  },
  {
    key: "last30",
    label: "Last 30 Days",
    accent: { bar: "bg-violet-500", text: "text-violet-600", soft: "bg-violet-50", ring: "ring-violet-500" },
    match: (d, now) => {
      if (!d) return false;
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return d >= from && d <= now;
    },
  },
  {
    key: "thisYear",
    label: "This Year",
    accent: { bar: "bg-rose-500", text: "text-rose-600", soft: "bg-rose-50", ring: "ring-rose-500" },
    match: (d, now) => d && d.getFullYear() === now.getFullYear(),
  },
  {
    key: "total",
    label: "Total",
    accent: { bar: "bg-blue-600", text: "text-blue-700", soft: "bg-blue-50", ring: "ring-blue-600" },
    match: () => true,
  },
];

/* ---------------- small components ---------------- */

function KpiCard({ def, count, amount, active, onClick }) {
  const a = def.accent;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative overflow-hidden rounded-xl border bg-white p-4 text-left shadow-sm transition-all ${
        active
          ? `border-transparent ring-2 ${a.ring} shadow-md`
          : "border-slate-200 hover:border-slate-300 hover:shadow"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {def.label}
        </span>
        <span className={`h-2 w-2 rounded-full ${a.bar}`} />
      </div>
      <div className={`mt-2 text-2xl font-bold ${a.text}`}>{count}</div>
      <div className="mt-1 truncate text-xs text-slate-500">₹ {inr(amount)}</div>
      <span className={`absolute inset-x-0 bottom-0 h-1 ${active ? a.bar : "bg-transparent"}`} />
    </motion.button>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
      <span className="whitespace-nowrap text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[150px] cursor-pointer bg-transparent text-sm font-medium text-slate-700 outline-none"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function SkeletonRows({ cols, rows = 8 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r} className="border-b border-slate-100">
      {Array.from({ length: cols }).map((__, c) => (
        <td key={c} className="px-4 py-3.5">
          <div
            className="h-3.5 animate-pulse rounded-full bg-slate-200"
            style={{ width: `${50 + ((r + c) % 4) * 14}%` }}
          />
        </td>
      ))}
    </tr>
  ));
}

/* ---------------- main page ---------------- */

export default function SalersReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [kpiFilter, setKpiFilter] = useState("total"); // key of KPI_DEFS
  const [salesman, setSalesman] = useState("");
  const [year, setYear] = useState("");
  const [fy, setFy] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);

  /* fetch once */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await fetchSalesReport();
      if (error) setErrorMsg(error.message || "Failed to fetch sales report.");
      // attach a parsed Date to every row once
      setRows((data || []).map((r) => ({ ...r, _d: parseDate(r.date) })));
      setLoading(false);
    })();
  }, []);

  const now = useMemo(() => new Date(), []);

  /* KPI stats always reflect the full dataset */
  const kpiStats = useMemo(() => {
    const stats = {};
    for (const def of KPI_DEFS) {
      const list = rows.filter((r) => def.match(r._d, now));
      stats[def.key] = {
        count: list.length,
        amount: list.reduce((s, r) => s + (Number(r.debit) || 0), 0),
      };
    }
    return stats;
  }, [rows, now]);

  /* dropdown options from the full dataset */
  const options = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))];
    return {
      salesmen: uniq(rows.map((r) => r.salesman_name)).sort(),
      years: uniq(rows.map((r) => r._d && String(r._d.getFullYear()))).sort(),
      fys: uniq(rows.map((r) => r.fy)).sort(),
      months: uniq(rows.map((r) => r.month_year)).sort(
        (a, b) => monthSortKey(a) - monthSortKey(b)
      ),
    };
  }, [rows]);

  /* combined filtering: KPI range + dropdowns */
  const filtered = useMemo(() => {
    const def = KPI_DEFS.find((k) => k.key === kpiFilter) || KPI_DEFS[5];
    return rows.filter((r) => {
      if (!def.match(r._d, now)) return false;
      if (salesman && r.salesman_name !== salesman) return false;
      if (year && (!r._d || String(r._d.getFullYear()) !== year)) return false;
      if (fy && r.fy !== fy) return false;
      if (month && r.month_year !== month) return false;
      return true;
    });
  }, [rows, kpiFilter, salesman, year, fy, month, now]);

  /* reset pagination whenever the result set changes */
  useEffect(() => {
    setPage(1);
  }, [kpiFilter, salesman, year, fy, month, rows.length]);

  const totalDebit = useMemo(
    () => filtered.reduce((s, r) => s + (Number(r.debit) || 0), 0),
    [filtered]
  );

  /* pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const pageNumbers = useMemo(() => {
    const nums = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    return [...nums].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  /* chart: month vs total debit (follows the active filters) */
  const chartData = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      if (!r.month_year) continue;
      map.set(r.month_year, (map.get(r.month_year) || 0) + (Number(r.debit) || 0));
    }
    return [...map.entries()]
      .map(([m, debit]) => ({ month: m, debit: Math.round(debit) }))
      .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month));
  }, [filtered]);

  const clearFilters = () => {
    setKpiFilter("total");
    setSalesman("");
    setYear("");
    setFy("");
    setMonth("");
  };

  const activeFilterCount =
    [salesman, year, fy, month].filter(Boolean).length + (kpiFilter !== "total" ? 1 : 0);

  const columns = [
    { key: "date", label: "Date" },
    { key: "particulars", label: "Particulars" },
    { key: "vch_type", label: "Vch Type" },
    { key: "vch_no", label: "Vch No" },
    { key: "debit", label: "Debit" },
    { key: "credit_amt", label: "Credit Amt" },
    { key: "salesman_name", label: "Salesman" },
    { key: "month_year", label: "Month" },
    { key: "fy", label: "FY" },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ---------- fixed sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/30">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">Sale Manager</span>
        </div>

        <div className="px-5 pt-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Reports
          </p>
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-3 text-sm font-medium shadow-lg shadow-orange-600/30">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Sales Report
          </div>
        </div>

        <div className="mt-auto border-t border-slate-800 px-5 py-4">
          {/* If you are not using react-router-dom, replace <Link to="/"> with <a href="/"> */}
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-orange-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7 7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </aside>

      {/* ---------- scrollable main ---------- */}
      <main className="ml-60 px-6 py-6 lg:px-8">
        {/* header banner */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col gap-4 rounded-2xl bg-slate-900 px-6 py-5 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-3" />
              </svg>
            </span>
            <div>
              <h1 className="text-xl font-semibold">Sales Report</h1>
              <p className="text-xs text-slate-400">
                {loading ? "Loading records…" : `${rows.length} records loaded`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { label: "Total", value: rows.length },
              { label: "Filtered", value: filtered.length },
              { label: "Filters", value: activeFilterCount },
            ].map((b) => (
              <div
                key={b.label}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-center"
              >
                <div className="text-lg font-bold leading-tight">{b.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">{b.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* error banner */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI cards — click to filter */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
          className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        >
          {KPI_DEFS.map((def) => (
            <KpiCard
              key={def.key}
              def={def}
              count={loading ? "…" : kpiStats[def.key]?.count ?? 0}
              amount={loading ? null : kpiStats[def.key]?.amount ?? 0}
              active={kpiFilter === def.key}
              onClick={() =>
                setKpiFilter((cur) => (cur === def.key ? "total" : def.key))
              }
            />
          ))}
        </motion.div>

        {/* filter row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          className="mt-5 flex flex-wrap items-center gap-3"
        >
          <FilterSelect label="Salesman Wise" value={salesman} onChange={setSalesman} options={options.salesmen} />
          <FilterSelect label="Year Wise" value={year} onChange={setYear} options={options.years} />
          <FilterSelect label="FY Wise" value={fy} onChange={setFy} options={options.fys} />
          <FilterSelect label="Month Wise" value={month} onChange={setMonth} options={options.months} />
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-100"
            >
              Clear filters ✕
            </button>
          )}
        </motion.div>

        {/* table card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
          className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-orange-500" />
              <h2 className="font-semibold text-slate-800">Sales Report Records</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                {filtered.length}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Total Debit:{" "}
              <span className="font-semibold text-slate-700">₹ {inr(totalDebit)}</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={columns.length} />
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-5 py-14 text-center text-slate-400">
                      No records match the current filters.
                    </td>
                  </tr>
                ) : (
                  paginated.map((r, i) => (
                    <motion.tr
                      key={r.id ?? `${currentPage}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.25, ease: "easeOut" }}
                      className="border-b border-slate-100 transition-colors odd:bg-slate-50/50 hover:bg-orange-50/60"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{r.date || "—"}</td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-slate-600" title={r.particulars}>
                        {r.particulars || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {r.vch_type || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.vch_no || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-emerald-600">
                        {r.debit ? `₹ ${inr(r.debit)}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-rose-500">
                        {r.credit_amt ? `₹ ${inr(r.credit_amt)}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                          {r.salesman_name || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.month_year || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.fy || "—"}</td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* pagination footer */}
          {!loading && filtered.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} records
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-orange-400 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>

                {pageNumbers.map((n, idx) => {
                  const prevN = pageNumbers[idx - 1];
                  const gap = prevN !== undefined && n - prevN > 1;
                  return (
                    <span key={n} className="flex items-center gap-1.5">
                      {gap && <span className="px-1 text-xs text-slate-400">…</span>}
                      <button
                        onClick={() => setPage(n)}
                        className={`h-7 w-7 rounded-lg text-xs font-medium transition-colors ${
                          n === currentPage
                            ? "bg-orange-500 text-white shadow shadow-orange-500/30"
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {n}
                      </button>
                    </span>
                  );
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-orange-400 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* chart card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2, ease: "easeOut" }}
          className="mb-8 mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-blue-500" />
            <h2 className="font-semibold text-slate-800">Monthly Debit Overview</h2>
            <span className="text-xs text-slate-400">(follows the active filters)</span>
          </div>

          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No data to plot for the current filters.
            </p>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 100000 ? `${(v / 100000).toFixed(1)}L` : inr(v)
                    }
                  />
                  <Tooltip
                    formatter={(v) => [`₹ ${inr(v)}`, "Debit"]}
                    cursor={{ fill: "rgba(249, 115, 22, 0.08)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
                    }}
                  />
                  <Bar dataKey="debit" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}