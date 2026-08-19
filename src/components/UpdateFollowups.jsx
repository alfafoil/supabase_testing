import { useState, useMemo, useEffect } from "react";
import { useFollowups } from "../hooks/useFollowups";

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────────────── */

const STATUS_OPTIONS = ["Pending", "Completed", "Cancelled", "Rescheduled", "Close"];

const REMARK_PREFILLS = [
  { code: "CL", label: "CL — Client"        },
  { code: "SM", label: "SM — Salesman"       },
  { code: "MD", label: "MD — MD Remark"      },
  { code: "VC", label: "VC — Voice Call"     },
  { code: "WA", label: "WA — WhatsApp"       },
  { code: "EM", label: "EM — Email"          },
];

const STATUS_COLORS = {
  Pending:     { bg: "bg-yellow-500/10", text: "text-yellow-400", ring: "ring-yellow-500/30", dot: "bg-yellow-400" },
  Completed:   { bg: "bg-green-500/10",  text: "text-green-400",  ring: "ring-green-500/30",  dot: "bg-green-400"  },
  Cancelled:   { bg: "bg-red-500/10",    text: "text-red-400",    ring: "ring-red-500/30",    dot: "bg-red-400"    },
  Rescheduled: { bg: "bg-blue-500/10",   text: "text-blue-400",   ring: "ring-blue-500/30",   dot: "bg-blue-400"   },
  Close:       { bg: "bg-slate-500/10",  text: "text-slate-400",  ring: "ring-slate-500/30",  dot: "bg-slate-400"  },
};

const AVATAR_COLORS = [
  "bg-violet-500", "bg-sky-500", "bg-emerald-500",
  "bg-amber-500",  "bg-rose-500","bg-cyan-500",
];

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */

const initials = (name = "") =>
  name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const today = () => new Date().toISOString().split("T")[0];

const isPast = (date) => date && new Date(date) < new Date(today());
const isFuture = (date) => date && new Date(date) > new Date(today());
const isToday = (date) => date && date === today();

/* ─────────────────────────────────────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${c.bg} ${c.text} ${c.ring}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {status || "—"}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   STAT CARD  (top bar)
───────────────────────────────────────────────────────────────────────────── */

