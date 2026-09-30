import { z } from "zod";

/**
 * Universal security blocklist checking for SSRF targets and dangerous host schemes.
 */
export function isUnsafeHost(host: string): boolean {
  const trimmed = host.trim().toLowerCase();

  // Cloud metadata services (AWS, GCP, Azure, OpenStack)
  if (
    trimmed === "169.254.169.254" ||
    trimmed === "metadata.google.internal" ||
    trimmed === "instance-data" ||
    trimmed.startsWith("169.254.")
  ) {
    return true;
  }

  // Dangerous scheme injections or URI characters
  if (
    trimmed.includes("://") ||
    trimmed.includes("/") ||
    trimmed.includes("@") ||
    trimmed.includes(" ") ||
    trimmed.includes("\n") ||
    trimmed.includes("\r")
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if an IP or host is a valid LAN identifier (RFC1918 or local mDNS).
 */
export function isValidLanHost(host: string): boolean {
  const trimmed = host.trim().toLowerCase();
  if (isUnsafeHost(trimmed)) return false;

  // 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(trimmed)) return true;

  // 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) return true;

  // 172.16.0.0/12
  const match172 = trimmed.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const octet2 = parseInt(match172[1], 10);
    if (octet2 >= 16 && octet2 <= 31) return true;
  }

  // Local mDNS / dev hostnames (e.g. jarvis.local, dev.lan)
  if (trimmed.endsWith(".local") || trimmed.endsWith(".lan") || /^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Checks if a host is a valid Tailscale IP (100.64.0.0/10) or MagicDNS domain.
 */
export function isValidTailscaleHost(host: string): boolean {
  const trimmed = host.trim().toLowerCase();
  if (isUnsafeHost(trimmed)) return false;

  // Tailscale MagicDNS (*.ts.net)
  if (trimmed.endsWith(".ts.net") || trimmed.includes(".ts.net")) {
    return true;
  }

  // Tailscale CGNAT IP (100.64.0.0/10: 100.64.x.x - 100.127.x.x, or broader 100.x.x.x)
  if (/^100\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
    return true;
  }

  return false;
}

export const networkConfigSchema = z
  .object({
    mode: z.enum(["local", "lan", "tailscale", "custom"] as const),
    protocol: z.enum(["http", "https"]).default("http"),
    host: z.string().min(1, "Hostname or IP address is required").max(255),
    apiPort: z.coerce.number().int().min(1, "Port must be at least 1").max(65535, "Port must be at most 65535").default(4566),
  })
  .superRefine((data, ctx) => {
    const host = data.host.trim().toLowerCase();

    // Universal SSRF check
    if (isUnsafeHost(host)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["host"],
        message: "Host contains an unsafe target, cloud metadata IP, or invalid URI characters.",
      });
      return;
    }

    if (data.mode === "local") {
      if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["host"],
          message: "Local mode must use 'localhost' or '127.0.0.1'.",
        });
      }
    } else if (data.mode === "lan") {
      if (!isValidLanHost(host)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["host"],
          message: "LAN mode requires a valid LAN IP (192.168.*, 10.*, 172.16-31.*) or local hostname (.local, .lan).",
        });
      }
    } else if (data.mode === "tailscale") {
      if (!isValidTailscaleHost(host)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["host"],
          message: "Tailscale mode requires a valid Tailscale IP (100.x.x.x) or MagicDNS domain (*.ts.net).",
        });
      }
    } else if (data.mode === "custom") {
      // Basic hostname or IP validation
      const validHostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      const validIpRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!validHostnameRegex.test(host) && !validIpRegex.test(host)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["host"],
          message: "Custom mode requires a valid hostname or IP address.",
        });
      }
    }
  });

export type NetworkConfigInput = z.infer<typeof networkConfigSchema>;

export const testConnectionSchema = z.object({
  protocol: z.enum(["http", "https"]).default("http"),
  host: z.string().min(1, "Host is required"),
  apiPort: z.coerce.number().int().min(1).max(65535).default(4566),
}).superRefine((data, ctx) => {
  if (isUnsafeHost(data.host)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["host"],
      message: "Unsafe target or metadata IP blocked.",
    });
  }
});
