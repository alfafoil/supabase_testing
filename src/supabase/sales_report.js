import { supabase } from "./createClient";

/**
 * Parse a "01-Apr-23" / "8-May-23" style text date and derive:
 *  - month_year : "Apr-23"
 *  - fy         : "2023-2024" (Indian financial year, Apr–Mar)
 */
const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function deriveDateFields(dateStr) {
  if (!dateStr) return { month_year: null, fy: null };

  const parts = dateStr.split("-"); // ["01", "Apr", "23"]
  if (parts.length !== 3) return { month_year: null, fy: null };

  const monthName = parts[1];
  const month = MONTHS[monthName];
  const year = 2000 + parseInt(parts[2], 10); // "23" -> 2023

  if (!month || isNaN(year)) return { month_year: null, fy: null };

  const fy =
    month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

  return { month_year: `${monthName}-${parts[2]}`, fy };
}

/**
 * Fetch all rows of sales_report joined with salesman_master.
 *
 * Each returned row:
 * { id, date, particulars, vch_type, vch_no, debit, credit_amt,
 *   month_year, fy, salesman_name }
 */
export async function fetchSalesReport() {
  const { data, error } = await supabase
    .from("sales_report")
    .select(
      "id, date, particulars, vch_type, vch_no, debit, credit_amt, salesman_master(salesman_name)"
    );

  if (error) {
    console.error("Error fetching sales report:", error);
    return { data: [], error };
  }

  // Flatten the joined salesman name and add month_year + fy
  const rows = (data ?? []).map((row) => {
    const { salesman_master, ...rest } = row;
    return {
      ...rest,
      ...deriveDateFields(row.date),
      salesman_name: salesman_master?.salesman_name ?? null,
    };
  });

  console.log("Fetched sales report:", rows);
  return { data: rows, error: null };
}