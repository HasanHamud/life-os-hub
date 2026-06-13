import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let cachedUserId: string | null | undefined = undefined;

export async function getUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId;
  const { data } = await supabase.auth.getSession();
  cachedUserId = data.session?.user?.id ?? null;
  return cachedUserId;
}

export function clearUserIdCache() {
  cachedUserId = undefined;
}
