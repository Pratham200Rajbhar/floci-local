import { describe, it, expect } from "vitest";
import {
  buildRdsConnectionDetails,
  buildEc2SshDetails,
  buildElastiCacheDetails,
  getTailscaleAwsCliSnippet,
  getPublicServiceEndpoint,
  isPortInRange,
} from "@/lib/floci-endpoints";
import { getValidatedConfig } from "@/lib/aws/config";

describe("Backward-compatible Endpoint Utility (lib/floci-endpoints.ts)", () => {
  it("converts raw Docker RDS endpoint to active host", () => {
    const details = buildRdsConnectionDetails("10.0.4.2:7001", 7001, "postgres", "postgres", "postgres");
    expect(details.port).toBe(7001);
    expect(details.isPortValid).toBe(true);
    expect(details.psqlCliCommand).not.toContain("10.0.4.2");
  });

  it("generates EC2 SSH command and flags out-of-range ports", () => {
    const validSsh = buildEc2SshDetails(2200, "root", "10.0.4.5");
    expect(validSsh.isPortValid).toBe(true);
    expect(validSsh.internalContainerAddress).toBe("10.0.4.5");

    const invalidSsh = buildEc2SshDetails(9999, "root");
    expect(invalidSsh.isPortValid).toBe(false);
  });

  it("generates ElastiCache Redis CLI commands", () => {
    const redis = buildElastiCacheDetails(6379);
    expect(redis.isPortValid).toBe(true);
    expect(redis.redisCliCommand).toContain("6379 PING");
  });

  it("generates AWS CLI environment export snippet", () => {
    const snippet = getTailscaleAwsCliSnippet();
    expect(snippet).toContain("export AWS_ENDPOINT_URL=");
    expect(snippet).toContain("export AWS_DEFAULT_REGION=");
  });

  it("validates port ranges correctly", () => {
    expect(isPortInRange(7001, 7001, 7099)).toBe(true);
    expect(isPortInRange(7050, 7001, 7099)).toBe(true);
    expect(isPortInRange(7000, 7001, 7099)).toBe(false);
    expect(isPortInRange(7100, 7001, 7099)).toBe(false);
  });
});

describe("Environment Validation (lib/aws/config.ts)", () => {
  it("accepts valid hostnames and modes", () => {
    const config = getValidatedConfig({ FLOCI_PUBLIC_HOST: "100.101.187.9" });
    expect(config.FLOCI_PUBLIC_HOST).toBe("100.101.187.9");
  });

  it("rejects cloud metadata IPs as unsafe", () => {
    expect(() => getValidatedConfig({ FLOCI_PUBLIC_HOST: "169.254.169.254" })).toThrow();
  });
});
