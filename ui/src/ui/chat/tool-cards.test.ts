import { describe, expect, it } from "vitest";
import { formatToolArgsForDisplay } from "./tool-cards.ts";

describe("formatToolArgsForDisplay", () => {
  it("returns null for undefined/null", () => {
    expect(formatToolArgsForDisplay(undefined)).toBeNull();
    expect(formatToolArgsForDisplay(null)).toBeNull();
  });

  it("returns trimmed string for non-empty strings", () => {
    expect(formatToolArgsForDisplay("  x  ")).toBe("x");
    expect(formatToolArgsForDisplay("")).toBeNull();
    expect(formatToolArgsForDisplay("   ")).toBeNull();
  });

  it("pretty-prints objects as JSON", () => {
    expect(formatToolArgsForDisplay({ a: 1, b: "c" })).toBe(
      ["{", '  "a": 1,', '  "b": "c"', "}"].join("\n"),
    );
    expect(formatToolArgsForDisplay({})).toBe("{}");
  });
});
