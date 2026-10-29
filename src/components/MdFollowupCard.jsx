import { useEffect, useState } from "react";
import { saveMdFollowup, MD_NAME, todayISO } from "../supabase/mdFollowup"; // <- adjust the path to match your project

/* "2026-10-29" -> "29 Oct 2026" (local date, no timezone shift) */
const fmtISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5">
      <h4 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
        <span className="h-3.5 w-1 rounded-full bg-orange-500" />
        {title}
      </h4>
      {children}
    </section>
  );
}

const labelCls = "text-[10px] font-semibold uppercase tracking-wider text-slate-400";
const readOnlyCls =
  "mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600";

/**
 * MD Followup Card
 * Props:
 *  - client       : sales_inquiry_master row (id is required)
 *  - customerName : shown in the header
 *  - onClose      : closes only this card
 *  - onSaved      : called after a successful save (parent card refreshes)
 */
export default function MdFollowupCard({ client, customerName, onClose, onSaved }) {
  const today = todayISO();
  const [nextDate, setNextDate] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Esc closes only this card
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!nextDate) {
      setError("Next Followup Date is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveMdFollowup({ clientId: client.id, nextDate, remark });
      onSaved();
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-3 sm:p-6" onClick={onClose}>
      <form
        onSubmit={submit}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800">MD Followup Card</h3>
            <p className="truncate text-xs text-slate-400">{customerName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="space-y-3 overflow-y-auto p-4 sm:p-5 [scrollbar-width:thin]">
          <Section title="Followup Details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className={labelCls}>Current Followup Date</p>
                <p className={readOnlyCls}>{fmtISO(today)}</p>
              </div>

              <div>
                <label htmlFor="md-next-date" className={labelCls}>
                  Next Followup Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="md-next-date"
                  type="date"
                  required
                  min={today}
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <p className={labelCls}>Followup By</p>
                <p className={readOnlyCls}>{MD_NAME}</p>
              </div>
            </div>
          </Section>

          <Section title="Remarks">
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={6}
              placeholder="Write the new followup remark here…"
              className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-orange-400 disabled:bg-slate-100"
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              The remark is saved with a date-time and name stamp, added above any earlier MD remark.
            </p>
          </Section>

          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Followup"}
          </button>
        </div>
      </form>
    </div>
  );
}