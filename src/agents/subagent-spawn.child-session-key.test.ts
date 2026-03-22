import { describe, expect, it } from "vitest";
import { resolveSubagentChildSessionKeyForSpawn } from "./subagent-child-session-key.js";

describe("resolveSubagentChildSessionKeyForSpawn", () => {
  it("generates agent:target:subagent:uuid when override is absent", () => {
    const r = resolveSubagentChildSessionKeyForSpawn({ targetAgentId: "main" });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.key).toMatch(/^agent:main:subagent:[0-9a-f-]{36}$/);
  });

  it("accepts a valid canonical override for the target agent", () => {
    const r = resolveSubagentChildSessionKeyForSpawn({
      targetAgentId: "main",
      override: "agent:main:subagent:my-research-slot",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.key).toBe("agent:main:subagent:my-research-slot");
  });

  it("normalizes casing via parseAgentSessionKey", () => {
    const r = resolveSubagentChildSessionKeyForSpawn({
      targetAgentId: "main",
      override: "Agent:Main:Subagent:Fixed",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.key).toBe("agent:main:subagent:fixed");
  });

  it("allows nested subagent rest", () => {
    const r = resolveSubagentChildSessionKeyForSpawn({
      targetAgentId: "main",
      override: "agent:main:subagent:orch:subagent:leaf",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.key).toBe("agent:main:subagent:orch:subagent:leaf");
  });

  it("rejects wrong agent id", () => {
    const r = resolveSubagentChildSessionKeyForSpawn({
      targetAgentId: "main",
      override: "agent:other:subagent:x",
    });
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.error).toContain("must match subagent target");
  });

  it("rejects non-subagent rest", () => {
    const r = resolveSubagentChildSessionKeyForSpawn({
      targetAgentId: "main",
      override: "agent:main:main",
    });
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.error).toContain("subagent bucket");
  });

  it("rejects empty subagent suffix", () => {
    const r = resolveSubagentChildSessionKeyForSpawn({
      targetAgentId: "main",
      override: "agent:main:subagent:",
    });
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.error).toContain("non-empty id");
  });

  it("rejects malformed keys", () => {
    const r = resolveSubagentChildSessionKeyForSpawn({
      targetAgentId: "main",
      override: "not-a-key",
    });
    expect(r.ok).toBe(false);
  });
});
