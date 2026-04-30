import { describe, it, expect } from "vitest";

// Dynamic import to handle CJS module
const { parseText } = await import("./server.js");

describe("parseText", () => {
  it("should count word frequencies", () => {
    const result = parseText("hello world hello");
    expect(result).toEqual([
      { text: "hello", count: 2 },
      { text: "world", count: 1 },
    ]);
  });

  it("should filter out stop words", () => {
    const result = parseText("the cat and the dog");
    expect(result).toEqual([
      { text: "cat", count: 1 },
      { text: "dog", count: 1 },
    ]);
  });

  it("should be case insensitive", () => {
    const result = parseText("Hello HELLO hello");
    expect(result).toEqual([{ text: "hello", count: 3 }]);
  });

  it("should strip punctuation", () => {
    const result = parseText("hello! world? hello.");
    expect(result).toEqual([
      { text: "hello", count: 2 },
      { text: "world", count: 1 },
    ]);
  });

  it("should ignore single character words", () => {
    const result = parseText("I a b c hello");
    expect(result).toEqual([{ text: "hello", count: 1 }]);
  });

  it("should limit to 50 words", () => {
    // Generate 60 unique words (letters only, since parseText strips digits)
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const words = Array.from({ length: 60 }, (_, i) => {
      const a = alphabet[i % 26];
      const b = alphabet[Math.floor(i / 26) % 26];
      return `word${a}${b}`;
    }).join(" ");
    const result = parseText(words);
    expect(result.length).toBe(50);
  });
});
