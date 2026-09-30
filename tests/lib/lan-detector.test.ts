import { describe, it, expect } from "vitest";
import { getDetectedLanIps, getPrimaryLanIp } from "@/lib/lan-detector";

describe("LAN and Wi-Fi IP Auto-Detector (lib/lan-detector.ts)", () => {
  it("detects local non-loopback, non-Tailscale LAN/Wi-Fi IPv4 addresses", () => {
    const ips = getDetectedLanIps();
    expect(Array.isArray(ips)).toBe(true);

    for (const item of ips) {
      // Must not be loopback
      expect(item.address).not.toBe("127.0.0.1");
      // Must not be Tailscale 100.x.x.x
      expect(item.address.startsWith("100.")).toBe(false);
      // Must have a valid interface name and type
      expect(["wifi", "ethernet", "lan"]).toContain(item.type);
    }
  });

  it("returns a valid IPv4 address from getPrimaryLanIp", () => {
    const primary = getPrimaryLanIp();
    expect(typeof primary).toBe("string");
    expect(primary.split(".").length).toBe(4);
    expect(primary.startsWith("100.")).toBe(false);
  });
});
