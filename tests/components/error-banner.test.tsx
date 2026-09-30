import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { ErrorBanner } from "@/components/ui/error-banner";

describe("ErrorBanner component", () => {
  it("renders error code and message correctly", () => {
    const error = {
      error: {
        code: "NoSuchBucket",
        message: "The specified bucket does not exist.",
      },
    };

    const html = renderToString(<ErrorBanner error={error} />);
    expect(html).toContain("NoSuchBucket");
    expect(html).toContain("The specified bucket does not exist.");
  });

  it("renders retry button when onRetry is passed", () => {
    const html = renderToString(<ErrorBanner error="Network connection failed" onRetry={() => {}} />);
    expect(html).toContain("Retry");
  });
});
