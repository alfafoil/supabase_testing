import { supabase } from "./createClient";

/**
 * THE FIX: Supabase returns nested tables using their exact name as the key.
 * We add a console.log so you can see the raw shape once, then handle both
 * possible key names (Supabase sometimes lowercases them).
 *
 * Final shape returned:
 * {
 *   id, name, email, role, salesmanId,
 *   followup: {
 *     followup_id, followup_date, next_followup_date, status,
 *     remarks: [{ remark_id, remark, created_at }]
 *   } | null
 * }
 */

// Helper: Supabase can return the nested key as the table name.
// We try both casings to be safe.
function extractFollowupRow(user) {
  // Try all possible key names Supabase might use
  const raw =
    user["Followups"] ||
    user["followups"] ||
    [];
  // It's always an array for one-to-many (even though it's one-to-one via UNIQUE)
  return Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
}

function extractRemarks(followupRow) {
  const raw =
    followupRow["Followup_remarks"] ||
    followupRow["followup_remarks"] ||
    [];
  return Array.isArray(raw) ? raw : [];
}

function formatUser(user) {
  const followupRow = extractFollowupRow(user);

  return {
    id:         user.id,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    salesmanId: user.salesmanId,
    followup:   followupRow
      ? {
          followup_id:        followupRow.followup_id,
          followup_date:      followupRow.followup_date,
          next_followup_date: followupRow.next_followup_date,
          status:             followupRow.status,
          remarks:            extractRemarks(followupRow).map((r) => ({
            remark_id:  r.remark_id,
            remark:     r.remark,
            created_at: r.created_at,
          })),
        }
      : null,
  };
}

/* ── Fetch ALL users with nested followup + remarks ── */
export async function fetchUsersWithFollowups() {
  const { data, error } = await supabase
    .from("Users")
    .select(`
      id,
      name,
      email,
      role,
      salesmanId,
      Followups (
        followup_id,
        followup_date,
        next_followup_date,
        status,
        Followup_remarks (
          remark_id,
          remark,
          created_at
        )
      )
    `)
    .order("id");

  if (error) {
    console.error("fetchUsersWithFollowups error:", error);
    return { data: [], error };
  }

  // Log the raw first record so you can inspect the exact key names in console
  if (data?.length > 0) {
    console.log("RAW Supabase record (first user):", JSON.stringify(data[0], null, 2));
  }

  return { data: data.map(formatUser), error: null };
}

/* ── Fetch ONE user with followup + remarks ── */
export async function fetchUserWithFollowup(userId) {
  const { data, error } = await supabase
    .from("Users")
    .select(`
      id,
      name,
      email,
      role,
      salesmanId,
      Followups (
        followup_id,
        followup_date,
        next_followup_date,
        status,
        Followup_remarks (
          remark_id,
          remark,
          created_at
        )
      )
    `)
    .eq("id", userId)
    .single();

  if (error) {
    console.error("fetchUserWithFollowup error:", error);
    return { data: null, error };
  }

  return { data: formatUser(data), error: null };
}

/* ── Add a remark ── */
export async function addRemark(followupId, remark) {
  const { data, error } = await supabase
    .from("Followup_remarks")
    .insert({ followup_id: followupId, remark })
    .select("remark_id, remark, created_at")
    .single();

  if (error) {
    console.error("addRemark error:", error);
    return { data: null, error };
  }

  return { data, error: null };
}

/* ── Update followup status / dates ── */
export async function updateFollowup(followupId, payload) {
  const { data, error } = await supabase
    .from("Followups")
    .update(payload)
    .eq("followup_id", followupId)
    .select("followup_id, followup_date, next_followup_date, status")
    .single();

  if (error) {
    console.error("updateFollowup error:", error);
    return { data: null, error };
  }

  return { data, error: null };
}

/* ── Create a new followup for a user ── */
export async function createFollowup(payload) {
  const { data, error } = await supabase
    .from("Followups")
    .insert(payload)
    .select("followup_id, followup_date, next_followup_date, status")
    .single();

  if (error) {
    console.error("createFollowup error:", error);
    return { data: null, error };
  }

  return { data, error: null };
}