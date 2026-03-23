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
import { log } from "node:console";

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
      const speakerKeyOverride = `agent:speaker:subagent:${timestamp}`;
      const digesterKeyOverride = `agent:digester:subagent:${timestamp}`;

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
        thread: false,
        mode: "session" as const,
        need_register: false,
        expectsCompletionMessage: true,
      };
      const taskSpeaker = `你需要调研的文章是：${task}，你所处的sessionKey为：${speakerKeyOverride}，与你结对的深度阅读专员的sessionKey为：${digesterKeyOverride}。`
      const taskDigester = `你需要调研的文章是：${task}，你所处的sessionKey为：${digesterKeyOverride}。在调研过程中，可能有专门的对外交流专员（sessionKey：${speakerKeyOverride}）向你询问文章内容，你需要向其讲解清楚。`

      const speaker = await spawnSubagentDirect(
        { ...shared, task: taskSpeaker, agentId: "speaker", label: `speaker@${task}`, childSessionKeyOverride: speakerKeyOverride },
        spawnCtx,
      );
      const digester = await spawnSubagentDirect(
        { ...shared, task: taskDigester, agentId: "digester", label: `digester@${task}`, childSessionKeyOverride: digesterKeyOverride },
        spawnCtx,
      );

      const notes = [speaker.note, digester.note].filter((n): n is string => Boolean(n?.trim()));
      var dedupedNotes = [...new Set(notes)];

      if (speaker.status == "accepted"){
        dedupedNotes.push(`Please send to sessionKey=${speaker.childSessionKey} if you have following questions about this article: (${task}).`);
      }  else {
        log("Speaker:", JSON.stringify(speaker, null, 2));
      }

      return jsonResult({
        // runId: crypto.randomUUID(),
        status: combineSpawnStatus(speaker, digester),
        // speaker,
        // digester,
        ...(dedupedNotes.length > 0 ? { note: dedupedNotes.join("\n\n") } : {}),
      });
    },
  };
}
