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
  LabelList,
} from "recharts";
import { fetchSalesReport } from "../supabase/sales_report";
import CustomersWise from "../components/CustomersWise";
import SalesmanWise from "../components/SalesmanWise";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ---------------- constants ---------------- */

const PAGE_SIZE = 20;

const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};
const MONTH_NAMES = Object.keys(MONTHS);

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

/** Monday 00:00 of the week containing d */
const startOfWeek = (d) => {
  const s = startOfDay(d);
  const shift = (s.getDay() + 6) % 7; // Mon=0 … Sun=6
  s.setDate(s.getDate() - shift);
  return s;
};

const inr = (n) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** amount -> "3.42 L" (lakhs) */
const lakh = (n) =>
  n == null
    ? "—"
    : `${(Number(n) / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} L`;

/** "Apr-23" -> sortable number 2304 */
const monthSortKey = (my) => {
  if (!my) return 0;
  const [m, y] = my.split("-");
  return (2000 + parseInt(y, 10)) * 100 + (MONTHS[m] || 0);
};

/** current month in the data's "Aug-26" format */
const currentMonthYear = (d) =>
  `${MONTH_NAMES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;

/** Indian FY (Apr–Mar) of any date, in the data's "2026-2027" format */
const fyOfDate = (d) =>
  d.getMonth() + 1 >= 4
    ? `${d.getFullYear()}-${d.getFullYear() + 1}`
    : `${d.getFullYear() - 1}-${d.getFullYear()}`;

const currentFy = fyOfDate;

/* ---------------- KPI config ---------------- */

const KPI_DEFS = [
  {
    key: "yesterday",
    label: "Yesterday",
    accent: { bar: "bg-sky-500", text: "text-sky-600", ring: "ring-sky-500" },
    match: (d, now) => {
      if (!d) return false;
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return sameDay(d, y);
    },
  },
  {
    key: "thisWeek",
    label: "This Week",
    accent: { bar: "bg-emerald-500", text: "text-emerald-600", ring: "ring-emerald-500" },
    // Monday → Sunday of the current week
    match: (d, now) => {
      if (!d) return false;
      const from = startOfWeek(now);
      const to = new Date(from);
      to.setDate(to.getDate() + 7); // exclusive upper bound (next Monday)
      return d >= from && d < to;
    },
  },
  {
    key: "thisMonth",
    label: "This Month Sales",
    salesmanWise: true, // this KPI's value follows the Salesman Wise filter only
    accent: {
      bar: "bg-amber-500",
      text: "text-amber-700",
      ring: "ring-amber-500",
      bg: "bg-amber-50", // cream background so it stands out
      border: "border-amber-200",
    },
    match: (d, now) =>
      d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(),
  },
  {
    key: "thisFy",
    label: "This FY",
    accent: { bar: "bg-blue-600", text: "text-blue-700", ring: "ring-blue-600" },
    // current Indian financial year (Apr → Mar)
    match: (d, now) => d && fyOfDate(d) === fyOfDate(now),
  },
];

/* ---------------- small components ---------------- */

function KpiCard({ def, count, amount, active, onClick }) {
  const a = def.accent;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative overflow-hidden rounded-lg border ${a.bg || "bg-white"} p-2.5 text-left shadow-sm transition-all ${
        active
          ? `border-transparent ring-2 ${a.ring} shadow-md`
          : `${a.border || "border-slate-200"} hover:border-slate-300 hover:shadow`
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {def.label}
        </span>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.bar}`} />
      </div>
      <div className={`mt-1 text-lg font-bold leading-tight ${a.text}`}>{count}</div>
      <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
        ₹ {amount == null ? "—" : lakh(amount)}
      </div>
      <span className={`absolute inset-x-0 bottom-0 h-0.5 ${active ? a.bar : "bg-transparent"}`} />
    </motion.button>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
      <span className="whitespace-nowrap text-[11px] font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[110px] cursor-pointer bg-transparent text-xs font-medium text-slate-700 outline-none sm:max-w-[150px] sm:text-sm"
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

