/**
 * Supabase 服务端客户端（service_role，只在 API 路由使用）。
 * 与盘搜同款模式：客户端永不直连数据库。
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getDb(): SupabaseClient {
  if (!cached) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}
