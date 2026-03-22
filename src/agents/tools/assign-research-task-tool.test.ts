import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  spawnSubagentDirectMock: vi.fn(),
}));

vi.mock("../subagent-spawn.js", () => ({
  spawnSubagentDirect: (...args: unknown[]) => hoisted.spawnSubagentDirectMock(...args),
}));

const { createAssignResearchTaskTool } = await import("./assign-research-task-tool.js");

describe("assign_research_task tool", () => {
  beforeEach(() => {
    hoisted.spawnSubagentDirectMock
      .mockReset()
      .mockResolvedValueOnce({
        status: "accepted",
        childSessionKey: "agent:main:subagent:speaker",
        runId: "run-speaker",
      })
      .mockResolvedValueOnce({
        status: "accepted",
        childSessionKey: "agent:main:subagent:digester",
        runId: "run-digester",
      });
  });

  it("spawns speaker then digester with fixed flags and shared task", async () => {
    const tool = createAssignResearchTaskTool({
      agentSessionKey: "agent:main:main",
      agentChannel: "discord",
      workspaceDir: "/ws",
    });

    const result = await tool.execute("call-1", { task: "Research quantum widgets" });

    expect(hoisted.spawnSubagentDirectMock).toHaveBeenCalledTimes(2);

    expect(hoisted.spawnSubagentDirectMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        task: "Research quantum widgets",
        label: "speaker",
        thread: false,
        mode: "session",
        need_register: false,
        childSessionKeyOverride: expect.stringMatching(/^agent:main:subagent:speaker:\d+$/),
      }),
      expect.objectContaining({
        agentSessionKey: "agent:main:main",
        workspaceDir: "/ws",
      }),
    );
    expect(hoisted.spawnSubagentDirectMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        task: "Research quantum widgets",
        label: "digester",
        thread: false,
        mode: "session",
        need_register: false,
        childSessionKeyOverride: expect.stringMatching(/^agent:main:subagent:digester:\d+$/),
      }),
      expect.any(Object),
    );

    const first = hoisted.spawnSubagentDirectMock.mock.calls[0]?.[0] as {
      childSessionKeyOverride?: string;
    };
    const second = hoisted.spawnSubagentDirectMock.mock.calls[1]?.[0] as {
      childSessionKeyOverride?: string;
    };
    const tsSpeaker = first?.childSessionKeyOverride?.match(/:speaker:(\d+)$/)?.[1];
    const tsDigester = second?.childSessionKeyOverride?.match(/:digester:(\d+)$/)?.[1];
    expect(tsSpeaker).toBeDefined();
    expect(tsSpeaker).toBe(tsDigester);

    expect(result.details).toMatchObject({
      status: "accepted",
      speaker: { status: "accepted", runId: "run-speaker" },
      digester: { status: "accepted", runId: "run-digester" },
    });
  });

  it("returns partial when digester fails", async () => {
    hoisted.spawnSubagentDirectMock
      .mockReset()
      .mockResolvedValueOnce({ status: "accepted", childSessionKey: "k1", runId: "r1" })
      .mockResolvedValueOnce({ status: "error", error: "failed" });

    const tool = createAssignResearchTaskTool({ agentSessionKey: "agent:main:main" });
    const result = await tool.execute("c2", { task: "t" });

    expect(result.details).toMatchObject({
      status: "partial",
      speaker: { status: "accepted" },
      digester: { status: "error", error: "failed" },
    });
  });
});
