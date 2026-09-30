import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Button } from "@/components/ui/button";

describe("Button component", () => {
  it("renders with label and applies button attributes", () => {
    const html = renderToString(<Button type="submit">Click Me</Button>);
    expect(html).toContain("Click Me");
    expect(html).toContain('type="submit"');
  });

  it("is disabled when isLoading is true", () => {
    const html = renderToString(<Button isLoading>Submitting</Button>);
    expect(html).toContain("disabled");
    expect(html).toContain("Submitting");
  });
});