function StatCard({ label, value, accent = "brand", onClick, active }) {
  const ACCENTS = {
    brand:   "text-amber-400  border-amber-500/20  hover:border-amber-500/50",
    red:     "text-red-400    border-red-500/20    hover:border-red-500/50",
    orange:  "text-orange-400 border-orange-500/20 hover:border-orange-500/50",
    blue:    "text-blue-400   border-blue-500/20   hover:border-blue-500/50",
    green:   "text-green-400  border-green-500/20  hover:border-green-500/50",
    purple:  "text-purple-400 border-purple-500/20 hover:border-purple-500/50",
    slate:   "text-slate-400  border-slate-500/20  hover:border-slate-500/50",
    yellow:  "text-yellow-400 border-yellow-500/20 hover:border-yellow-500/50",
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start rounded-xl border px-4 py-3 transition-all min-w-[110px]
        ${active ? "bg-white/5 border-white/20" : "bg-[#161b27] border-[#1e2636]"}
        ${ACCENTS[accent]} cursor-pointer`}
    >
      <span className={`text-2xl font-bold font-display ${ACCENTS[accent].split(" ")[0]}`}>
        {value}
      </span>
      <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">{label}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   UPDATE MODAL
───────────────────────────────────────────────────────────────────────────── */

function UpdateModal({ user, onClose, onSave }) {
  const followup = user?.followup;

  const [status,      setStatus]      = useState("Pending");
  const [nextDate,    setNextDate]    = useState("");
  const [prefill,     setPrefill]     = useState(REMARK_PREFILLS[0]);
  const [remarkText,  setRemarkText]  = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  // latest remark (shown as existing)
  const latestRemark = followup?.remarks?.[followup.remarks.length - 1]?.remark || null;

  const fullRemark = `${prefill.code} - ${remarkText}`;

  const handleSave = async () => {
    if (!nextDate)       { setError("Next followup date is required."); return; }
    if (!remarkText.trim()) { setError("Followup remark is required.");    return; }

    setSaving(true);
    setError(null);

    await onSave(user, {
      status,
      next_followup_date: nextDate,
      followup_date:      today(),
      remark:             fullRemark,
    });

    setSaving(false);
    onClose();
  };

  if (!user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[#1e2636] bg-[#0f1117] shadow-2xl overflow-hidden"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2636] bg-[#161b27]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black" fill="none"
                   viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                         m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Update Followup</p>
              <p className="text-xs text-slate-400">{user.name}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">

          {/* Inherited (read-only) section */}
          <div className="rounded-xl border border-[#1e2636] bg-[#161b27] p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="w-1 h-4 rounded-full bg-amber-500 inline-block" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Inherited (Read-Only)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Client
                </p>
                <p className="font-medium text-white">{user.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  Salesman ID
                </p>
                <p className="font-medium text-amber-400 font-mono">{user.salesmanId || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Current Followup Date
                </p>
                <p className="font-medium text-white">{fmtDate(followup?.followup_date)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Role</p>
                <p className="font-medium text-white">{user.role}</p>
              </div>
            </div>
          </div>

          {/* New Followup Entry */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="w-1 h-4 rounded-full bg-amber-500 inline-block" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                New Followup Entry
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" /></svg>
                  Status <span className="text-red-400">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-[#1e2636] bg-[#161b27] px-3 py-2
                             text-sm text-white outline-none focus:border-amber-500/50
                             focus:ring-1 focus:ring-amber-500/20"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Next Followup Date */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Next Followup Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="w-full rounded-lg border border-[#1e2636] bg-[#161b27] px-3 py-2
                             text-sm text-white outline-none focus:border-amber-500/50
                             focus:ring-1 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* Remark Prefill */}
            <div className="mt-3">
              <label className="block text-[11px] text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" /></svg>
                Remark Prefill <span className="text-red-400">*</span>
              </label>
              <select
                value={prefill.code}
                onChange={(e) => setPrefill(REMARK_PREFILLS.find((r) => r.code === e.target.value))}
                className="w-full rounded-lg border border-[#1e2636] bg-[#161b27] px-3 py-2
                           text-sm text-white outline-none focus:border-amber-500/50
                           focus:ring-1 focus:ring-amber-500/20"
              >
                {REMARK_PREFILLS.map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Remark will start with:{" "}
                <span className="text-amber-400 font-mono font-medium">{prefill.code} -</span>
              </p>
            </div>

            {/* Remark textarea */}
            <div className="mt-3">
              <label className="block text-[11px] text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                Followup Remark <span className="text-red-400">*</span>
              </label>
              <div className="flex rounded-lg border border-[#1e2636] bg-[#161b27] overflow-hidden
                              focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20">
                {/* Prefill tag */}
                <div className="flex items-start px-3 pt-2.5 border-r border-[#1e2636] bg-[#0f1117]">
                  <span className="text-sm font-mono font-bold text-amber-400">{prefill.code} -</span>
                </div>
                <textarea
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  rows={3}
                  placeholder="Type the followup notes…"
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-slate-600
                             outline-none resize-none"
                />
              </div>
              {/* Will save as preview */}
              <p className="text-[11px] text-slate-500 mt-1">
                Will save as:{" "}
                <span className="text-amber-400 font-mono">
                  {prefill.code} - {remarkText ? remarkText.slice(0, 30) + (remarkText.length > 30 ? "…" : "") : "…"}
                </span>
              </p>
            </div>

            {/* Existing remark */}
            {latestRemark && (
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/70 mb-1 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Existing Remark — New Entry Will Be Added On Top
                </p>
                <p className="text-xs text-slate-300">{latestRemark}</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#1e2636] bg-[#161b27]">
          <p className="text-[11px] text-slate-500">
            Will save as:{" "}
            <span className="text-amber-400 font-mono">{prefill.code} - {remarkText ? "..." : "…"}</span>
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="rounded-lg border border-[#1e2636] px-4 py-2 text-sm text-slate-300
                         hover:border-slate-600 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm
                         font-semibold text-black hover:bg-amber-400 transition-colors
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                   viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3
                         m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saving ? "Saving…" : "Save Update"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   INFO MODAL  (read-only all remarks)
───────────────────────────────────────────────────────────────────────────── */

function InfoModal({ user, onClose }) {
  if (!user) return null;
  const remarks = user.followup?.remarks || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[#1e2636] bg-[#0f1117] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2636] bg-[#161b27]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm
              ${AVATAR_COLORS[user.id % AVATAR_COLORS.length]}`}>
              {initials(user.name)}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{user.name}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#1e2636] bg-[#161b27] p-4 text-sm">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Status</p>
              <StatusBadge status={user.followup?.status} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Salesman ID</p>
              <p className="font-mono text-amber-400 font-semibold">{user.salesmanId || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Current Followup</p>
              <p className="text-white">{fmtDate(user.followup?.followup_date)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Next Followup</p>
              <p className="text-white">{fmtDate(user.followup?.next_followup_date)}</p>
            </div>
          </div>

          {/* All remarks */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
              All Remarks ({remarks.length})
            </p>
            {remarks.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No remarks yet.</p>
            ) : (
              <div className="space-y-2">
                {[...remarks].reverse().map((r, i) => (
                  <div key={r.remark_id}
                    className="rounded-lg border border-[#1e2636] bg-[#161b27] px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-amber-400">#{remarks.length - i}</span>
                      <span className="text-[10px] text-slate-500">{fmtDate(r.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-300">{r.remark}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN PAGE — UpdateFollowups
───────────────────────────────────────────────────────────────────────────── */

export default function UpdateFollowups() {
  const { users, loading, error, refetch, addRemark, updateFollowup, createFollowup } = useFollowups();

  // modals
  const [updateTarget, setUpdateTarget] = useState(null);
  const [infoTarget,   setInfoTarget]   = useState(null);

  // filters
  const [search,         setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState("All");
  const [filterPeriod,   setFilterPeriod]   = useState("All Months");

  /* ── derived stats ── */
  const stats = useMemo(() => {
    const all = users;
    const todayStr = today();

    return {
      total:           all.length,
      todayFollowup:   all.filter((u) => u.followup?.followup_date === todayStr).length,
      missed:          all.filter((u) => isPast(u.followup?.next_followup_date)).length,
      future:          all.filter((u) => isFuture(u.followup?.next_followup_date)).length,
      todayCurrent:    all.filter((u) => u.followup?.next_followup_date === todayStr).length,
      last7Days:       all.filter((u) => {
        if (!u.followup?.followup_date) return false;
        const d = new Date(u.followup.followup_date);
        const diff = (new Date() - d) / 86400000;
        return diff >= 0 && diff <= 7;
      }).length,
      yesterday:       all.filter((u) => {
        const y = new Date(); y.setDate(y.getDate() - 1);
        return u.followup?.followup_date === y.toISOString().split("T")[0];
      }).length,
      pending:         all.filter((u) => u.followup?.status === "Pending").length,
      completed:       all.filter((u) => u.followup?.status === "Completed").length,
      noFollowup:      all.filter((u) => !u.followup).length,
    };
  }, [users]);

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    let list = [...users];
    const q = search.trim().toLowerCase();

    if (q) {
      list = list.filter((u) =>
        [u.name, u.email, u.salesmanId, u.followup?.status].join(" ").toLowerCase().includes(q)
      );
    }

    if (filterStatus !== "All") {
      list = list.filter((u) =>
        filterStatus === "No Followup"
          ? !u.followup
          : u.followup?.status === filterStatus
      );
    }

    return list;
  }, [users, search, filterStatus]);

  /* ── save handler ── */
  const handleSave = async (user, payload) => {
    const { status, next_followup_date, followup_date, remark } = payload;

    if (user.followup) {
      // 1. Update status + dates on existing followup
      await updateFollowup(user.followup.followup_id, {
        status,
        next_followup_date,
        followup_date,
      });
      // 2. Add the new remark (hook refetches inside addRemark automatically)
      await addRemark(user.followup.followup_id, remark);
    } else {
      // 1. Create brand-new followup for this user
      const { data } = await createFollowup(user.id, {
        followup_date,
        next_followup_date,
        status,
      });
      // 2. Add remark to the new followup
      if (data?.followup_id) {
        await addRemark(data.followup_id, remark);
      }
    }
    // NOTE: no extra refetch() here — the hook already refetches after each write above
  };

  /* ── render ── */
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100">

      {/* ── Top banner ── */}
      <div className="bg-[#161b27] border-b border-[#1e2636] px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-black" fill="none"
                   viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                         m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-display font-bold text-white">Update Followup</h1>
              <p className="text-xs text-slate-400">{stats.total} records loaded</p>
            </div>
          </div>

          {/* Total / Filtered / Filters chips */}
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#0f1117] border border-[#1e2636] px-3 py-1.5 text-center min-w-[60px]">
              <p className="text-xs font-bold text-white">{stats.total}</p>
              <p className="text-[10px] text-slate-500">Total</p>
            </div>
            <div className="rounded-lg bg-[#0f1117] border border-[#1e2636] px-3 py-1.5 text-center min-w-[60px]">
              <p className="text-xs font-bold text-amber-400">{filtered.length}</p>
              <p className="text-[10px] text-slate-500">Filtered</p>
            </div>
            <button
              onClick={() => { setSearch(""); setFilterStatus("All"); setFilterPeriod("All Months"); }}
              className="rounded-lg bg-[#0f1117] border border-[#1e2636] px-3 py-1.5 text-center min-w-[60px]
                         hover:border-amber-500/50 transition-colors"
            >
              <p className="text-xs font-bold text-slate-300">0</p>
              <p className="text-[10px] text-slate-500">Filters</p>
            </button>
          </div>
        </div>

        {/* ── Stat cards row ── */}
        <div className="mt-4 flex flex-wrap gap-2">
          <StatCard label="Today's Followup"    value={stats.todayFollowup}  accent="green"  onClick={() => setFilterStatus("All")} />
          <StatCard label="Missed Followup"     value={stats.missed}         accent="red"    onClick={() => setFilterStatus("All")} />
          <StatCard label="Future Followup"     value={stats.future}         accent="blue"   onClick={() => setFilterStatus("All")} />
          <StatCard label="Today's Current"     value={stats.todayCurrent}   accent="brand"  onClick={() => setFilterStatus("All")} />
          <StatCard label="Last 7 Days"         value={stats.last7Days}      accent="purple" onClick={() => setFilterStatus("All")} />
          <StatCard label="Yesterday Followup"  value={stats.yesterday}      accent="slate"  onClick={() => setFilterStatus("All")} />
          <StatCard label="Pending"             value={stats.pending}        accent="yellow" onClick={() => setFilterStatus("Pending")}   active={filterStatus === "Pending"} />
          <StatCard label="Completed"           value={stats.completed}      accent="green"  onClick={() => setFilterStatus("Completed")} active={filterStatus === "Completed"} />
          <StatCard label="No Followup"         value={stats.noFollowup}     accent="orange" onClick={() => setFilterStatus("No Followup")} active={filterStatus === "No Followup"} />
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="px-6 py-3 border-b border-[#1e2636] flex flex-wrap items-center gap-2">
        {/* Status filter pills */}
        {["All", "Pending", "Completed", "Cancelled", "Rescheduled", "Close", "No Followup"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              filterStatus === s
                ? "bg-amber-500 text-black border-amber-500"
                : "border-[#1e2636] text-slate-400 hover:border-amber-500/50 hover:text-slate-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Main content ── */}
      <div className="px-6 py-5">

        {/* Search + date sort */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-amber-500 inline-block" />
            <h2 className="text-sm font-semibold text-white">
              Master Record Details
              <span className="ml-2 text-xs text-slate-500 font-normal">{filtered.length}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients, salesman…"
                className="rounded-lg border border-[#1e2636] bg-[#161b27] py-2 pl-8 pr-4
                           text-sm text-white placeholder-slate-600 outline-none w-56
                           focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
              />
            </div>

            {/* Month filter */}
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="rounded-lg border border-[#1e2636] bg-[#161b27] px-3 py-2 text-sm
                         text-white outline-none focus:border-amber-500/50"
            >
              {["All Months","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>

            {/* Date sort */}
            <button className="flex items-center gap-1.5 rounded-lg border border-[#1e2636] bg-[#161b27]
                               px-3 py-2 text-xs text-slate-400 hover:border-amber-500/50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none"
                   viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7l4-4m0 0l4 4m-4-4v18" />
              </svg>
              Date ↑
            </button>

            {/* Refresh */}
            <button
              onClick={refetch}
              className="flex items-center gap-1.5 rounded-lg border border-[#1e2636] bg-[#161b27]
                         px-3 py-2 text-xs text-slate-400 hover:border-amber-500/50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none"
                   viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581
                         m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* ── List ── */}
        {loading ? (
          /* skeleton */
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[#1e2636] bg-[#161b27] p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-1/3" />
                    <div className="h-3 bg-slate-800 rounded w-1/4" />
                    <div className="h-3 bg-slate-800 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            ⚠ {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            No records found{search ? ` for "${search}"` : ""}.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((user, idx) => {
              const followup       = user.followup;
              const latestRemark   = followup?.remarks?.slice(-1)[0]?.remark || null;
              const remarkCount    = followup?.remarks?.length || 0;
              const nextIsPast     = isPast(followup?.next_followup_date);
              const nextIsToday    = isToday(followup?.next_followup_date);

              return (
                <div key={user.id}
                  className="rounded-xl border border-[#1e2636] bg-[#161b27] p-5
                             hover:border-amber-500/20 transition-colors">
                  <div className="flex items-start gap-4">

                    {/* Row number */}
                    <span className="text-xs text-slate-600 font-mono w-5 pt-1 shrink-0">{idx + 1}</span>

                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center
                                     text-white font-bold text-sm shrink-0
                                     ${AVATAR_COLORS[user.id % AVATAR_COLORS.length]}`}>
                      {initials(user.name)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">

                        {/* Left: name, status, dates */}
                        <div className="space-y-2 min-w-0">
                          {/* Name + status */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Client Name</p>
                          </div>
                          <p className="font-semibold text-white text-base leading-tight">{user.name}</p>

                          <div className="flex items-center gap-2 flex-wrap">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Status</p>
                              {followup
                                ? <StatusBadge status={followup.status} />
                                : <span className="text-xs text-slate-600 italic">No followup</span>
                              }
                            </div>
                          </div>

                          {/* Dates row */}
                          {followup && (
                            <div className="flex flex-wrap gap-6 mt-1">
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
                                  Current Followup
                                </p>
                                <p className="text-sm text-white font-medium">
                                  {fmtDate(followup.followup_date)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
                                  Next Followup
                                </p>
                                <p className={`text-sm font-medium ${
                                  nextIsPast  ? "text-red-400" :
                                  nextIsToday ? "text-green-400" :
                                  "text-white"
                                }`}>
                                  {fmtDate(followup.next_followup_date)}
                                  {nextIsPast  && <span className="ml-1 text-[10px]">⚠ Missed</span>}
                                  {nextIsToday && <span className="ml-1 text-[10px]">● Today</span>}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
                                  Followed By
                                </p>
                                <p className="text-sm text-amber-400 font-medium font-mono">
                                  {user.salesmanId || "—"}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Latest remark */}
                          {latestRemark && (
                            <div className="mt-1">
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
                                Followup Remark
                                {remarkCount > 1 && (
                                  <span className="ml-1 text-amber-500">({remarkCount} total)</span>
                                )}
                              </p>
                              <p className="text-sm text-slate-300 line-clamp-2">{latestRemark}</p>
                            </div>
                          )}
                        </div>

                        {/* Right: action buttons */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => setUpdateTarget(user)}
                            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2
                                       text-xs font-semibold text-black hover:bg-amber-400 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none"
                                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                                       m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Update
                          </button>
                          <button
                            onClick={() => setInfoTarget(user)}
                            className="flex items-center gap-1.5 rounded-lg border border-[#1e2636]
                                       px-4 py-2 text-xs text-slate-300 hover:border-amber-500/50
                                       hover:text-amber-400 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none"
                                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Info
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {updateTarget && (
        <UpdateModal
          user={updateTarget}
          onClose={() => setUpdateTarget(null)}
          onSave={handleSave}
        />
      )}
      {infoTarget && (
        <InfoModal
          user={infoTarget}
          onClose={() => setInfoTarget(null)}
        />
      )}
    </div>
  );
}