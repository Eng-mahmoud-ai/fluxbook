import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(url && key);
export const supabase = supabaseReady ? createClient(url, key) : null;

// Default categories seeded on first run if the table is empty.
export const DEFAULT_CATEGORIES = [
  "Sales", "Consulting", "Payroll", "Software",
  "Rent", "Marketing", "Utilities", "Refund", "Installments",
];
