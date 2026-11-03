import { supabase } from "./createClient";

/** escape % and _ so ilike behaves like an exact (case-insensitive) match */
const likeExact = (s) => s.replace(/[\\%_]/g, (c) => "\\" + c);

/**
 * customer_master row where customer_name = Company Name,
 * plus the salesman name from salesman_master (via the salesman_id foreign key).
 */
export async function fetchCustomerMaster(companyName) {
  const name = (companyName || "").trim();
  if (!name) return null;

  const { data, error } = await supabase
    .from("customer_master")
    .select("id, customer_name, billing_address, salesman_master ( salesman_name )")
    .ilike("customer_name", likeExact(name))
    .order("id", { ascending: false })
    .limit(1);

  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;

  return {
    billing_address: row.billing_address,
    salesman_name: row.salesman_master?.salesman_name || "",
  };
}