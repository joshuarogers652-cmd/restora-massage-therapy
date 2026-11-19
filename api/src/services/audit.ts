import type { PoolClient } from "pg";
import { q } from "../database/db";

/** Append-only audit trail. Metadata must never contain health details. */
export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>,
  client?: PoolClient,
) {
  await q(
    "INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)",
    [actorId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null],
    client,
  );
}
