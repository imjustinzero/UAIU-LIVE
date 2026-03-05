import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

const isPlaceholder = !url || !key || url.includes('YOUR_PROJECT') || key.includes('YOUR_ANON');

let _client: SupabaseClient | null = null;

if (!isPlaceholder) {
  try {
    _client = createClient(url!, key!);
  } catch {
    _client = null;
  }
}

export function isDemoMode(): boolean {
  return _client === null;
}

export async function dbInsert(
  table: string,
  data: Record<string, unknown>
): Promise<{ data: unknown; error: string | null }> {
  if (!_client) return { data: null, error: 'demo_mode' };
  try {
    const { data: result, error } = await _client.from(table).insert(data).select();
    if (error) console.warn(`[supabase] insert ${table}:`, error.message);
    return { data: result, error: error ? error.message : null };
  } catch (e: unknown) {
    return { data: null, error: (e as Error).message };
  }
}

export async function dbSelect(
  table: string,
  filters: Record<string, unknown> = {}
): Promise<{ data: unknown[]; error: string | null }> {
  if (!_client) return { data: [], error: 'demo_mode' };
  try {
    let q = _client.from(table).select('*');
    for (const [k, v] of Object.entries(filters)) {
      q = q.eq(k, v);
    }
    const { data, error } = await q.order('created_at', { ascending: false }).limit(50);
    if (error) console.warn(`[supabase] select ${table}:`, error.message);
    return { data: data ?? [], error: error ? error.message : null };
  } catch (e: unknown) {
    return { data: [], error: (e as Error).message };
  }
}
