import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Badge } from "@/components/ui/badge";

describe("Badge component", () => {
  it("renders with text and applies variant class", () => {
    const html = renderToString(<Badge variant="success">Active</Badge>);
    expect(html).toContain("Active");
    expect(html).toContain("bg-emerald-50");
  });
});