/** multi-select dropdown with checkboxes + search (used for Customer Wise) */
function MultiSelectFilter({ label, options, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const shown = search.trim()
    ? options.filter((o) => o.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 shadow-sm transition-all ${
          selected.length
            ? "border-orange-300 bg-orange-50"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <span className="whitespace-nowrap text-[11px] font-medium text-slate-500">{label}</span>
        <span
          className={`text-xs font-medium sm:text-sm ${
            selected.length ? "text-orange-700" : "text-slate-700"
          }`}
        >
          {selected.length === 0
            ? "All"
            : selected.length === 1
            ? selected[0].slice(0, 16)
            : `${selected.length} selected`}
        </span>
        <svg
          className={`h-3 w-3 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
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
            <div className="border-b border-slate-100 p-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-orange-400"
              />
            </div>
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
                    <span className="truncate" title={opt}>{opt}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-2.5 py-1.5">
              <span className="text-[10px] text-slate-400">
                {selected.length ? `${selected.length} selected` : `All ${label.toLowerCase()}`}
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

function SkeletonRows({ columns, rows = 8 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r} className="border-b border-slate-100">
      {columns.map((col, c) => (
        <td key={col.key} className={`px-2 py-3.5 lg:px-3 ${col.hide || ""}`}>
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

  const [view, setView] = useState("report"); // "report" | "customers" | "salesman"
  const [sidebarOpen, setSidebarOpen] = useState(false); // collapsed by default

  const [kpiFilter, setKpiFilter] = useState(""); // "" = no KPI filter (all records)
  const [salesman, setSalesman] = useState("");
  const [fy, setFy] = useState("");
  const [month, setMonth] = useState("");
  const [customers, setCustomers] = useState([]); // Customer Wise multi-select ([] = all)
  const [page, setPage] = useState(1);
  const [exportType, setExportType] = useState("excel"); // "excel" | "pdf" — default Excel

  /* fetch once + apply default filters (current FY / current month) */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await fetchSalesReport();
      if (error) setErrorMsg(error.message || "Failed to fetch sales report.");
      const list = (data || []).map((r) => ({ ...r, _d: parseDate(r.date) }));
      setRows(list);

      // default filters — only applied when the data actually contains them
      const nowD = new Date();
      const defFy = currentFy(nowD);
      const defMonth = currentMonthYear(nowD);
      if (list.some((r) => r.fy === defFy)) setFy(defFy);
      if (list.some((r) => r.month_year === defMonth)) setMonth(defMonth);

      setLoading(false);
    })();
  }, []);

  const now = useMemo(() => new Date(), []);

  /* KPI stats reflect the full dataset — except "This Month Sales",
     which follows the Salesman Wise filter only */
  const kpiStats = useMemo(() => {
    const stats = {};
    for (const def of KPI_DEFS) {
      const base =
        def.salesmanWise && salesman
          ? rows.filter((r) => r.salesman_name === salesman)
          : rows;
      const list = base.filter((r) => def.match(r._d, now));
      stats[def.key] = {
        count: list.length,
        amount: list.reduce((s, r) => s + (Number(r.debit) || 0), 0),
      };
    }
    return stats;
  }, [rows, now, salesman]);

  /* dropdown options from the full dataset */
  const options = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))];
    return {
      salesmen: uniq(rows.map((r) => r.salesman_name)).sort(),
      fys: uniq(rows.map((r) => r.fy)).sort(),
      months: uniq(rows.map((r) => r.month_year)).sort(
        (a, b) => monthSortKey(a) - monthSortKey(b)
      ),
      customers: uniq(rows.map((r) => r.particulars && r.particulars.trim())).sort(),
    };
  }, [rows]);

  const toggleCustomer = (name) =>
    setCustomers((cur) =>
      cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]
    );

  /* combined filtering: KPI range + dropdowns, then Vch No descending */
  const filtered = useMemo(() => {
    const def = KPI_DEFS.find((k) => k.key === kpiFilter) || null; // null = no KPI filter
    const list = rows.filter((r) => {
      if (def && !def.match(r._d, now)) return false;
      if (salesman && r.salesman_name !== salesman) return false;
      if (fy && r.fy !== fy) return false;
      if (month && r.month_year !== month) return false;
      if (customers.length && !customers.includes((r.particulars || "").trim()))
        return false;
      return true;
    });
    // Date — descending; rows with unparseable/missing dates sink to the bottom
    return list.sort((a, b) => {
      const bt = b._d ? b._d.getTime() : -Infinity;
      const at = a._d ? a._d.getTime() : -Infinity;
      return bt - at;
    });
  }, [rows, kpiFilter, salesman, fy, month, customers, now]);

  /* reset pagination whenever the result set changes */
  useEffect(() => {
    setPage(1);
  }, [kpiFilter, salesman, fy, month, customers, rows.length]);

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

  /* chart: ALWAYS the current FY's months (Apr → Mar), independent of the filters.
     Falls back to the latest FY present in the data if the current FY has no rows. */
  const chartFy = useMemo(() => {
    const cur = currentFy(now);
    if (rows.some((r) => r.fy === cur)) return cur;
    const fys = [...new Set(rows.map((r) => r.fy).filter(Boolean))].sort();
    return fys[fys.length - 1] || cur;
  }, [rows, now]);

  const chartData = useMemo(() => {
    // only the months that actually have data in this FY
    const map = new Map();
    for (const r of rows) {
      if (r.fy !== chartFy || !r.month_year) continue;
      map.set(r.month_year, (map.get(r.month_year) || 0) + (Number(r.debit) || 0));
    }
    return [...map.entries()]
      .map(([m, debit]) => ({ month: m, debit: Math.round(debit) }))
      .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month));
  }, [rows, chartFy]);

  const clearFilters = () => {
    setKpiFilter("");
    setSalesman("");
    setFy("");
    setMonth("");
    setCustomers([]);
  };

  const activeFilterCount =
    [salesman, fy, month].filter(Boolean).length +
    (customers.length ? 1 : 0) +
    (kpiFilter ? 1 : 0);

  /* table shows: Date, Vch No, Customers, Debit, Salesman */
  const columns = [
    { key: "date", label: "Date" },
    { key: "vch_no", label: "Vch No" },
    { key: "particulars", label: "Customers" },
    { key: "debit", label: "Debit" },
    { key: "salesman_name", label: "Salesman" },
  ];

  /* export the currently filtered records (the FULL filtered set, every
     page — not just the page on screen), plus a trailing Grand Total row
     matching the one shown in the table. Downloads as .xlsx or .pdf
     depending on the "type" dropdown next to the Export button. */
  const handleExport = () => {
    if (!filtered.length) return;

    const data = filtered.map((r) => ({
      Date: r.date || "",
      "Vch No": r.vch_no || "",
      Customers: r.particulars || "",
      Debit: Number(r.debit) || 0,
      Salesman: r.salesman_name || "",
    }));
    data.push({
      Date: "",
      "Vch No": "",
      Customers: "Grand Total",
      Debit: totalDebit,
      Salesman: "",
    });
    const stamp = new Date().toISOString().slice(0, 10);

    if (exportType === "pdf") {
      const headers = ["Date", "Vch No", "Customers", "Debit", "Salesman"];
      const body = data.map((row) =>
        headers.map((h) => (h === "Debit" ? `Rs. ${inr(row[h])}` : row[h] || "—"))
      );
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(12);
      doc.text("Sales Report Records", 14, 10);
      autoTable(doc, {
        head: [headers],
        body,
        startY: 14,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [251, 191, 36], textColor: [120, 53, 15] }, // amber
        didParseCell: (hookData) => {
          // bold + amber-tint the trailing Grand Total row
          if (hookData.section === "body" && hookData.row.index === body.length - 1) {
            hookData.cell.styles.fontStyle = "bold";
            hookData.cell.styles.fillColor = [254, 243, 199];
            hookData.cell.styles.textColor = [120, 53, 15];
          }
        },
      });
      doc.save(`Sales_Report_${stamp}.pdf`);
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
      XLSX.writeFile(wb, `Sales_Report_${stamp}.xlsx`);
    }
  };

  const menuItemClass = (active) =>
    `flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
      active
        ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-600/30"
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
    }`;

  const mobileItemClass = (active) =>
    `flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
      active
        ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow shadow-orange-600/30"
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
    }`;

  const pageTitle =
    view === "customers"
      ? "Customer Wise"
      : view === "salesman"
      ? "Salesman Wise"
      : "Sales Report";

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ---------- mobile top menubar (small screens only) ---------- */}
      <nav className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-slate-900 px-3 py-2 text-white shadow-lg sm:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow shadow-orange-500/30">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight">ALFA SALE SYSTEM</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => setView("report")} className={mobileItemClass(view === "report")}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Sales
          </button>
          <button onClick={() => setView("customers")} className={mobileItemClass(view === "customers")}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-6.9 4 4 0 004 6.9zM17 11a3 3 0 100-6" />
            </svg>
            Customers
          </button>
          <button onClick={() => setView("salesman")} className={mobileItemClass(view === "salesman")}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Salesman
          </button>
          <Link
            to="/"
            title="Back to Home"
            className="flex items-center rounded-lg px-2 py-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-orange-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7 7-7m-7 7h18" />
            </svg>
          </Link>
        </div>
      </nav>

      {/* ---------- fixed collapsible sidebar (sm and up, collapsed by default) ---------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-slate-900 text-white shadow-2xl transition-all duration-300 sm:flex ${
          sidebarOpen ? "w-60" : "w-16"
        }`}
      >
        {/* brand */}
        <div
          className={`flex items-center border-b border-slate-800 py-4 ${
            sidebarOpen ? "gap-3 px-4" : "justify-center px-2"
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/30">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
            </svg>
          </span>
          {sidebarOpen && (
            <span className="truncate text-lg font-semibold tracking-tight">ALFA SALE SYSTEM</span>
          )}
        </div>

        {/* collapse / expand toggle */}
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          title={sidebarOpen ? "Collapse menu" : "Expand menu"}
          className={`mx-2 mt-3 flex items-center rounded-lg border border-slate-700/70 py-2 text-slate-400 transition-colors hover:border-orange-500/50 hover:text-orange-400 ${
            sidebarOpen ? "justify-between px-3" : "justify-center px-0"
          }`}
        >
          {sidebarOpen && <span className="text-xs font-medium">Collapse</span>}
          <motion.svg
            animate={{ rotate: sidebarOpen ? 180 : 0 }}
            className="h-4 w-4"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
          </motion.svg>
        </button>

        {/* menu */}
        <div className={`space-y-1.5 pt-5 ${sidebarOpen ? "px-4" : "px-2"}`}>
          {sidebarOpen && (
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Reports
            </p>
          )}

          <button
            onClick={() => setView("report")}
            title="Sales Report"
            className={`${menuItemClass(view === "report")} ${sidebarOpen ? "" : "justify-center px-0"}`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            {sidebarOpen && "Sales Report"}
          </button>

          <button
            onClick={() => setView("customers")}
            title="Customer Wise"
            className={`${menuItemClass(view === "customers")} ${sidebarOpen ? "" : "justify-center px-0"}`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-6.9 4 4 0 004 6.9zM17 11a3 3 0 100-6" />
            </svg>
            {sidebarOpen && "Customer Wise"}
          </button>

          <button
            onClick={() => setView("salesman")}
            title="Salesman Wise"
            className={`${menuItemClass(view === "salesman")} ${sidebarOpen ? "" : "justify-center px-0"}`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {sidebarOpen && "Salesman Wise"}
          </button>
        </div>

        {/* back to home */}
        <div className={`mt-auto border-t border-slate-800 py-4 ${sidebarOpen ? "px-5" : "px-0"}`}>
          <Link
            to="/"
            title="Back to Home"
            className={`flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-orange-400 ${
              sidebarOpen ? "" : "justify-center"
            }`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7 7-7m-7 7h18" />
            </svg>
            {sidebarOpen && "Back to Home"}
          </Link>
        </div>
      </aside>

      {/* ---------- scrollable main ---------- */}
      <main
        className={`ml-0 px-3 py-4 transition-all duration-300 sm:px-5 lg:px-8 ${
          sidebarOpen ? "sm:ml-60" : "sm:ml-16"
        }`}
      >
        {/* slim header banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900 px-3 py-2 text-white shadow-lg sm:px-4"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-3" />
              </svg>
            </span>
            <h1 className="text-sm font-semibold">{pageTitle}</h1>
            <span className="text-[11px] text-slate-400">
              {loading ? "Loading…" : `${rows.length} records loaded`}
            </span>
          </div>
          <div className="flex gap-1.5">
            {[
              { label: "Total", value: rows.length },
              { label: "Filtered", value: filtered.length },
              { label: "Filters", value: activeFilterCount },
            ].map((b) => (
              <div
                key={b.label}
                className="flex items-baseline gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1"
              >
                <span className="text-sm font-bold leading-none">{b.value}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">{b.label}</span>
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

        {view === "customers" ? (
          /* ---------- Customer Wise view ---------- */
          <div className="mt-4">
            <CustomersWise rows={rows} loading={loading} />
          </div>
        ) : view === "salesman" ? (
          /* ---------- Salesman Wise view ---------- */
          <div className="mt-4">
            <SalesmanWise rows={rows} loading={loading} />
          </div>
        ) : (
          /* ---------- Sales Report view ---------- */
          <>
            {/* KPI cards — click to filter (values in lakhs) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
              className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {KPI_DEFS.map((def) => (
                <KpiCard
                  key={def.key}
                  def={def}
                  count={loading ? "…" : kpiStats[def.key]?.count ?? 0}
                  amount={loading ? null : kpiStats[def.key]?.amount ?? 0}
                  active={kpiFilter === def.key}
                  onClick={() =>
                    setKpiFilter((cur) => (cur === def.key ? "" : def.key))
                  }
                />
              ))}
            </motion.div>

            {/* filter row */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              className="relative z-20 mt-4 flex flex-wrap items-center gap-2"
            >
              <FilterSelect label="Salesman Wise" value={salesman} onChange={setSalesman} options={options.salesmen} />
              <FilterSelect label="FY Wise" value={fy} onChange={setFy} options={options.fys} />
              <FilterSelect label="Month Wise" value={month} onChange={setMonth} options={options.months} />
              <MultiSelectFilter
                label="Customer Wise"
                options={options.customers}
                selected={customers}
                onToggle={toggleCustomer}
                onClear={() => setCustomers([])}
              />
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="shrink-0 whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-100"
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
              className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-orange-500" />
                  <h2 className="font-semibold text-slate-800">Sales Report Records</h2>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                    {filtered.length}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">
                    Total Debit:{" "}
                    <span className="font-semibold text-slate-700">₹ {inr(totalDebit)}</span>
                  </span>
                  <button
                    onClick={handleExport}
                    disabled={!filtered.length}
                    title={`Download the filtered records as ${exportType === "pdf" ? "a PDF" : "an Excel"} file`}
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
                </div>
              </div>

              {/* mobile: rows as cards */}
              <div className="md:hidden">
                {loading ? (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
                    ))}
                  </div>
                ) : paginated.length === 0 ? (
                  <p className="px-5 py-14 text-center text-slate-400">
                    No records match the current filters.
                  </p>
                ) : (
                  <div className="space-y-3 p-3">
                    {paginated.map((r, i) => (
                      <motion.div
                        key={r.id ?? `${currentPage}-m-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02, duration: 0.25, ease: "easeOut" }}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-700">{r.date || "—"}</span>
                          <span className="text-sm font-semibold text-emerald-600">
                            {r.debit ? `₹ ${inr(r.debit)}` : "—"}
                          </span>
                        </div>
                        <p className="mt-1.5 truncate text-sm text-slate-600" title={r.particulars}>
                          {r.particulars || "—"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                            {r.salesman_name || "—"}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">#{r.vch_no || "—"}</span>
                        </div>
                      </motion.div>
                    ))}

                    {/* grand total card — sums the full filtered set (all pages) */}
                    {filtered.length > 0 && (
                      <div className="rounded-xl border-2 border-amber-200 bg-amber-50/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-amber-700">Grand Total</span>
                          <span className="text-sm font-bold text-amber-700">₹ {inr(totalDebit)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* tablet / desktop: table — fits its container, no scroll */}
              <div className="hidden md:block">
                <table className="w-full border-collapse text-left text-xs lg:text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          className="px-2 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 lg:px-3"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <SkeletonRows columns={columns} />
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
                          <td className="px-2 py-3 font-medium text-slate-700 lg:px-3">{r.date || "—"}</td>
                          <td className="break-all px-2 py-3 font-mono text-xs text-slate-500 lg:px-3">{r.vch_no || "—"}</td>
                          <td className="max-w-[220px] truncate px-2 py-3 text-slate-600 lg:max-w-[340px] lg:px-3" title={r.particulars}>
                            {r.particulars || "—"}
                          </td>
                          <td className="px-2 py-3 font-semibold text-emerald-600 lg:px-3">
                            {r.debit ? `₹ ${inr(r.debit)}` : "—"}
                          </td>
                          <td className="px-2 py-3 lg:px-3">
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                              {r.salesman_name || "—"}
                            </span>
                          </td>
                        </motion.tr>
                      ))
                    )}

                    {/* grand total row — sums the full filtered set (all pages),
                        colored like the GRAND TOTAL column on the Customer/
                        Salesman Wise pivots */}
                    {!loading && filtered.length > 0 && (
                      <tr className="border-t-2 border-amber-200 bg-amber-50/70">
                        <td colSpan={3} className="px-2 py-3 text-right font-semibold text-amber-700 lg:px-3">
                          Grand Total
                        </td>
                        <td className="px-2 py-3 font-bold text-amber-700 lg:px-3">
                          ₹ {inr(totalDebit)}
                        </td>
                        <td className="px-2 py-3 text-amber-400 lg:px-3">—</td>
                      </tr>
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
              className="mb-8 mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-blue-500" />
                <h2 className="font-semibold text-slate-800">Monthly Debit Overview</h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                  FY {chartFy}
                </span>
              </div>

              {chartData.length === 0 || chartData.every((d) => !d.debit) ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  No data recorded for FY {chartFy} yet.
                </p>
              ) : (
                <div className="h-56 w-full sm:h-72 lg:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 26, right: 12, left: 8, bottom: 4 }}
                      barCategoryGap="18%"
                    >
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
                      {/* thicker bars + total sales value shown on top of each bar */}
                      <Bar dataKey="debit" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={80}>
                        <LabelList
                          dataKey="debit"
                          position="top"
                          formatter={(v) =>
                            v >= 100000
                              ? `${(v / 100000).toFixed(1)}L`
                              : Math.round(v).toLocaleString("en-IN")
                          }
                          style={{ fontSize: 10, fontWeight: 600, fill: "#475569" }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}