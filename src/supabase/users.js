import { supabase } from "./createClient";

export async function faitchUserDetails() {
  const { data, error } = await supabase.from("Users").select("*");

  if (error) {
    console.error("Error fetching users:", error);
    return { data: [], error };
  }

  return { data, error: null };
}

/**
 * Insert a single new user record.
 * payload: { email, password, name, role, salesmanId }
 */
export async function insertUserDetail(payload) {
  const record = {
    email: payload.email,
    password: payload.password,
    name: payload.name,
    role: payload.role,
    salesmanId: payload.role === "Admin" ? null : payload.salesmanId || null,
  };

  const { data, error } = await supabase.from("Users").insert([record]).select();

  if (error) {
    console.error("Error inserting user:", error);
    return { data: null, error };
  }

  return { data: data?.[0] ?? null, error: null };
}

/**
 * Update the role of a single user by their id.
 * newRole must be "Admin" or "User"
 */
export async function updateUserRole(userId, newRole) {
  const { data, error } = await supabase
    .from("Users")
    .update({ role: newRole })
    .eq("id", userId)
    .select("id, email, name, salesmanId, role")
    .single();

  if (error) {
    console.error("Error updating role:", error);
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Delete a single user by their id.
 * Returns { error } — no data returned on delete.
 */
export async function deleteUser(userId) {
  const { error } = await supabase
    .from("Users")
    .delete()
    .eq("id", userId);

  if (error) {
    console.error("Error deleting user:", error);
    return { error };
  }

  return { error: null };
}

/**
 * Update the name of a single user by their id.
 */
export async function updateUserName(userId, newName) {
  const { data, error } = await supabase
    .from("Users")
    .update({ name: newName })
    .eq("id", userId)
    .select("id, email, name, salesmanId, role")
    .single();

  if (error) {
    console.error("Error updating name:", error);
    return { data: null, error };
  }

  return { data, error: null };
}