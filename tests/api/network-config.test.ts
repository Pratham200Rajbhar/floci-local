import { describe, it, expect } from "vitest";
import { GET, PUT } from "@/app/api/network-config/route";
import { POST as testConnection } from "@/app/api/network-config/test/route";
import { POST as resetConfig } from "@/app/api/network-config/reset/route";

describe("Network Config API Routes", () => {
  it("GET /api/network-config returns valid active configuration and diagnostics", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toHaveProperty("config");
    expect(json).toHaveProperty("diagnostics");
    expect(json).toHaveProperty("isLocked");
    expect(["local", "lan", "tailscale", "custom"]).toContain(json.config.mode);
  });

  it("PUT /api/network-config updates valid config and rejects invalid payload", async () => {
    // Valid update
    const validReq = new Request("http://localhost/api/network-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "lan",
        protocol: "http",
        host: "192.168.1.100",
        apiPort: 4566,
      }),
    });
    const resValid = await PUT(validReq);
    expect(resValid.status).toBe(200);
    const jsonValid = await resValid.json();
    expect(jsonValid.success).toBe(true);
    expect(jsonValid.config.mode).toBe("lan");
    expect(jsonValid.config.host).toBe("192.168.1.100");

    // Invalid update (metadata SSRF)
    const invalidReq = new Request("http://localhost/api/network-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "custom",
        protocol: "http",
        host: "169.254.169.254",
        apiPort: 4566,
      }),
    });
    const resInvalid = await PUT(invalidReq);
    expect(resInvalid.status).toBe(400);
  });

  it("POST /api/network-config/test tests candidate endpoint and blocks SSRF", async () => {
    const ssrfReq = new Request("http://localhost/api/network-config/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        protocol: "http",
        host: "169.254.169.254",
        apiPort: 4566,
      }),
    });
    const ssrfRes = await testConnection(ssrfReq);
    expect(ssrfRes.status).toBe(400);
  });

  it("POST /api/network-config/reset resets config to local mode", async () => {
    const res = await resetConfig();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.config.mode).toBe("local");
    expect(json.config.host).toBe("localhost");
  });
});
