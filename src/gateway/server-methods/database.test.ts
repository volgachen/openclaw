import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.hoisted(() => vi.fn());
const mockPoolInstance = vi.hoisted(() => ({ query: mockQuery }));

vi.mock("pg", () => ({
  Pool: function Pool(this: unknown) {
    return mockPoolInstance;
  },
}));

import { databaseHandlers } from "./database.js";

const invokeArticleSave = async (
  params: Record<string, unknown>,
  respond: ReturnType<typeof vi.fn>,
) => {
  await databaseHandlers["article.save"]({
    req: { method: "article.save", params } as never,
    params,
    respond: respond as never,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
};

describe("database handlers", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe("article.save", () => {
    it("responds with INVALID_REQUEST when sessionKey is missing", async () => {
      const respond = vi.fn();
      await invokeArticleSave({}, respond);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({
          code: "INVALID_REQUEST",
          message: "Missing required parameter: sessionKey",
        }),
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("inserts article and responds with saved row when sessionKey is provided", async () => {
      const row = {
        id: 1,
        source_id: "src-1",
        article_name: "Test",
        url: "https://example.com",
        memory_file: null,
        article_type: "note",
        referred_article_id: null,
        sessionKey: "sk-123",
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockQuery.mockResolvedValue({ rows: [row] });
      const respond = vi.fn();

      await invokeArticleSave(
        {
          sessionKey: "sk-123",
          article_name: "Test",
          url: "https://example.com",
          article_type: "note",
        },
        respond,
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('"sessionKey"'),
        [null, "Test", "https://example.com", null, "note", null, "sk-123"],
      );
      expect(mockQuery.mock.calls[0][0]).toMatch(/INSERT INTO articles/);
      expect(mockQuery.mock.calls[0][0]).toMatch(/RETURNING \*/);
      expect(respond).toHaveBeenCalledWith(true, { article: row }, undefined);
    });

    it("uses default nulls for optional params when omitted", async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 1, sessionKey: "sk" }] });
      const respond = vi.fn();

      await invokeArticleSave({ sessionKey: "sk" }, respond);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [null, null, null, null, null, null, "sk"],
      );
      expect(respond).toHaveBeenCalledWith(
        true,
        { article: { id: 1, sessionKey: "sk" } },
        undefined,
      );
    });

    it("responds with UNAVAILABLE when query throws", async () => {
      mockQuery.mockRejectedValue(new Error("connection refused"));
      const respond = vi.fn();

      await invokeArticleSave({ sessionKey: "sk" }, respond);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({
          code: "UNAVAILABLE",
          message: "Failed to save article: Error: connection refused",
        }),
      );
    });
  });
});
