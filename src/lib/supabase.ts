/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

// Helper to validate if a string is a valid HTTP/HTTPS URL
function isValidHttpUrl(str: string): boolean {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";

// Verify both exist, aren't placeholders, and the URL is structurally valid
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== "YOUR_SUPABASE_URL" &&
  supabaseUrl !== "placeholder" &&
  isValidHttpUrl(supabaseUrl)
);

let supabaseInstance = null;

if (isSupabaseConfigured) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error("Failed to initialize Supabase client safely:", err);
  }
}

export const supabase = supabaseInstance;

if (!isSupabaseConfigured) {
  console.log(
    "Supabase Client SDK not fully configured or URL is invalid. Direct client-side realtime subscriptions are disabled; falling back to REST/polling mechanism."
  );
}
