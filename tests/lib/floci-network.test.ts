import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  buildFlociApiEndpoint,
  buildS3Endpoint,
  buildRdsConnectionDetails,
  buildEc2SshDetails,
  buildElastiCacheDetails,
  getAwsCliSnippet,
  isPortInRange,
  PORT_RANGES,
} from "@/lib/floci-network";
import {
  networkConfigSchema,
  isUnsafeHost,
  isValidLanHost,
  isValidTailscaleHost,
} from "@/lib/network-config/validation";
import { JsonFileConfigRepository } from "@/lib/network-config/repository";
import type { FlociNetworkConfig } from "@/lib/network-config/types";

describe("Configurable Network Access Engine (lib/floci-network.ts)", () => {
  it("Scenario 1: Fresh install defaults to Local mode and produces localhost commands", () => {
    const localConfig: FlociNetworkConfig = {
      mode: "local",
      protocol: "http",
      host: "localhost",
      apiPort: 4566,
      updatedAt: new Date().toISOString(),
    };

    expect(buildFlociApiEndpoint(localConfig)).toBe("http://localhost:4566");
    expect(buildS3Endpoint(localConfig)).toBe("http://localhost:4566");

    const rds = buildRdsConnectionDetails("10.0.4.2:7001", 7001, "postgres", "postgres", "postgres", undefined, localConfig);
    expect(rds.endpoint).toBe("localhost:7001");
    expect(rds.psqlCliCommand).toContain("host=localhost");
    expect(rds.psqlCliCommand).not.toContain("10.0.4.2");

    const ec2 = buildEc2SshDetails(2200, "root", "10.0.4.5", undefined, localConfig);
    expect(ec2.sshCommand).toBe("ssh -p 2200 root@localhost");

    const redis = buildElastiCacheDetails(6379, undefined, localConfig);
    expect(redis.redisCliCommand).toBe("redis-cli -h localhost -p 6379 PING");

    const cliSnippet = getAwsCliSnippet(localConfig);
    expect(cliSnippet).toContain("export AWS_ENDPOINT_URL=http://localhost:4566");
  });

  it("Scenario 2: Switching to LAN mode changes all copied commands to LAN IP/hostname", () => {
    const lanConfig: FlociNetworkConfig = {
      mode: "lan",
      protocol: "http",
      host: "192.168.1.120",
      apiPort: 4566,
      updatedAt: new Date().toISOString(),
    };

    expect(buildFlociApiEndpoint(lanConfig)).toBe("http://192.168.1.120:4566");

    const rds = buildRdsConnectionDetails("172.18.0.4:7001", 7001, "postgres", "postgres", "postgres", undefined, lanConfig);
    expect(rds.endpoint).toBe("192.168.1.120:7001");
    expect(rds.psqlCliCommand).toContain("host=192.168.1.120");
    expect(rds.pgPasswordCommand).toContain("-h 192.168.1.120");

    const ec2 = buildEc2SshDetails(2201, "ubuntu", "172.18.0.5", undefined, lanConfig);
    expect(ec2.sshCommand).toBe("ssh -p 2201 ubuntu@192.168.1.120");

    const redis = buildElastiCacheDetails(6380, undefined, lanConfig);
    expect(redis.redisCliCommand).toBe("redis-cli -h 192.168.1.120 -p 6380 PING");
  });

  it("Scenario 3: Switching to Tailscale mode changes all copied commands to 100.x.x.x or MagicDNS", () => {
    const tailscaleConfig: FlociNetworkConfig = {
      mode: "tailscale",
      protocol: "http",
      host: "100.101.187.9",
      apiPort: 4566,
      updatedAt: new Date().toISOString(),
    };

    expect(buildFlociApiEndpoint(tailscaleConfig)).toBe("http://100.101.187.9:4566");

    const rds = buildRdsConnectionDetails("10.0.4.2:7001", 7001, "postgres", "postgres", "postgres", undefined, tailscaleConfig);
    expect(rds.endpoint).toBe("100.101.187.9:7001");
    expect(rds.psqlCliCommand).toContain("host=100.101.187.9");

    const magicDnsConfig: FlociNetworkConfig = {
      mode: "tailscale",
      protocol: "http",
      host: "jarvis.my-tailnet.ts.net",
      apiPort: 4566,
      updatedAt: new Date().toISOString(),
    };
    const rdsMagic = buildRdsConnectionDetails("10.0.4.2:7001", 7001, "postgres", "postgres", "postgres", undefined, magicDnsConfig);
    expect(rdsMagic.endpoint).toBe("jarvis.my-tailnet.ts.net:7001");
    expect(rdsMagic.psqlCliCommand).toContain("host=jarvis.my-tailnet.ts.net");
  });

  it("Scenario 4: Switching to Custom mode supports HTTPS and a custom port", () => {
    const customConfig: FlociNetworkConfig = {
      mode: "custom",
      protocol: "https",
      host: "floci.dev.internal",
      apiPort: 8443,
      updatedAt: new Date().toISOString(),
    };

    expect(buildFlociApiEndpoint(customConfig)).toBe("https://floci.dev.internal:8443");

    const cli = getAwsCliSnippet(customConfig);
    expect(cli).toContain("export AWS_ENDPOINT_URL=https://floci.dev.internal:8443");
  });

  it("Scenario 5 & 6: Floci RDS response with 10.0.4.2:7001 displays external host with port 7001, never leaking internal IP", () => {
    const config: FlociNetworkConfig = {
      mode: "lan",
      protocol: "http",
      host: "192.168.1.50",
      apiPort: 4566,
      updatedAt: new Date().toISOString(),
    };

    const details = buildRdsConnectionDetails("10.0.4.2:7001", 7001, "postgres", "postgres", "postgres", undefined, config);
    expect(details.endpoint).toBe("192.168.1.50:7001");
    expect(details.psqlCliCommand).not.toContain("10.0.4.2");
    expect(details.psqlCliCommand).not.toContain("floci");
    expect(details.psqlUri).toContain("postgresql://postgres:postgres@192.168.1.50:7001/postgres");

    const customPassDetails = buildRdsConnectionDetails("10.0.4.2:7001", 7001, "postgres", "postgres", "postgres", undefined, config, "mySecretPass123");
    expect(customPassDetails.psqlUri).toContain("postgresql://postgres:mySecretPass123@192.168.1.50:7001/postgres");
    expect(customPassDetails.pgPasswordCommand).toContain("PGPASSWORD='mySecretPass123'");
    expect(customPassDetails.mysqlCliCommand).toContain("-p'mySecretPass123'");
  });

  it("Scenario 7: Invalid hostnames, invalid ports, and SSRF targets are strictly rejected", () => {
    // Cloud metadata IP
    expect(isUnsafeHost("169.254.169.254")).toBe(true);
    expect(isUnsafeHost("metadata.google.internal")).toBe(true);
    expect(isUnsafeHost("http://evil.com")).toBe(true);

    const parseMetadata = networkConfigSchema.safeParse({
      mode: "custom",
      protocol: "http",
      host: "169.254.169.254",
      apiPort: 4566,
    });
    expect(parseMetadata.success).toBe(false);

    // Invalid port
    const parseInvalidPort = networkConfigSchema.safeParse({
      mode: "local",
      protocol: "http",
      host: "localhost",
      apiPort: 99999,
    });
    expect(parseInvalidPort.success).toBe(false);

    // Local mode rejecting external IP
    const parseLocalWrong = networkConfigSchema.safeParse({
      mode: "local",
      protocol: "http",
      host: "192.168.1.1",
      apiPort: 4566,
    });
    expect(parseLocalWrong.success).toBe(false);
  });

  it("Scenario 8: Saving settings persists atomically across instances", () => {
    const testFile = path.join(process.cwd(), "config", "test-floci-config.json");
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

    const repo = new JsonFileConfigRepository(testFile);
    const saved = repo.save({
      mode: "tailscale",
      protocol: "http",
      host: "100.101.187.9",
      apiPort: 4566,
    });

    expect(saved.mode).toBe("tailscale");
    expect(saved.host).toBe("100.101.187.9");

    // Read back
    const reloadedRepo = new JsonFileConfigRepository(testFile);
    const read = reloadedRepo.get();
    expect(read.mode).toBe("tailscale");
    expect(read.host).toBe("100.101.187.9");

    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  it("Scenario 9: Locked configuration prevents mutations", () => {
    const originalEnv = process.env.FLOCI_CONFIG_LOCKED;
    process.env.FLOCI_CONFIG_LOCKED = "true";

    const repo = new JsonFileConfigRepository();
    expect(repo.isLocked()).toBe(true);
    expect(() =>
      repo.save({
        mode: "local",
        protocol: "http",
        host: "localhost",
        apiPort: 4566,
      })
    ).toThrow("Configuration is locked");

    process.env.FLOCI_CONFIG_LOCKED = originalEnv;
  });

  it("Scenario 10: Validates port ranges accurately", () => {
    expect(isPortInRange(7001, PORT_RANGES.RDS_START, PORT_RANGES.RDS_END)).toBe(true);
    expect(isPortInRange(7099, PORT_RANGES.RDS_START, PORT_RANGES.RDS_END)).toBe(true);
    expect(isPortInRange(7100, PORT_RANGES.RDS_START, PORT_RANGES.RDS_END)).toBe(false);

    expect(isPortInRange(2200, PORT_RANGES.EC2_SSH_START, PORT_RANGES.EC2_SSH_END)).toBe(true);
    expect(isPortInRange(2300, PORT_RANGES.EC2_SSH_START, PORT_RANGES.EC2_SSH_END)).toBe(false);

    expect(isPortInRange(6379, PORT_RANGES.ELASTICACHE_START, PORT_RANGES.ELASTICACHE_END)).toBe(true);
    expect(isPortInRange(6400, PORT_RANGES.ELASTICACHE_START, PORT_RANGES.ELASTICACHE_END)).toBe(false);
  });
});
