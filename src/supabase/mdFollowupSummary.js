import { supabase } from "./createClient";
import { todayISO } from "./mdFollowup";

const PAGE = 1000; // Supabase returns at most 1000 rows per request

/** name matching: trimmed, case-insensitive, repeated / non-breaking spaces collapsed */
export const nameKey = (s) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** reads every page of a query (stable order is required, so the query must be ordered) */
async function fetchAllRows(makeQuery) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** rows -> { count, names }  (count = number of clients, names = Set of nameKey(company_name)) */
const toList = (rows) => ({
  count: rows.length,
  names: new Set(rows.map((r) => nameKey(r.company_name)).filter(Boolean)),
});

/**
 * Reads the two lists shown above the table, straight from sales_inqury_master:
 *   followed -> clients where md_followup_by is NOT null        ("Client Followed By Me")
 *   today    -> clients where md_next_followup_date = today     ("Today's Followup")
 *   missed   -> clients where md_next_followup_date < today     ("Missed Followup")
 * Each list holds the client count and the set of their company names, which the page
 * uses to filter the table by Customer Name.
 */
export async function fetchMdFollowupLists() {
  const base = () => supabase.from("sales_inqury_master").select("id,company_name");

  const [followed, today, missed] = await Promise.all([
    fetchAllRows(() => base().not("md_followup_by", "is", null).order("id", { ascending: true })),
    fetchAllRows(() => base().eq("md_next_followup_date", todayISO()).order("id", { ascending: true })),
    // Missed Followup: next followup date is before today (rows with no date are not included)
    fetchAllRows(() => base().lt("md_next_followup_date", todayISO()).order("id", { ascending: true })),
  ]);

  return { followed: toList(followed), today: toList(today), missed: toList(missed) };
}

/* ---------------- export support ---------------- */

/** one followup_remarks row -> its remark text (followup_remark, else md_remark) */
const remarkTextOf = (row) => String(row.followup_remark || row.md_remark || "").trim();

/** Map of nameKey(company_name) -> followup details, used by the Export button.

    sales_inqury_master columns used:
      Customer Address      -> comp_address
      Current Followup Date -> md_current_followup_date, else current_followup_date
      Next Followup Date    -> md_next_followup_date,    else next_followup_date
      Followup By           -> md_followup_by,           else follow_up_by
      Followup Remark       -> ALL remarks: followup_remark (else md_remark) of every followup_remarks
                               row of the client, newest first; else first_remark

    The md_* fields (the MD's own followup) win; the sales-team fields are the fallback
    when the MD has not followed the client. */
export async function fetchFollowupDetails() {
  const [clients, remarkRows] = await Promise.all([
    fetchAllRows(() =>
      supabase
        .from("sales_inqury_master")
        .select(
          "id,company_name,comp_address," +
            "md_current_followup_date,md_next_followup_date,md_followup_by," +
            "current_followup_date,next_followup_date,follow_up_by,first_remark"
        )
        .order("id", { ascending: true })
    ),
    fetchAllRows(() =>
      supabase
        .from("followup_remarks")
        .select("id,sales_inqury_master_id,followup_remark,md_remark,created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
    ),
  ]);

  // ALL remarks per client id, newest first (rows arrive newest first; inside one row the
  // newest remark is already on top). Rows are joined with a line break.
  const remarkParts = new Map(); // client id -> array of remark texts
  for (const r of remarkRows) {
    const id = r.sales_inqury_master_id;
    const text = remarkTextOf(r);
    if (id == null || !text) continue;
    if (!remarkParts.has(id)) remarkParts.set(id, []);
    remarkParts.get(id).push(text);
  }
  const remarkById = new Map();
  for (const [id, parts] of remarkParts.entries()) remarkById.set(id, parts.join("\n"));

  // one entry per company; if a company has several rows, each field takes the first non-empty value
  const map = new Map();
  for (const r of clients) {
    const key = nameKey(r.company_name);
    if (!key) continue;
    const cur = map.get(key) || {
      address: "",
      currentFollowupDate: "",
      nextFollowupDate: "",
      followupBy: "",
      followupRemark: "",
    };
    map.set(key, {
      address: cur.address || r.comp_address || "",
      currentFollowupDate:
        cur.currentFollowupDate || r.md_current_followup_date || r.current_followup_date || "",
      nextFollowupDate:
        cur.nextFollowupDate || r.md_next_followup_date || r.next_followup_date || "",
      followupBy: cur.followupBy || r.md_followup_by || r.follow_up_by || "",
      followupRemark: cur.followupRemark || remarkById.get(r.id) || r.first_remark || "",
    });
  }
  return map;
}