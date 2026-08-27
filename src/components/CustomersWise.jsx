import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

/** current Indian financial year (Apr–Mar) of a date, e.g. "2026-2027" */
const fyOfDate = (d) =>
  d.getMonth() + 1 >= 4
    ? `${d.getFullYear()}-${d.getFullYear() + 1}`
    : `${d.getFullYear() - 1}-${d.getFullYear()}`;

/** full Indian-format amount, no decimals */
const inr0 = (n) => Math.round(Number(n) || 0).toLocaleString("en-IN");

/** the sheet's conditional-format rules -> a color name */
const cellColor = (v, baseline) => {
  if (v == null) return "red";
  const ratio = v / baseline;
  if (ratio > 0.8) return "green";
  if (ratio < 0.5) return "blue";
  return "yellow";
};

const COLOR_CLS = {
  green: "bg-emerald-200/80 font-semibold text-emerald-900",
  yellow: "bg-yellow-100 font-semibold text-yellow-800",
  blue: "bg-blue-400/70 font-semibold text-blue-950", // deeper blue — clearly different from green
  red: "bg-rose-200/80 text-rose-400",
};

const COLOR_FILTERS = [
  { key: "green", label: "Green", dot: "bg-emerald-400" },
  { key: "yellow", label: "Yellow", dot: "bg-yellow-400" },
  { key: "blue", label: "Blue", dot: "bg-blue-600" },
  { key: "red", label: "Red", dot: "bg-rose-400" },
];

/* which month column the Color Wise filter is applied on —
   each option maps to ONE column: current = 1st (newest) column,
   previous = 2nd column, third = 3rd column. Selecting several means
   the color must match in ALL of the selected columns. */
const SCOPE_OPTIONS = ["current", "previous", "third"];
const SCOPE_LABELS = {
  current: "Current Month (1st column)",
  previous: "Previous Month (2nd column)",
  third: "3rd Month (3rd column)",
};
const DEFAULT_SCOPE = ["current"];
const SCOPE_COL = { current: 0, previous: 1, third: 2 };

/* the four trailing-month summary columns — each is the MAXIMUM of any
   single month's total debit within its range (not a sum), relative to
   today, EXCLUDING the current (in-progress) month:
     Last 4 Month : month -1 .. month -5
     5-8 Month    : month -6 .. month -9
     9-12 Month   : month -10 .. month -13
     Last 1 Year  : month -1 .. month -13
   (the underlying "baseline" used for the latest-3-months color coding is
   a separate, unaffected average — see statsByName below) */
const SPECIAL_COL_OPTIONS = ["lastYear", "last4", "m5to8", "m9to12"];
const SPECIAL_COL_LABELS = {
  lastYear: "Last 1 Year",
  last4: "Last 4 Month",
  m5to8: "5-8 Month",
  m9to12: "9-12 Month",
};

const OPERATION_OPTIONS = [
  { key: "more", label: "More Than" },
  { key: "less", label: "Less Than" },
  { key: "between", label: "In Between" },
];

/* Rank On — which summary figure decides the Rank column / row order.
   Defaults to LAST 1 YEAR, matching the existing behavior. */
const RANK_ON_OPTIONS = ["lastYear", "allTimeTotal"];
const RANK_ON_LABELS = {
  lastYear: "LAST 1 YEAR",
  allTimeTotal: "GRAND TOTAL",
};
const DEFAULT_RANK_ON = "lastYear";

const LAKH = 100000;

/* ---------------- reusable multi-select dropdown (checkboxes) ---------------- */

