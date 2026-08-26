import { supabase } from "./createClient";

export async function faitchUserDetails() {
  const { data, error } = await supabase.from("Users").select("*");

  if (error) {
    console.error("Error fetching users:", error);
    return { data: [], error };
  }

  console.log("Fetched users:", data);
  return { data, error: null };
}

/**
 * Insert a single new user record.
 * payload: { email, password, name, role, salesmanId }
 * - role must be "Admin" or "User"
 * - salesmanId should be omitted/null for Admins (the DB column is nullable)
 */
export async function insertUserDetail(payload) {
  const record = {
    email: payload.email,
    password: payload.password,
    name: payload.name,
    role: payload.role,
    // keep NULL (not "") for Admins so it doesn't collide with the
    // unique constraint on salesmanId
    salesmanId: payload.role === "Admin" ? null : payload.salesmanId || null,
  };

  const { data, error } = await supabase.from("Users").insert([record]).select();

  if (error) {
    console.error("Error inserting user:", error);
    return { data: null, error };
  }

  console.log("Inserted user:", data);
  return { data: data?.[0] ?? null, error: null };
}

/**
 * Look up a single user by email + password for the login screen.
 * This demo project stores passwords as plain text (no hashing yet), so
 * this is a straight equality match against the Users table.
 *
 * Returns { data: userRecord | null, error }
 * - data is null and error.message is set on a bad email/password combo
 */
export async function loginUser({ email, password }) {
  const { data, error } = await supabase
    .from("Users")
    .select("*")
    .eq("email", email)
    .eq("password", password)
    .maybeSingle();

  if (error) {
    console.error("Error logging in:", error);
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: { message: "Invalid email or password." } };
  }

  console.log("Logged in user:", data);
  return { data, error: null };
}