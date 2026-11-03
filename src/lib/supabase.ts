import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "./supabaseConfig";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
let supabaseUrl = "";
let configurationError = "";

if (!configuredUrl || !supabaseAnonKey) {
  configurationError =
    "The Supabase project URL and publishable/anon key are both required.";
} else {
  try {
    const normalized = normalizeSupabaseUrl(configuredUrl);
    supabaseUrl = normalized.url;
    if (normalized.normalizedApiPath && import.meta.env.DEV) {
      console.warn(
        "[Stride auth] Removed an API suffix from VITE_SUPABASE_URL. The Supabase SDK requires the project’s base URL.",
      );
    }
  } catch (error) {
    configurationError =
      error instanceof Error ? error.message : "Invalid Supabase project URL.";
  }
}

export const supabaseConfigurationError = configurationError;
export const hasSupabaseConfig = !configurationError;

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
