import crypto from "node:crypto";
import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import type { SpawnedToolContext } from "../spawned-context.js";
import { spawnSubagentDirect, type SpawnSubagentResult } from "../subagent-spawn.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import { resolveInternalSessionKey, resolveMainSessionAlias } from "./sessions-helpers.js";

const AssignResearchTaskToolSchema = Type.Object({
  task: Type.String(),
});

function combineSpawnStatus(a: SpawnSubagentResult, b: SpawnSubagentResult): "accepted" | "partial" | "error" {
  const aOk = a.status === "accepted";
  const bOk = b.status === "accepted";
  if (aOk && bOk) {
    return "accepted";
  }
  if (aOk || bOk) {
    return "partial";
  }
  return "error";
}

/**
 * Fixed subagent roles for parallel research: same task text, persistent session mode,
 * no thread binding, no registry announce (need_register=false).
 */
export function createAssignResearchTaskTool(
  opts?: {
    agentSessionKey?: string;
    agentChannel?: GatewayMessageChannel;
    agentAccountId?: string;
    agentTo?: string;
    agentThreadId?: string | number;
    sandboxed?: boolean;
    requesterAgentIdOverride?: string;
  } & SpawnedToolContext,
): AnyAgentTool {
  return {
    label: "Research",
    name: "assign_research_task",
    description:
      "Start two subagent sessions (labels speaker and digester) with the same research task. Session keys are agent:<id>:subagent:speaker:<timestamp> and agent:<id>:subagent:digester:<timestamp> (same millisecond). Each runs as mode=session, thread=false, need_register=false (no auto-announce registration).",
    parameters: AssignResearchTaskToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const task = readStringParam(params, "task", { required: true });

      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const requesterSessionKey = opts?.agentSessionKey;
      const requesterInternalKey = requesterSessionKey
        ? resolveInternalSessionKey({
            key: requesterSessionKey,
            alias,
            mainKey,
          })
        : alias;
      const targetAgentId = normalizeAgentId(
        opts?.requesterAgentIdOverride ?? parseAgentSessionKey(requesterInternalKey)?.agentId,
      );
      const timestamp = Date.now();
      const speakerKeyOverride = `agent:${targetAgentId}:subagent:speaker:${timestamp}`;
      const digesterKeyOverride = `agent:${targetAgentId}:subagent:digester:${timestamp}`;

      const spawnCtx = {
        agentSessionKey: opts?.agentSessionKey,
        agentChannel: opts?.agentChannel,
        agentAccountId: opts?.agentAccountId,
        agentTo: opts?.agentTo,
        agentThreadId: opts?.agentThreadId,
        agentGroupId: opts?.agentGroupId,
        agentGroupChannel: opts?.agentGroupChannel,
        agentGroupSpace: opts?.agentGroupSpace,
        requesterAgentIdOverride: opts?.requesterAgentIdOverride,
        workspaceDir: opts?.workspaceDir,
      };

      const shared = {
        task,
        thread: false,
        mode: "session" as const,
        need_register: false,
        expectsCompletionMessage: true,
      };

      const speaker = await spawnSubagentDirect(
        { ...shared, label: "speaker", childSessionKeyOverride: speakerKeyOverride },
        spawnCtx,
      );
      const digester = await spawnSubagentDirect(
        { ...shared, label: "digester", childSessionKeyOverride: digesterKeyOverride },
        spawnCtx,
      );

      const notes = [speaker.note, digester.note].filter((n): n is string => Boolean(n?.trim()));
      const dedupedNotes = [...new Set(notes)];

      return jsonResult({
        runId: crypto.randomUUID(),
        status: combineSpawnStatus(speaker, digester),
        speaker,
        digester,
        ...(dedupedNotes.length > 0 ? { note: dedupedNotes.join("\n\n") } : {}),
      });
    },
  };
}
