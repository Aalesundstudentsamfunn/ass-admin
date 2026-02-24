export type AuditTargetItem = {
  id: string;
  name: string | null;
  email: string | null;
  status: "ok" | "skipped" | "error";
  reason: string | null;
  change: string | null;
};

/**
 * Canonical audit row shape consumed by audit table + details UI.
 *
 * This type sits in `lib/` to avoid coupling server data mapping to
 * presentation-layer modules.
 */
export type AuditLogRow = {
  id: string;
  created_at: string | null;
  action_key: string | null;
  event: string;
  target: string | null;
  target_name: string | null;
  target_uuid: string | null;
  target_email: string | null;
  target_items: AuditTargetItem[];
  change: string | null;
  change_items: string[];
  actor_label: string;
  actor_id: string | null;
  actor_email: string | null;
  ip_address: string | null;
  status: "ok" | "error" | "partial" | "unknown";
  error_message: string | null;
  source: string;
  raw: Record<string, unknown>;
};
