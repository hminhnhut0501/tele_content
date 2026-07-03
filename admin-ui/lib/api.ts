export type AppStatus = {
  ok?: boolean;
  service?: string;
  db_mode?: string;
  db_path?: string;
  database_url_set?: boolean;
  string_session?: boolean;
  tg_api_id_set?: boolean;
  tg_api_hash_set?: boolean;
  render_external_url?: string;
  schema_bootstrap_id?: string;
  schema_bootstrap_applied?: boolean;
  storage?: { groups?: number; topics?: number; items?: number; events?: number };
  error?: string;
};

export type GroupRow = {
  id: number;
  name: string;
  source_key: string;
  source_link?: string;
  target_link?: string;
  auto_enabled?: number;
  auto_slots?: string;
  auto_pick_count?: number;
  auto_strategy?: string;
  auto_next_run_in_sec?: number;
  auto_last_result?: string;
  auto_attention?: string;
  topic_count?: number;
  item_count?: number;
  auto_slots_count?: number;
};
export type TopicRow = {
  id: number;
  name: string;
  source_topic_id?: number;
  target_topic_id?: number;
  target_link_seed?: string;
  last_msg_id?: number;
  item_count?: number;
  total_items?: number;
  done_items?: number;
  remaining_items?: number;
  queued_count?: number;
  is_running_topic?: boolean;
  error_count?: number;
};
export type ItemRow = {
  id: number;
  title?: string;
  status?: string;
  source_start_link?: string;
  source_end_link?: string;
  follow_latest?: number | boolean;
  target_link?: string;
  group_mode?: string;
  order_mode?: string;
  batch_size?: number;
  delay_min?: number;
  delay_max?: number;
  last_msg_id?: number;
  sent_count?: number;
  sent_units_count?: number;
  queue_position?: number;
  next_run_in_sec?: number;
};
export type QueueState = { queue_size?: number; active_workers?: number; max_concurrency?: number; items?: { item_id: number; position: number; wait_sec: number }[] };
export type ProgressState = { total_topics?: number; total_items?: number; running_items?: number; queued_items?: number; done_items?: number; error_items?: number; completed_ratio?: number };
export type LogRow = { id: number; created_at?: number; code?: string; message?: string; level?: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }
  return data as T;
}

export function buildTopicTargetLink(baseLink: string, topicId: number) {
  const base = String(baseLink || "").trim();
  if (topicId <= 0 || !base) return base;
  if (/^-?\d+$/.test(base)) {
    const cid = base.replace("-100", "");
    return `https://t.me/c/${cid}/${topicId}/1`;
  }
  const norm = base.replace(/^https?:\/\//i, "");
  const match = norm.match(/^t\.me\/c\/(\d+)(?:\/(\d+))?(?:\/(\d+))?$/i);
  if (!match) return base;
  const cid = match[1];
  const msg = match[3] || match[2] || "1";
  return `https://t.me/c/${cid}/${topicId}/${msg}`;
}
