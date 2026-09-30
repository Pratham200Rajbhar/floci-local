import os from "os";
import type { DetectedDeviceIp } from "./network-config/types";

/**
 * Detects available non-virtual local LAN, Wi-Fi, and Tailscale IPv4 network interfaces.
 * Excludes loopback, Docker bridges, and virtual ethernet pairs.
 */
export function getDetectedDeviceIps(): DetectedDeviceIp[] {
  const interfaces = os.networkInterfaces();
  const detected: DetectedDeviceIp[] = [];

  const ignoredInterfacePattern = /^(lo|docker\d*|br-.*|veth.*|virbr.*|tun\d*|tap\d*|wg\d*)$/i;

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs || ignoredInterfacePattern.test(name)) {
      continue;
    }

    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        let type: DetectedDeviceIp["type"] = "lan";
        if (name.startsWith("tailscale") || addr.address.startsWith("100.")) {
          type = "tailscale";
        } else if (/^(wl|wifi|wlan)/i.test(name)) {
          type = "wifi";
        } else if (/^(en|eth)/i.test(name)) {
          type = "ethernet";
        }

        detected.push({
          interface: name,
          address: addr.address,
          type,
        });
      }
    }
  }

  return detected;
}

/**
 * Returns detected LAN & Wi-Fi IPv4 interfaces (excluding Tailscale).
 */
export function getDetectedLanIps(): DetectedDeviceIp[] {
  const all = getDetectedDeviceIps();
  return all
    .filter((item) => item.type !== "tailscale")
    .sort((a, b) => {
      const priority = { wifi: 1, ethernet: 2, lan: 3, tailscale: 4 };
      return priority[a.type] - priority[b.type];
    });
}

/**
 * Returns primary detected LAN/Wi-Fi IPv4 address or safe default fallback.
 */
export function getPrimaryLanIp(): string {
  const ips = getDetectedLanIps();
  return ips[0]?.address || "192.168.1.50";
}

/**
 * Returns detected Tailscale IPv4 address if Tailscale is active on the machine.
 */
export function getDetectedTailscaleIp(): string | undefined {
  const all = getDetectedDeviceIps();
  const tailscale = all.find((item) => item.type === "tailscale");
  return tailscale?.address;
}

