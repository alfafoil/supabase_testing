import { useEffect, useState } from "react";
import { fetchCustomerInfo, parseDate } from "../supabase/customerInfo"; // <- adjust the path to match your project
import MdFollowupCard from "./MdFollowupCard";
import { unfollowMd } from "../supabase/mdFollowup";

/* ---------------- helpers ---------------- */

const fmtDate = (v) => {
  const d = v instanceof Date ? v : parseDate(v);
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};

const inr = (n) =>
  n == null || n === "" ? "—" : "₹ " + Math.round(Number(n) || 0).toLocaleString("en-IN");

const isUrl = (s) => /^https?:\/\//i.test((s || "").trim());

function Field({ label, children, tone }) {
  const toneCls =
    tone === "red"
      ? "font-semibold text-rose-600"
      : tone === "green"
      ? "font-semibold text-emerald-600"
      : tone === "blue"
      ? "font-semibold text-blue-600"
      : "font-medium text-slate-700";
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 break-words text-sm ${toneCls}`}>{children || "—"}</p>
    </div>
  );
}

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

/* ---------------- component ---------------- */

export default function CustomerInfoCard({ customerName, onClose, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [client, setClient] = useState(null); // sales_inqury_master row
  const [remarks, setRemarks] = useState([]); // followup_remarks rows
  const [sales, setSales] = useState([]); // latest 10 from sales_report
  const [frequency, setFrequency] = useState(null); // avg orders per month
  const [mdOpen, setMdOpen] = useState(false); // is the MD Followup Card open?
  const [confirmOpen, setConfirmOpen] = useState(false); // is the Unfollow confirmation open?
  const [unfollowBusy, setUnfollowBusy] = useState(false);
  const [unfollowErr, setUnfollowErr] = useState("");
  const [reloadKey, setReloadKey] = useState(0); // bump to reload data after an MD save / unfollow

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // all fetching lives in supabase/customerInfo.js
        const { client: c, remarks: rem, sales: top10, frequency: freq } = await fetchCustomerInfo(customerName || "");

        if (!cancelled) {
          setClient(c);
          setRemarks(rem);
          setSales(top10);
          setFrequency(freq);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerName, reloadKey]);

  // close on Esc
  useEffect(() => {
    const h = (e) => {
      if (e.key !== "Escape") return;
      if (confirmOpen) setConfirmOpen(false); // topmost popup closes first
      else if (!mdOpen) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, mdOpen, confirmOpen]);

  // Latest sale: use the master fields, fall back to the latest sales_report row
  const latest = sales[0];
  const latestDate = client?.latest_sale_date || latest?._d || null;
  const latestInvoice = client?.latest_invoice_no || latest?.vch_no;
  const latestValue = client?.latest_order_value ?? latest?.debit;

  // MD followup details are columns of the client row in sales_inqury_master
  const mdInfo = client;

  // Unfollow (runs after OK in the confirmation popup):
  // clears Followed By (md_followup_by) and sets the next followup date to 31-12-2031
  const handleUnfollow = async () => {
    setConfirmOpen(false);
    if (!client) return;
    setUnfollowBusy(true);
    setUnfollowErr("");
    try {
      await unfollowMd(client.id);
      setReloadKey((k) => k + 1); // card refresh
      onChanged?.(); // tell the page to refresh its data
    } catch (err) {
      setUnfollowErr(err.message || "Unfollow failed");
    } finally {
      setUnfollowBusy(false);
    }
  };

  // only rows that have an md_remark
  const mdRemarks = remarks.filter((r) => r.md_remark && String(r.md_remark).trim());

  // all filled text columns of a followup_remarks row
  const remarkLines = (r) =>
    [
      [null, r.followup_remark],
      ["Salesman", r.salesman_remark],
      ["Remark 1", r.add_rm_1],
      ["Remark 2", r.add_rm_2],
      ["Remark 3", r.add_rm_3],
      ["Remark 4", r.add_rm_4],
      ["Remark 5", r.add_rm_5],
    ].filter(([, v]) => v && String(v).trim());

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-slate-800">Additional Information</h3>
              {/* pencil -> MD Followup Card (only when the client exists in sales_inqury_master) */}
              {client && (
                <button
                  onClick={() => setMdOpen(true)}
                  title="MD Followup"
                  className="rounded-full p-1 text-slate-400 transition-colors hover:bg-orange-50 hover:text-orange-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                </button>
              )}
              {/* Unfollow — only when Followed By is filled in MD Followup Details */}
              {client && mdInfo?.md_followup_by && (
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={unfollowBusy}
                  title="Remove Followed By"
                  className="ml-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-0.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {unfollowBusy ? "…" : "Unfollow"}
                </button>
              )}
            </div>
            {unfollowErr && <p className="mt-0.5 text-[11px] text-rose-500">{unfollowErr}</p>}
            <p className="truncate text-xs text-slate-400">{customerName}</p>
          </div>
          {/* customer not found in sales_inqury_master -> status in the header */}
          {!loading && !error && !client && (
            <div className="ml-auto mr-3 flex shrink-0 items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
              <span className="rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-bold text-white">
                New Customer
              </span>
            </div>
          )}
          {/* refresh — reloads client, remarks and sales data */}
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            className="mr-1 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            title="Refresh"
          >
            <svg
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m10.5-3.12A8.25 8.25 0 005.1 8.4M3.523 14.652A8.25 8.25 0 0018.9 15.6" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="space-y-3 overflow-y-auto p-4 sm:p-5 [scrollbar-width:thin]">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-rose-500">{error}</p>
          ) : (
            <>
              <Section title="Client Identity">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Client Name">{client?.cust_name}</Field>
                  <Field label="Company Name">{client?.company_name || customerName}</Field>
                  <Field label="Contact Number">{client?.contact_number}</Field>
                  <Field label="Reference Sheet" tone="blue">
                    {client?.refrence_sheet &&
                      (isUrl(client.refrence_sheet) ? (
                        <a href={client.refrence_sheet.trim()} target="_blank" rel="noreferrer" className="underline">
                          Open Sheet
                        </a>
                      ) : (
                        client.refrence_sheet
                      ))}
                  </Field>
                </div>
              </Section>

              <Section title="Followup Details">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <Field label="Marketing Person">{client?.salesman}</Field>
                  <Field label="Followed By" tone="red">{client?.follow_up_by}</Field>
                  <Field label="Status" tone="green">{client?.status}</Field>
                  <Field label="Current Followup Date">{client?.current_followup_date && fmtDate(client.current_followup_date)}</Field>
                  <Field label="Next Followup Date">{client?.next_followup_date && fmtDate(client.next_followup_date)}</Field>
                </div>
              </Section>

              <Section title="MD Folllowup Details">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Current Followup Date">{mdInfo?.md_current_followup_date && fmtDate(mdInfo.md_current_followup_date)}</Field>
                  <Field label="Next Followup Date">{mdInfo?.md_next_followup_date && fmtDate(mdInfo.md_next_followup_date)}</Field>
                  <Field label="Followed By" tone="red">{mdInfo?.md_followup_by}</Field>
                </div>
              </Section>

              <Section title="MD Remark">
                {mdRemarks.length === 0 ? (
                  <p className="text-xs text-slate-400">No MD remark yet.</p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {mdRemarks.map((r) => (
                      <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <p className="whitespace-pre-line">{r.md_remark}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Followup Remark">
                {remarks.length === 0 ? (
                  <p className="text-xs text-slate-400">No remark yet.</p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {remarks.map((r) => (
                      <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <p className="mb-1 text-[10px] text-slate-400">
                          {fmtDate(r.created_at)}
                          {r.created_by ? ` · ${r.created_by}` : ""}
                        </p>
                        {remarkLines(r).map(([k, v], i) => (
                          <p key={i} className="whitespace-pre-line">
                            {k && <span className="font-semibold text-slate-500">{k}: </span>}
                            {v}
                          </p>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Sales Details">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Latest Sale Date">{latestDate && fmtDate(latestDate)}</Field>
                  <Field label="Latest Invoice No.">{latestInvoice}</Field>
                  <Field label="Latest Order Value">{latestValue != null ? inr(latestValue) : ""}</Field>
                  <Field label="Frequency">
                    {frequency?.count
                      ? `${frequency.perMonth.toFixed(1)} orders / month (${frequency.count} in ${frequency.months} mo)`
                      : ""}
                  </Field>
                </div>
              </Section>

              <Section title="Previous Sales History">
                {sales.length === 0 ? (
                  <p className="text-xs text-slate-400">No sales record found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                          <th className="px-2 py-1.5">Order Date</th>
                          <th className="px-2 py-1.5">Invoice Number</th>
                          <th className="px-2 py-1.5 text-right">Order Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((s) => (
                          <tr key={s.id} className="border-b border-slate-100">
                            <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">{fmtDate(s._d || s.date)}</td>
                            <td className="px-2 py-1.5 text-slate-700">{s.vch_no || "—"}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono font-semibold text-slate-700">
                              {inr(s.debit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>

    {/* MD Followup Card — separate overlay above this card */}
    {mdOpen && client && (
      <MdFollowupCard
        client={client}
        customerName={customerName}
        onClose={() => setMdOpen(false)}
        onSaved={() => {
          setMdOpen(false);
          setReloadKey((k) => k + 1); // remarks list refresh
          onChanged?.(); // tell the page to refresh its data
        }}
      />
    )}

    {/* Unfollow confirmation popup */}
    {confirmOpen && (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4"
        onClick={() => setConfirmOpen(false)}
      >
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-base font-semibold text-slate-800">Are you sure?</h3>
          <p className="mt-1.5 text-sm text-slate-500">
            This will remove "{mdInfo?.md_followup_by}" from Followed By and set the Next Followup Date to 31-12-2031.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUnfollow}
              autoFocus
              className="rounded-lg bg-rose-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-600"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}