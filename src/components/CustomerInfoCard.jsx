import { useEffect, useState } from "react";
import { fetchCustomerInfo, parseDate } from "../supabase/customerInfo"; // <- path apne project ke hisaab se badlo

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

export default function CustomerInfoCard({ customerName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [client, setClient] = useState(null); // sales_inquiry_master row
  const [remarks, setRemarks] = useState([]); // followup_remarks rows
  const [sales, setSales] = useState([]); // latest 10 from sales_report
  const [frequency, setFrequency] = useState(null); // avg orders per month

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // saari fetching supabase/customerInfo.js mein hai
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
  }, [customerName]);

  // close on Esc
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Latest sale: master ke fields, na ho to sales_report ki latest row
  const latest = sales[0];
  const latestDate = client?.latest_sale_date || latest?._d || null;
  const latestInvoice = client?.latest_invoice_no || latest?.vch_no;
  const latestValue = client?.latest_order_value ?? latest?.debit;

  // followup_remarks ke saare text columns, jo bhare hain
  const remarkLines = (r) =>
    [
      [null, r.followup_remark],
      ["MD", r.md_remark],
      ["Salesman", r.salesman_remark],
      ["Remark 1", r.add_rm_1],
      ["Remark 2", r.add_rm_2],
      ["Remark 3", r.add_rm_3],
      ["Remark 4", r.add_rm_4],
      ["Remark 5", r.add_rm_5],
    ].filter(([, v]) => v && String(v).trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800">Additional Information</h3>
            <p className="truncate text-xs text-slate-400">{customerName}</p>
          </div>
          {/* customer sales_inquiry_master mein nahi mila -> header mein status */}
          {!loading && !error && !client && (
            <div className="ml-auto mr-3 flex shrink-0 items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
              <span className="rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-bold text-white">
                New Customer
              </span>
            </div>
          )}
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

              <Section title="Followup Remark">
                {remarks.length === 0 ? (
                  <p className="text-xs text-slate-400">Koi remark nahi hai.</p>
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
                  <p className="text-xs text-slate-400">Koi sale record nahi mila.</p>
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
  );
}