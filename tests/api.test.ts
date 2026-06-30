import { describe, expect, it } from "vitest";
import { parseRepo } from "../src/api.js";

describe("parseRepo", () => {
  it("parses owner/name", () => {
    expect(parseRepo("T50-Systems/pi-thread-goal")).toEqual({ owner: "T50-Systems", name: "pi-thread-goal" });
  });

  it("throws on invalid repo", () => {
    expect(() => parseRepo("pi-thread-goal")).toThrow(/Invalid repo reference/);
  });
});
