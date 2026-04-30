import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the title", () => {
    render(<App />);
    expect(screen.getByText(/Word Cloud Generator/)).toBeDefined();
  });

  it("renders a textarea with sample text", () => {
    render(<App />);
    const textarea = screen.getByRole("textbox");
    expect(textarea.value).toContain("DevOps");
  });

  it("renders the generate button", () => {
    render(<App />);
    expect(screen.getByText("Generate Word Cloud")).toBeDefined();
  });

  it("shows word cloud after successful API call", async () => {
    const mockWords = [
      { text: "devops", count: 3 },
      { text: "continuous", count: 2 },
    ];

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ words: mockWords }),
    });

    render(<App />);
    fireEvent.click(screen.getByText("Generate Word Cloud"));

    await waitFor(() => {
      expect(screen.getByText("devops")).toBeDefined();
      expect(screen.getByText("continuous")).toBeDefined();
    });
  });

  it("shows error on API failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<App />);
    fireEvent.click(screen.getByText("Generate Word Cloud"));

    await waitFor(() => {
      expect(screen.getByText("Server error: 500")).toBeDefined();
    });
  });
});
