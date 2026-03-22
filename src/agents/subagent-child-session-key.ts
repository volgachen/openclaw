import crypto from "node:crypto";
import { normalizeAgentId, parseAgentSessionKey } from "../routing/session-key.js";

const MAX_SUBAGENT_CHILD_SESSION_KEY_CHARS = 512;
const SUBAGENT_SESSION_REST_PREFIX = "subagent:";

/**
 * Resolve the child session key for a subagent spawn: optional override or default UUID suffix.
 */
export function resolveSubagentChildSessionKeyForSpawn(params: {
  targetAgentId: string;
  override?: string | null | undefined;
}): { ok: true; key: string } | { ok: false; error: string } {
  const target = normalizeAgentId(params.targetAgentId);
  const raw = params.override?.trim();
  if (!raw) {
    return { ok: true, key: `agent:${target}:subagent:${crypto.randomUUID()}` };
  }
  if (raw.length > MAX_SUBAGENT_CHILD_SESSION_KEY_CHARS) {
    return {
      ok: false,
      error: `childSessionKeyOverride exceeds max length (${MAX_SUBAGENT_CHILD_SESSION_KEY_CHARS})`,
    };
  }
  // eslint-disable-next-line no-control-regex
  if (/[\r\n\u0000-\u001F\u007F]/.test(raw)) {
    return { ok: false, error: "childSessionKeyOverride contains invalid control characters" };
  }
  const parsed = parseAgentSessionKey(raw);
  if (!parsed) {
    return {
      ok: false,
      error:
        'childSessionKeyOverride must be a canonical agent key: agent:<agentId>:subagent:<id> (extra :subagent: segments are allowed for nested keys)',
    };
  }
  if (normalizeAgentId(parsed.agentId) !== target) {
    return {
      ok: false,
      error: `childSessionKeyOverride agent id must match subagent target "${target}"`,
    };
  }
  const restLower = parsed.rest.toLowerCase();
  if (!restLower.startsWith(SUBAGENT_SESSION_REST_PREFIX)) {
    return {
      ok: false,
      error:
        'childSessionKeyOverride must use a subagent bucket (segment after agent id must start with "subagent:")',
    };
  }
  if (parsed.rest.length <= SUBAGENT_SESSION_REST_PREFIX.length) {
    return {
      ok: false,
      error: "childSessionKeyOverride must include a non-empty id after subagent:",
    };
  }
  return { ok: true, key: `agent:${target}:${parsed.rest}` };
}
