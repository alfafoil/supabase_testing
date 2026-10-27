import { supabase } from "./createClient";

/* ---------------- helpers ---------------- */

const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** sales_report.date is TEXT — parse the common formats into a Date */
export const parseDate = (s) => {
  if (!s) return null;
  const t = String(s).trim();
  let m;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], +m[2] - 1, +m[3]); // 2026-10-27
  if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(y, +m[2] - 1, +m[1]); // 27-10-2026 / 27/10/26
  }
  if ((m = t.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[a-z]*[-\s/,]*(\d{2,4})/))) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(y, MON[m[2].toLowerCase()] ?? 0, +m[1]); // 27-Oct-26
  }
  const d = new Date(t);
  return isNaN(d) ? null : d;
};

/** escape % and _ so ilike behaves like an exact (case-insensitive) match */
const likeExact = (s) => s.replace(/[\\%_]/g, (c) => "\\" + c);

/* ---------------- queries ---------------- */

/** sales_inqury_master row where company_name = customer name (or null) */
export async function fetchInquiryClient(customerName) {
  const { data, error } = await supabase
    .from("sales_inqury_master")
    .select("*")
    .ilike("company_name", likeExact(customerName.trim()))
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

/** all followup_remarks rows of one client, newest first */
export async function fetchFollowupRemarks(clientId) {
  const { data, error } = await supabase
    .from("followup_remarks")
    .select("*")
    .eq("sales_inqury_master_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** latest 10 sales of a customer from sales_report (date is text, so sorted in JS) */
export async function fetchSalesHistory(customerName, limit = 10) {
  const { data, error } = await supabase
    .from("sales_report")
    .select("id,date,vch_no,debit,created_at")
    .ilike("particulars", likeExact(customerName.trim()))
    .gt("debit", 0);
  if (error) throw error;
  return (data || [])
    .map((r) => ({ ...r, _d: parseDate(r.date) }))
    .sort((a, b) => (b._d?.getTime() || 0) - (a._d?.getTime() || 0) || b.id - a.id)
    .slice(0, limit);
}

/** everything the Additional Information card needs, in one call */
export async function fetchCustomerInfo(customerName) {
  const client = await fetchInquiryClient(customerName);
  const [remarks, sales] = await Promise.all([
    client ? fetchFollowupRemarks(client.id) : Promise.resolve([]),
    fetchSalesHistory(customerName),
  ]);
  return { client, remarks, sales };
}