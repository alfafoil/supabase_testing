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