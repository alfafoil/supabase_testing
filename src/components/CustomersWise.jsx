import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

/* ---------------- constants / helpers ---------------- */

const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/** "Apr-23" -> sortable number 2304 */
const monthSortKey = (my) => {
  if (!my) return 0;
  const [m, y] = my.split("-");
  return (2000 + parseInt(y, 10)) * 100 + (MONTHS[m] || 0);
};

/** "Aug-26" -> absolute month index (for last-N-months maths) */
const monthIndex = (my) => {
  if (!my) return null;
  const [m, y] = my.split("-");
  if (!MONTHS[m]) return null;
  return (2000 + parseInt(y, 10)) * 12 + (MONTHS[m] - 1);
};

/** "Aug-26" -> "2026-Aug" (column header format, like the sheet) */
const monthLabel = (my) => {
  const [m, y] = my.split("-");
  return `20${y}-${m}`;
};

/** full Indian-format amount, no decimals */
const inr0 = (n) => Math.round(Number(n) || 0).toLocaleString("en-IN");

/* ---------------- component ---------------- */

/**
 * CustomersWise — customer × month pivot of debit amounts
 * (like the "Customer Wise Summary" sheet: one row per customer,
 * one column per month, newest month first, frozen customer column).
 *
 * Props:
 *  - rows    : array from fetchSalesReport() -> { particulars, debit, month_year, ... }
 *  - loading : boolean (optional)
 */
