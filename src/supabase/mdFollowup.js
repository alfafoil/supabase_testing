import { supabase } from "./createClient";

/** MD name — automatically used as the followup-by name */
export const MD_NAME = "Dhiraj Goyal";

/** today's date as YYYY-MM-DD (local/IST — not toISOString, which gives UTC) */
export const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** "[19-10-26, 09:16 AM • Dhiraj Goyal]" — stamp placed before each remark (dd-mm-yy, 12-hour time) */
export const mdStamp = () => {
  const t = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const h = t.getHours() % 12 || 12;
  const ampm = t.getHours() >= 12 ? "PM" : "AM";
  return `[${p(t.getDate())}-${p(t.getMonth() + 1)}-${String(t.getFullYear()).slice(-2)}, ${p(h)}:${p(t.getMinutes())} ${ampm} • ${MD_NAME}]`;
};

/** latest followup_remarks row of this client — or null */
export async function fetchLatestRemarkRow(clientId) {
  const { data, error } = await supabase
    .from("followup_remarks")
    .select("*")
    .eq("sales_inqury_master_id", clientId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

/** MD followup save:
 *  - MD followup details live on the client row in sales_inquiry_master:
 *      md_current_followup_date (today), md_next_followup_date, md_followup_by
 *  - the remark goes into md_remark of the LATEST followup_remarks row of that client
 *    (sales_inqury_master_id = clientId), added at the TOP with a stamp (earlier remarks stay below it):
 *        [19-10-26, 09:16 AM • Dhiraj Goyal] - remark text
 *  - if the remark is empty, md_remark is left untouched and only the dates are saved
 *  - if the client has no followup_remarks row yet, a new row is created for the remark */
export async function saveMdFollowup({ clientId, nextDate, remark }) {
  // 1) followup details on the client row
  const { data: upd, error: e1 } = await supabase
    .from("sales_inqury_master")
    .update({
      md_current_followup_date: todayISO(),
      md_next_followup_date: nextDate,
      md_followup_by: MD_NAME,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .select("id");
  if (e1) throw e1;
  // without an RLS update policy Supabase returns no error, it just updates 0 rows
  if (!upd?.length) throw new Error("Save failed. Check the UPDATE policy (RLS) on the sales_inqury_master table.");

  // 2) remark (optional)
  const text = (remark || "").trim();
  if (!text) return;
  try {
    const latest = await fetchLatestRemarkRow(clientId);
    const stamped = `${mdStamp()} - ${text}`;
    const prev = (latest?.md_remark || "").trim();
    const md_remark = prev ? `${stamped}\n${prev}` : stamped; // newest on top

    if (latest) {
      const { data, error } = await supabase
        .from("followup_remarks")
        .update({ md_remark, updated_by: MD_NAME, updated_at: new Date().toISOString() })
        .eq("id", latest.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Check the UPDATE policy (RLS) on the followup_remarks table.");
    } else {
      const { error } = await supabase.from("followup_remarks").insert({
        sales_inqury_master_id: clientId,
        md_remark,
        created_by: MD_NAME,
        updated_by: MD_NAME,
      });
      if (error) throw error;
    }
  } catch (err) {
    throw new Error(`Followup dates were saved, but the remark failed: ${err.message || err}`);
  }
}

/** Next followup date after an unfollow — a far-future "never" date */
export const UNFOLLOW_DATE = "2031-12-31";

/** Unfollow: on the client row set md_followup_by = null and md_next_followup_date = UNFOLLOW_DATE */
export async function unfollowMd(clientId) {
  const { data, error } = await supabase
    .from("sales_inqury_master")
    .update({
      md_followup_by: null,
      md_next_followup_date: UNFOLLOW_DATE,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .select("id");
  if (error) throw error;
  // without an RLS update policy Supabase returns no error, it just updates 0 rows
  if (!data?.length) throw new Error("Unfollow failed. Check the UPDATE policy (RLS) on the sales_inqury_master table.");
}