import { Type } from "@sinclair/typebox";
import { type AnyAgentTool, jsonResult } from "./common.js";
import { callGatewayTool, type GatewayCallOptions } from "./gateway.js";

const SourceCheckSchema = Type.Object({
  id: Type.Optional(Type.Union([Type.String(), Type.Number(), Type.Null()])),
  name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
});

export function createSourceCheckTool(): AnyAgentTool {
  return {
    label: "Source Check",
    name: "source_check",
    description: "Check sources from the database. If id or name is provided, returns the matching row; otherwise returns all rows.",
    parameters: SourceCheckSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const gatewayOpts: GatewayCallOptions = {
        gatewayUrl: typeof params.gatewayUrl === "string" ? params.gatewayUrl : undefined,
        gatewayToken: typeof params.gatewayToken === "string" ? params.gatewayToken : undefined,
        timeoutMs: typeof params.timeoutMs === "number" ? params.timeoutMs : undefined,
      };
      const result = await callGatewayTool("source.check", gatewayOpts, {
        id: params.id ?? null,
        name: params.name ?? null,
      });
      return jsonResult({ ok: true, result });
    },
  };
}

const ArticleSearchSchema = Type.Object({
  id: Type.Optional(Type.Union([Type.String(), Type.Number(), Type.Null()])),
  url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  article_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  sessionKey: Type.Optional(Type.String()),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
});

const ArticleToolSchema = Type.Object({
  sessionKey: Type.Optional(Type.String()),
  source_id: Type.Optional(Type.Union([Type.String(), Type.Number(), Type.Null()])),
  article_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  memory_file: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  article_type: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  referred_article_id: Type.Optional(Type.Union([Type.String(), Type.Number(), Type.Null()])),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
});

export function createArticleSearchTool(opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Article Search",
    name: "article_search",
    description: "Search for article records by id, url, article_name, or sessionKey. Returns matching rows as a list.",
    parameters: ArticleSearchSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const gatewayOpts: GatewayCallOptions = {
        gatewayUrl: typeof params.gatewayUrl === "string" ? params.gatewayUrl : undefined,
        gatewayToken: typeof params.gatewayToken === "string" ? params.gatewayToken : undefined,
        timeoutMs: typeof params.timeoutMs === "number" ? params.timeoutMs : undefined,
      };
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim()
          ? params.sessionKey.trim()
          : opts?.agentSessionKey?.trim();
      const result = await callGatewayTool("article.search", gatewayOpts, {
        id: params.id ?? null,
        url: params.url ?? null,
        article_name: params.article_name ?? null,
        sessionKey: sessionKey ?? null,
      });
      return jsonResult({ ok: true, result });
    },
  };
}

export function createArticleSaveTool(opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Article Save",
    name: "article_save",
    description: "Save an article record to the database.",
    parameters: ArticleToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const gatewayOpts: GatewayCallOptions = {
        gatewayUrl: typeof params.gatewayUrl === "string" ? params.gatewayUrl : undefined,
        gatewayToken: typeof params.gatewayToken === "string" ? params.gatewayToken : undefined,
        timeoutMs: typeof params.timeoutMs === "number" ? params.timeoutMs : undefined,
      };
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim()
          ? params.sessionKey.trim()
          : opts?.agentSessionKey?.trim();
      const result = await callGatewayTool("article.save", gatewayOpts, {
        sessionKey,
        source_id: params.source_id ?? null,
        article_name: params.article_name ?? null,
        url: params.url ?? null,
        memory_file: params.memory_file ?? null,
        article_type: params.article_type ?? null,
        referred_article_id: params.referred_article_id ?? null,
      });
      return jsonResult({ ok: true, result });
    },
  };
}