function MultiSelectDropdown({ label, options, selected, onToggle, onClear, searchable = false, formatOption = (o) => o, emptyText }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const shown =
    searchable && search.trim()
      ? options.filter((o) => o.toLowerCase().includes(search.trim().toLowerCase()))
      : options;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
          selected.length
            ? "border-orange-300 bg-orange-50 text-orange-700"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
            {selected.length}
          </span>
        )}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white shadow-xl">
            {searchable && (
              <div className="border-b border-slate-100 p-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-orange-400"
                />
              </div>
            )}
            <div className="max-h-56 overflow-y-auto p-1.5 [scrollbar-width:thin]">
              {shown.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-slate-400">No match.</p>
              ) : (
                shown.map((opt) => (
                  <label
                    key={opt}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-orange-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(opt)}
                      onChange={() => onToggle(opt)}
                      className="h-3.5 w-3.5 shrink-0 accent-orange-500"
                    />
                    <span className="truncate" title={formatOption(opt)}>{formatOption(opt)}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-2.5 py-1.5">
              <span className="text-[10px] text-slate-400">
                {selected.length ? `${selected.length} selected` : emptyText || `All ${label.toLowerCase()}`}
              </span>
              <button
                onClick={onClear}
                className="text-[11px] font-medium text-orange-600 hover:text-orange-700"
              >
                Clear
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- component ---------------- */

/**
 * CustomersWise — customer × month pivot of debit amounts
 * (like the "Customer Wise Summary" sheet: one row per customer,
 * one column per month, newest month first, frozen customer column).
 *
 * Props:
 *  - rows    : array from fetchSalesReport() -> { particulars, debit, month_year, salesman_name, fy, ... }
 *  - loading : boolean (optional)
 */
export default function CustomersWise({ rows = [], loading = false }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [exportType, setExportType] = useState("excel"); // "excel" | "pdf" — default Excel
  const [pageSize, setPageSize] = useState(25); // default 25 per page

  /* filters */
  const [colorFilter, setColorFilter] = useState([]); // [] = all colors
  const [colorScope, setColorScope] = useState(DEFAULT_SCOPE); // which months the color filter checks
  const [salesmanFilter, setSalesmanFilter] = useState([]); // [] = all salesmen
  const [fyFilter, setFyFilter] = useState([]); // [] = all financial years
  const [custSelected, setCustSelected] = useState([]); // [] = all customers
  const [monthSelected, setMonthSelected] = useState([]); // [] = all month columns

  /* Special Filter — number filter on the 4 trailing-month summary columns.
     "Apply On" defaults to Last 1 Year; the filter itself only activates
     once an Operation + value are also chosen. */
  const [specialOp, setSpecialOp] = useState(""); // "" | "more" | "less" | "between"
  const [specialCols, setSpecialCols] = useState(["lastYear"]); // subset of SPECIAL_COL_OPTIONS
  const [specialValue, setSpecialValue] = useState(""); // lakhs, for more/less
  const [specialFrom, setSpecialFrom] = useState(""); // lakhs, for between
  const [specialTo, setSpecialTo] = useState(""); // lakhs, for between

  /* Rank On — decides which figure (Last 1 Year or Grand Total) the Rank
     column / row order is based on. Defaults to Last 1 Year. */
  const [rankOn, setRankOn] = useState(DEFAULT_RANK_ON);

  /* default the FY filter to the current financial year, once, as soon as
     the data actually contains it — mirrors the Sales Report page's default */
  const didInitFy = useRef(false);
  useEffect(() => {
    if (didInitFy.current || !rows.length) return;
    didInitFy.current = true;
    const defFy = fyOfDate(new Date());
    if (rows.some((r) => r.fy === defFy)) setFyFilter([defFy]);
  }, [rows]);

  /* Salesman / FY option lists — always the FULL universe, unaffected by
     any currently-selected filter (so the dropdowns never shrink on you) */
  const salesmanOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.salesman_name).filter(Boolean));
    return [...set].sort();
  }, [rows]);

  const fyOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.fy).filter(Boolean));
    return [...set].sort();
  }, [rows]);

  const toggleSalesman = (name) =>
    setSalesmanFilter((cur) =>
      cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]
    );

  const toggleFy = (fy) =>
    setFyFilter((cur) =>
      cur.includes(fy) ? cur.filter((f) => f !== fy) : [...cur, fy]
    );

  /* rows used for the main grid (month columns + pivot cells): Salesman
     AND FY both narrow this */
  const gridRows = useMemo(() => {
    return rows.filter((r) => {
      if (salesmanFilter.length && !salesmanFilter.includes(r.salesman_name)) return false;
      if (fyFilter.length && !fyFilter.includes(r.fy)) return false;
      return true;
    });
  }, [rows, salesmanFilter, fyFilter]);

  /* rows used for the Last 1 Year / Last 4 Month / 5-8 / 9-12 / Grand Total
     summary columns: Salesman narrows these too, but FY never does — those
     columns always look at the true, unfiltered trailing months */
  const statsRows = useMemo(() => {
    if (!salesmanFilter.length) return rows;
    return rows.filter((r) => salesmanFilter.includes(r.salesman_name));
  }, [rows, salesmanFilter]);

  /* month columns present in the (Salesman + FY filtered) data — newest first */
  const monthCols = useMemo(() => {
    const set = new Set(gridRows.map((r) => r.month_year).filter(Boolean));
    return [...set].sort((a, b) => monthSortKey(b) - monthSortKey(a));
  }, [gridRows]);

  /* pivot: one row per customer (particulars), one cell per month —
     built from gridRows so Salesman/FY narrow the grid itself */
  const customersBase = useMemo(() => {
    const map = new Map();
    for (const r of gridRows) {
      const name = (r.particulars || "Unknown").trim();
      if (!map.has(name)) map.set(name, { name, total: 0, months: {} });
      const c = map.get(name);
      const amt = Number(r.debit) || 0;
      c.total += amt;
      if (r.month_year) c.months[r.month_year] = (c.months[r.month_year] || 0) + amt;
    }
    return map;
  }, [gridRows]);

  /* summary stats (GRAND TOTAL / Last 1 Year / Last 4 Month / 5-8 / 9-12 +
     baseline), always relative to today, from statsRows — deliberately
     independent of the FY filter (and of which months happen to be on
     screen) */
  const statsByName = useMemo(() => {
    // step 1: per-customer, per-month totals (a customer can have several
    // rows landing in the same month) — the four trailing-month summary
    // columns then take the MAX across the months inside their range, not
    // a sum; GRAND TOTAL is the sum across every month, all-time
    const monthSums = new Map(); // name -> Map(month_year -> sum)
    for (const r of statsRows) {
      const name = (r.particulars || "Unknown").trim();
      if (!r.month_year) continue;
      if (!monthSums.has(name)) monthSums.set(name, new Map());
      const m = monthSums.get(name);
      m.set(r.month_year, (m.get(r.month_year) || 0) + (Number(r.debit) || 0));
    }

    const nowD = new Date();
    const nowIdx = nowD.getFullYear() * 12 + nowD.getMonth();

    const map = new Map();
    for (const [name, monthMap] of monthSums.entries()) {
      let last4 = 0, m5to8 = 0, m9to12 = 0, lastYear = 0, allTimeTotal = 0;
      let baselineSum = 0, baselineCnt = 0; // separate, unaffected average — see below

      for (const [my, sum] of monthMap.entries()) {
        allTimeTotal += sum;

        const idx = monthIndex(my);
        if (idx == null) continue;
        const diff = nowIdx - idx; // 1 = last month, 2 = two months ago, …

        // the four displayed columns — maximum single month within range
        if (diff >= 1 && diff <= 13) lastYear = Math.max(lastYear, sum);
        if (diff >= 1 && diff <= 5) last4 = Math.max(last4, sum);
        if (diff >= 6 && diff <= 9) m5to8 = Math.max(m5to8, sum);
        if (diff >= 10 && diff <= 13) m9to12 = Math.max(m9to12, sum);

        // baseline for the latest-3-months color coding stays an AVERAGE
        // over the trailing 12 months — untouched by the max-column change
        if (diff >= 1 && diff <= 12) {
          baselineSum += sum;
          baselineCnt += 1;
        }
      }

      const avg = baselineCnt ? baselineSum / baselineCnt : 0;
      map.set(name, {
        last4, m5to8, m9to12, lastYear, allTimeTotal,
        baseline: avg === 0 ? 1 : avg,
      });
    }
    return map;
  }, [statsRows]);

  /* merge grid pivot + stats into the final per-customer rows, then RANK
     them by the figure chosen in "Rank On" (defaults to LAST 1 YEAR, can
     be switched to GRAND TOTAL) — rank 1 = highest, rank 2 = next
     highest, and so on — and sort the rows in that same ascending-rank
     order */
  const customers = useMemo(() => {
    const list = [...customersBase.values()].map((c) => {
      const s = statsByName.get(c.name) || {
        last4: 0, m5to8: 0, m9to12: 0, lastYear: 0, allTimeTotal: 0, baseline: 1,
      };
      return {
        ...c,
        last4: s.last4,
        m5to8: s.m5to8,
        m9to12: s.m9to12,
        lastYear: s.lastYear,
        allTimeTotal: s.allTimeTotal,
        baseline: s.baseline,
      };
    });
    list.sort((a, b) => (b[rankOn] || 0) - (a[rankOn] || 0));
    list.forEach((c, i) => {
      c.rank = i + 1;
    });
    return list;
  }, [customersBase, statsByName, rankOn]);

  /* the month columns the Color Wise filter checks, from the scope dropdown
     (current -> 1st column, previous -> 2nd, third -> 3rd);
     if the user unchecks everything, fall back to the current month */
  const scopedMonths = useMemo(() => {
    const set = new Set();
    for (const key of colorScope) {
      const my = monthCols[SCOPE_COL[key]];
      if (my) set.add(my);
    }
    if (set.size === 0 && monthCols[0]) set.add(monthCols[0]);
    return [...set];
  }, [colorScope, monthCols]);

  /* is the Special Filter actually configured enough to apply? */
  const specialActive =
    specialOp &&
    specialCols.length > 0 &&
    (specialOp === "between"
      ? specialFrom.trim() !== "" || specialTo.trim() !== ""
      : specialValue.trim() !== "");

  const passesSpecial = (c) => {
    if (!specialActive) return true;
    return specialCols.every((key) => {
      const v = Number(c[key]) || 0;
      if (specialOp === "more") return v > Number(specialValue) * LAKH;
      if (specialOp === "less") return v < Number(specialValue) * LAKH;
      if (specialOp === "between") {
        const from = specialFrom.trim() !== "" ? Number(specialFrom) * LAKH : -Infinity;
        const to = specialTo.trim() !== "" ? Number(specialTo) * LAKH : Infinity;
        return v >= from && v <= to;
      }
      return true;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (colorFilter.length) {
        // customer passes only if EVERY selected column has one of the
        // selected colors (e.g. Current + Previous with Red = red in both)
        const match = scopedMonths.every((my) =>
          colorFilter.includes(cellColor(c.months[my], c.baseline))
        );
        if (!match) return false;
      }
      if (custSelected.length && !custSelected.includes(c.name)) return false;
      // Special Filter can be combined with Color Wise — both apply together
      if (!passesSpecial(c)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, query, colorFilter, custSelected, scopedMonths, specialActive, specialOp, specialCols, specialValue, specialFrom, specialTo]);

  const toggleColor = (key) =>
    setColorFilter((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    );

  const toggleScope = (key) =>
    setColorScope((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    );

  const toggleCustomer = (name) =>
    setCustSelected((cur) =>
      cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]
    );

  const toggleMonth = (my) =>
    setMonthSelected((cur) =>
      cur.includes(my) ? cur.filter((m) => m !== my) : [...cur, my]
    );

  const toggleSpecialCol = (key) =>
    setSpecialCols((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    );

  const custOptions = useMemo(() => customers.map((c) => c.name), [customers]);

  const scopeIsDefault =
    colorScope.length === 1 && colorScope[0] === DEFAULT_SCOPE[0];

  /* month columns actually shown (Month filter); coloring stays tied to the
     true latest 3 months of the data, whatever columns are visible */
  const visibleMonths = useMemo(
    () => (monthSelected.length ? monthCols.filter((m) => monthSelected.includes(m)) : monthCols),
    [monthCols, monthSelected]
  );
  const recentMonths = useMemo(() => new Set(monthCols.slice(0, 3)), [monthCols]);

  /* pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [
    query, pageSize, rows.length, colorFilter, colorScope,
    salesmanFilter, fyFilter, custSelected, monthSelected,
    specialOp, specialCols, specialValue, specialFrom, specialTo,
    rankOn,
  ]);

  const grandTotal = useMemo(
    () => customers.reduce((s, c) => s + c.total, 0),
    [customers]
  );

  const summaryCols = [
    { key: "allTimeTotal", label: "GRAND TOTAL" },
    { key: "lastYear", label: "Last 1 Year" },
    { key: "last4", label: "Last 4 Month" },
    { key: "m5to8", label: "5-8 Month" },
    { key: "m9to12", label: "9-12 Month" },
  ];

  /* export the currently filtered table (the FULL filtered set, every
     page — not just the page on screen): Rank + Customer Name + every
     visible month column + the 5 summary columns, in the same
     left-to-right order as the table itself. Downloads as .xlsx or .pdf
     depending on the "type" dropdown next to the Export button. */
  const handleExport = () => {
    if (!filtered.length) return;

    const data = filtered.map((c) => {
      const row = { Rank: c.rank, "Customer Name": c.name };
      visibleMonths.forEach((my) => {
        row[monthLabel(my)] = c.months[my] ?? "";
      });
      summaryCols.forEach((s) => {
        row[s.label] = c[s.key] ?? "";
      });
      return row;
    });
    const stamp = new Date().toISOString().slice(0, 10);

    if (exportType === "pdf") {
      const headers = Object.keys(data[0]);
      const body = data.map((row) =>
        headers.map((h) => (typeof row[h] === "number" ? inr0(row[h]) : row[h] || "—"))
      );
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(12);
      doc.text("Customer Wise Summary", 14, 10);
      autoTable(doc, {
        head: [headers],
        body,
        startY: 14,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [251, 191, 36], textColor: [120, 53, 15] }, // amber
      });
      doc.save(`Customer_Wise_Summary_${stamp}.pdf`);
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customer Wise");
      XLSX.writeFile(wb, `Customer_Wise_Summary_${stamp}.xlsx`);
    }
  };

  const anyFilterActive =
    colorFilter.length > 0 ||
    custSelected.length > 0 ||
    monthSelected.length > 0 ||
    salesmanFilter.length > 0 ||
    fyFilter.length > 0 ||
    specialActive ||
    !scopeIsDefault ||
    rankOn !== DEFAULT_RANK_ON;

  const clearAllFilters = () => {
    setColorFilter([]);
    setColorScope(DEFAULT_SCOPE);
    setSalesmanFilter([]);
    setFyFilter([]);
    setCustSelected([]);
    setMonthSelected([]);
    setSpecialOp("");
    setSpecialCols([]);
    setSpecialValue("");
    setSpecialFrom("");
    setSpecialTo("");
    setRankOn(DEFAULT_RANK_ON);
  };

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
          <button
            onClick={handleExport}
            disabled={!filtered.length}
            title={`Download the filtered table as ${exportType === "pdf" ? "a PDF" : "an Excel"} file`}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export
          </button>

          {/* export file-type picker — defaults to Excel */}
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
            title="Export file format"
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-orange-400"
          >
            <option value="excel">Excel</option>
            <option value="pdf">PDF</option>
          </select>

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
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-400" /> &lt; 50%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-200" /> no sale
        </span>
      </div>

      {/* filter row: color-wise + its month scope + salesman/FY/customer/month */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <span className="text-xs font-medium text-slate-500">Color Wise:</span>
        {COLOR_FILTERS.map((cf) => {
          const active = colorFilter.includes(cf.key);
          return (
            <button
              key={cf.key}
              onClick={() => toggleColor(cf.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? "border-slate-700 bg-slate-800 text-white shadow"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${cf.dot}`} />
              {cf.label}
            </button>
          );
        })}

        {/* month scope for the color filter — which column(s) the colors are
            checked against (default: current month); with several selected,
            ALL of them must have the chosen color */}
        <MultiSelectDropdown
          label="Apply On"
          options={SCOPE_OPTIONS}
          selected={colorScope}
          onToggle={toggleScope}
          onClear={() => setColorScope(DEFAULT_SCOPE)}
          formatOption={(k) => SCOPE_LABELS[k]}
          emptyText="Current month"
        />

        {/* salesman multi-select dropdown */}
        <MultiSelectDropdown
          label="Salesman"
          options={salesmanOptions}
          selected={salesmanFilter}
          onToggle={toggleSalesman}
          onClear={() => setSalesmanFilter([])}
          searchable
        />

        {/* FY multi-select dropdown */}
        <MultiSelectDropdown
          label="FY"
          options={fyOptions}
          selected={fyFilter}
          onToggle={toggleFy}
          onClear={() => setFyFilter([])}
        />

        {/* customer multi-select dropdown */}
        <MultiSelectDropdown
          label="Customers"
          options={custOptions}
          selected={custSelected}
          onToggle={toggleCustomer}
          onClear={() => setCustSelected([])}
          searchable
        />

        {/* month multi-select dropdown (chooses which month columns are shown) */}
        <MultiSelectDropdown
          label="Month"
          options={monthCols}
          selected={monthSelected}
          onToggle={toggleMonth}
          onClear={() => setMonthSelected([])}
          formatOption={monthLabel}
        />

        {anyFilterActive && (
          <button
            onClick={clearAllFilters}
            className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-100"
          >
            Clear filters ✕
          </button>
        )}
      </div>

      {/* Special Filter row — numeric filter (in lakhs) on the 4 trailing-month
          summary columns; combines together with Color Wise, doesn't replace it */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <span className="text-xs font-medium text-slate-500">Special Filter:</span>

        <select
          value={specialOp}
          onChange={(e) => setSpecialOp(e.target.value)}
          className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 outline-none focus:border-orange-400"
        >
          <option value="">Operation…</option>
          {OPERATION_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        {specialOp === "between" ? (
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              value={specialFrom}
              onChange={(e) => setSpecialFrom(e.target.value)}
              placeholder="From"
              className="w-20 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-orange-400"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="number"
              value={specialTo}
              onChange={(e) => setSpecialTo(e.target.value)}
              placeholder="To"
              className="w-20 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-orange-400"
            />
            <span className="text-[11px] text-slate-400">Lakh</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              value={specialValue}
              onChange={(e) => setSpecialValue(e.target.value)}
              placeholder="Value"
              disabled={!specialOp}
              className="w-24 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-orange-400 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <span className="text-[11px] text-slate-400">Lakh</span>
          </span>
        )}

        {/* which of the 4 summary columns this operation checks — multiple
            selectable; ALL selected columns must satisfy the condition */}
        <MultiSelectDropdown
          label="Apply On"
          options={SPECIAL_COL_OPTIONS}
          selected={specialCols}
          onToggle={toggleSpecialCol}
          onClear={() => setSpecialCols([])}
          formatOption={(k) => SPECIAL_COL_LABELS[k]}
          emptyText="Choose columns"
        />

        {/* Rank On — chooses whether the Rank column / row order is based
            on Last 1 Year (default) or Grand Total */}
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400">Rank On</span>
          <select
            value={rankOn}
            onChange={(e) => setRankOn(e.target.value)}
            title="Rank customers by this figure"
            className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 outline-none focus:border-orange-400"
          >
            {RANK_ON_OPTIONS.map((key) => (
              <option key={key} value={key}>
                {RANK_ON_LABELS[key]}
              </option>
            ))}
          </select>
        </span>

        {(specialOp || specialCols.length > 0 || specialValue || specialFrom || specialTo || rankOn !== DEFAULT_RANK_ON) && (
          <button
            onClick={() => {
              setSpecialOp("");
              setSpecialCols([]);
              setSpecialValue("");
              setSpecialFrom("");
              setSpecialTo("");
              setRankOn(DEFAULT_RANK_ON);
            }}
            className="text-[11px] font-medium text-orange-600 hover:text-orange-700"
          >
            Clear
          </button>
        )}
      </div>

      {/* pivot table — customer column frozen, months scroll horizontally */}
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {/* frozen customer column */}
              <th className="sticky left-0 z-20 w-[200px] min-w-[200px] max-w-[200px] border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 shadow-[2px_0_4px_rgba(15,23,42,0.06)]">
                <span className="mr-2 font-mono text-slate-400">Rank</span>Customer Name
              </th>

              {/* month columns — newest first */}
              {visibleMonths.map((my) => (
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
                <td colSpan={1 + visibleMonths.length + summaryCols.length} className="px-5 py-12 text-center text-slate-400">
                  Loading customers…
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={1 + visibleMonths.length + summaryCols.length} className="px-5 py-12 text-center text-slate-400">
                  No customers found{query ? ` for "${query}"` : ""}.
                </td>
              </tr>
            ) : (
              paginated.map((c) => {
                return (
                  <tr
                    key={c.name}
                    className="group border-b border-slate-100 transition-colors hover:bg-orange-50/50"
                  >
                    {/* frozen customer cell — rank is fixed to the customer
                        (by whichever figure "Rank On" selects), not to its
                        position on the page */}
                    <td
                      className="sticky left-0 z-10 w-[200px] min-w-[200px] max-w-[200px] border-r border-slate-200 bg-white px-3 py-2 shadow-[2px_0_4px_rgba(15,23,42,0.06)] group-hover:bg-orange-50"
                      title={c.name}
                    >
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="w-7 shrink-0 text-center font-mono text-[10px] text-slate-400">
                          {c.rank}
                        </span>
                        <span className="truncate font-medium text-slate-700">{c.name}</span>
                      </div>
                    </td>

                    {/* month cells — the sheet's conditional formatting applies to the
                        FIRST THREE (most recent) month columns only:
                          value/baseline > 0.8  -> green
                          value/baseline < 0.5  -> blue
                          value/baseline < 0.8  -> yellow
                          no sale (empty)       -> red        */}
                    {visibleMonths.map((my) => {
                      const v = c.months[my];
                      let cls = "text-slate-600";
                      if (recentMonths.has(my)) {
                        cls = COLOR_CLS[cellColor(v, c.baseline)];
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