export default function CustomersWise({ rows = [], loading = false }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25); // default 25 per page

  /* month columns present in the data — newest first */
  const monthCols = useMemo(() => {
    const set = new Set(rows.map((r) => r.month_year).filter(Boolean));
    return [...set].sort((a, b) => monthSortKey(b) - monthSortKey(a));
  }, [rows]);

  /* pivot: one row per customer (particulars), one cell per month */
  const customers = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const name = (r.particulars || "Unknown").trim();
      if (!map.has(name)) map.set(name, { name, total: 0, months: {} });
      const c = map.get(name);
      const amt = Number(r.debit) || 0;
      c.total += amt;
      if (r.month_year) c.months[r.month_year] = (c.months[r.month_year] || 0) + amt;
    }

    /* summary columns, relative to today */
    const nowD = new Date();
    const nowIdx = nowD.getFullYear() * 12 + nowD.getMonth();
    for (const c of map.values()) {
      let lastYear = 0, last4 = 0, m5to8 = 0, cnt12 = 0;
      for (const [my, amt] of Object.entries(c.months)) {
        const idx = monthIndex(my);
        if (idx == null) continue;
        const diff = nowIdx - idx; // 0 = current month
        if (diff >= 0 && diff < 12) {
          lastYear += amt;
          cnt12 += 1;
        }
        if (diff >= 0 && diff < 4) last4 += amt;
        if (diff >= 4 && diff < 8) m5to8 += amt;
      }
      c.lastYear = lastYear;
      c.last4 = last4;
      c.m5to8 = m5to8;
      // baseline (the sheet's BC column): the customer's average monthly
      // sale over the last 12 months — guarded like IF(BC=0,1,BC)
      const avg = cnt12 ? lastYear / cnt12 : 0;
      c.baseline = avg === 0 ? 1 : avg;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, query]);

  /* pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, rows.length]);

  const grandTotal = useMemo(
    () => customers.reduce((s, c) => s + c.total, 0),
    [customers]
  );

  const summaryCols = [
    { key: "lastYear", label: "Last 1 Year" },
    { key: "last4", label: "Last 4 Month" },
    { key: "m5to8", label: "5-8 Months" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* header */}
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-orange-500" />
          <h2 className="font-semibold text-slate-800">Customer Wise Summary</h2>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
            {filtered.length}
          </span>
          <span className="hidden text-xs text-slate-400 sm:inline">SUM of Debit · Date - Year-Month</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs text-slate-500">
            Total: <span className="font-semibold text-slate-700">₹ {inr0(grandTotal)}</span>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer…"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-orange-400 sm:w-52"
          />
        </div>
      </div>

      {/* color legend for the latest-3-months formatting */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        <span className="font-medium text-slate-400">Latest 3 months vs monthly average:</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" /> &gt; 80%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-yellow-100 ring-1 ring-yellow-200" /> 50–80%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-200" /> &lt; 50%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-200" /> no sale
        </span>
      </div>

      {/* pivot table — customer column frozen, months scroll horizontally */}
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {/* frozen customer column */}
              <th className="sticky left-0 z-20 min-w-[180px] max-w-[220px] border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 shadow-[2px_0_4px_rgba(15,23,42,0.06)]">
                <span className="mr-2 font-mono text-slate-400">SL</span>Customer Name
              </th>

              {/* month columns — newest first */}
              {monthCols.map((my) => (
                <th
                  key={my}
                  className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-blue-700"
                >
                  {monthLabel(my)}
                </th>
              ))}

              {/* summary columns */}
              {summaryCols.map((s) => (
                <th
                  key={s.key}
                  className="whitespace-nowrap border-r border-amber-100 bg-amber-50 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-amber-700"
                >
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={1 + monthCols.length + summaryCols.length} className="px-5 py-12 text-center text-slate-400">
                  Loading customers…
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={1 + monthCols.length + summaryCols.length} className="px-5 py-12 text-center text-slate-400">
                  No customers found{query ? ` for "${query}"` : ""}.
                </td>
              </tr>
            ) : (
              paginated.map((c, i) => {
                const rank = (currentPage - 1) * pageSize + i + 1;
                return (
                  <tr
                    key={c.name}
                    className="group border-b border-slate-100 transition-colors hover:bg-orange-50/50"
                  >
                    {/* frozen customer cell */}
                    <td
                      className="sticky left-0 z-10 min-w-[180px] max-w-[220px] border-r border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 shadow-[2px_0_4px_rgba(15,23,42,0.06)] group-hover:bg-orange-50"
                      title={c.name}
                    >
                      <span className="mr-2 inline-block w-6 text-right font-mono text-[10px] text-slate-400">
                        {rank}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </td>

                    {/* month cells — the sheet's conditional formatting applies to the
                        FIRST THREE (most recent) month columns only:
                          value/baseline > 0.8  -> green
                          value/baseline < 0.5  -> blue
                          value/baseline < 0.8  -> yellow
                          no sale (empty)       -> red        */}
                    {monthCols.map((my, mIdx) => {
                      const v = c.months[my];
                      let cls = "text-slate-600";
                      if (mIdx < 3) {
                        if (v == null) {
                          cls = "bg-rose-200/80 text-rose-400";
                        } else {
                          const ratio = v / c.baseline;
                          if (ratio > 0.8) cls = "bg-emerald-200/80 font-semibold text-emerald-900";
                          else if (ratio < 0.5) cls = "bg-sky-200/80 font-semibold text-sky-900";
                          else cls = "bg-yellow-100 font-semibold text-yellow-800";
                        }
                      } else if (v == null) {
                        cls = "text-slate-300";
                      }
                      return (
                        <td
                          key={my}
                          className={`whitespace-nowrap border-r border-slate-100 px-3 py-2 text-right font-mono ${cls}`}
                        >
                          {v == null ? "—" : inr0(v)}
                        </td>
                      );
                    })}

                    {/* summary cells */}
                    {summaryCols.map((s) => (
                      <td
                        key={s.key}
                        className="whitespace-nowrap border-r border-amber-100 bg-amber-50/60 px-3 py-2 text-right font-mono font-semibold text-slate-700"
                      >
                        {c[s.key] ? inr0(c[s.key]) : "—"}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* pagination footer */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} customers
            </span>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Rows:
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="cursor-pointer rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-orange-400"
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-orange-400 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 text-xs text-slate-500">
              {currentPage} / {totalPages}
            </span>
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
  );
}