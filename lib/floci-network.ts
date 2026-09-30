import type { FlociNetworkConfig, NetworkDiagnostics } from "./network-config/types";
import { logger } from "./logger";

export interface RdsConnectionDetails {
  endpoint: string;
  host: string;
  port: number;
  isPortValid: boolean;
  psqlUri: string;
  psqlCliCommand: string;
  pgPasswordCommand: string;
  mysqlCliCommand: string;
}

export interface Ec2SshDetails {
  host: string;
  port: number;
  isPortValid: boolean;
  sshCommand: string;
  internalContainerAddress?: string;
}

export interface ElastiCacheConnectionDetails {
  host: string;
  port: number;
  isPortValid: boolean;
  redisCliCommand: string;
}

// Configured standard port ranges
export const PORT_RANGES = {
  RDS_START: 7001,
  RDS_END: 7099,
  EC2_SSH_START: 2200,
  EC2_SSH_END: 2299,
  ELASTICACHE_START: 6379,
  ELASTICACHE_END: 6399,
};

export const DEFAULT_NETWORK_CONFIG: FlociNetworkConfig = {
  mode: "local",
  protocol: "http",
  host: "localhost",
  apiPort: 4566,
  updatedAt: "2026-09-04T00:00:00.000Z",
};

/**
 * Resolves active network config.
 */
export function getActiveNetworkConfig(overrideConfig?: Partial<FlociNetworkConfig>): FlociNetworkConfig {
  if (overrideConfig && overrideConfig.host && overrideConfig.mode) {
    return {
      mode: overrideConfig.mode,
      protocol: overrideConfig.protocol || "http",
      host: overrideConfig.host,
      apiPort: overrideConfig.apiPort || 4566,
      updatedAt: overrideConfig.updatedAt || new Date().toISOString(),
    };
  }
  return DEFAULT_NETWORK_CONFIG;
}

/**
 * Returns the public user-facing Floci AWS API endpoint (e.g. http://localhost:4566, http://192.168.1.20:4566, http://100.101.187.9:4566).
 */
export function buildFlociApiEndpoint(config?: FlociNetworkConfig): string {
  const active = getActiveNetworkConfig(config);
  return `${active.protocol}://${active.host}:${active.apiPort}`;
}

/**
 * Returns the public user-facing S3 service endpoint.
 */
export function buildS3Endpoint(config?: FlociNetworkConfig): string {
  return buildFlociApiEndpoint(config);
}

/**
 * Validates whether a port falls within the configured start and end bounds.
 */
export function isPortInRange(port: number, start: number, end: number): boolean {
  return Number.isInteger(port) && port >= start && port <= end;
}

/**
 * Rewrites internal Docker/container addresses returned by Floci to the user's configured access host,
 * and generates clean copyable connection commands for PostgreSQL and MySQL.
 */
export function buildRdsConnectionDetails(
  rawAddress: string | undefined,
  rawPort: number | undefined,
  engine: string = "postgres",
  username: string = "postgres",
  dbName: string = "postgres",
  resourceId?: string,
  config?: FlociNetworkConfig,
  password?: string
): RdsConnectionDetails {
  const active = getActiveNetworkConfig(config);
  const host = active.host;
  const port = rawPort || 7001;
  const isPortValid = isPortInRange(port, PORT_RANGES.RDS_START, PORT_RANGES.RDS_END);

  if (rawAddress && (rawAddress.startsWith("10.") || rawAddress.startsWith("172.") || rawAddress.includes("floci"))) {
    logger.warn(
      { resourceId, rawAddress, sanitizedHost: host },
      "Floci returned an internal Docker network address for RDS. Rewriting to configured public access host."
    );
  }

  const endpoint = `${host}:${port}`;
  const effectiveDbName = dbName || (engine === "postgres" ? "postgres" : "");
  const effectivePassword = password || "postgres";

  const psqlUri = `postgresql://${username}:${effectivePassword}@${host}:${port}/${effectiveDbName || "postgres"}`;
  const psqlCliCommand = `psql "host=${host} port=${port} dbname=${effectiveDbName || "postgres"} user=${username} sslmode=disable"`;
  const pgPasswordCommand = `PGPASSWORD='${effectivePassword}' psql -h ${host} -p ${port} -U ${username} -d ${effectiveDbName || "postgres"}`;
  const mysqlCliCommand = `mysql -h ${host} -P ${port} -u ${username} -p'${effectivePassword}'`;

  return {
    endpoint,
    host,
    port,
    isPortValid,
    psqlUri,
    psqlCliCommand,
    pgPasswordCommand,
    mysqlCliCommand,
  };
}

/**
 * Generates copyable EC2 SSH command based on the active network configuration.
 */
export function buildEc2SshDetails(
  rawPort: number,
  user: string = "root",
  rawPrivateIp?: string,
  resourceId?: string,
  config?: FlociNetworkConfig
): Ec2SshDetails {
  const active = getActiveNetworkConfig(config);
  const host = active.host;
  const isPortValid = isPortInRange(
    rawPort,
    PORT_RANGES.EC2_SSH_START,
    PORT_RANGES.EC2_SSH_END
  );

  if (!isPortValid) {
    logger.warn(
      { resourceId, rawPort },
      "EC2 SSH port outside of configured range. Marking endpoint unavailable."
    );
  }

  const sshCommand = isPortValid
    ? `ssh -p ${rawPort} ${user}@${host}`
    : "SSH endpoint unavailable (port out of range)";

  return {
    host,
    port: rawPort,
    isPortValid,
    sshCommand,
    internalContainerAddress: rawPrivateIp,
  };
}

/**
 * Generates copyable ElastiCache Redis CLI commands based on the active network configuration.
 */
export function buildElastiCacheDetails(
  rawPort: number,
  resourceId?: string,
  config?: FlociNetworkConfig
): ElastiCacheConnectionDetails {
  const active = getActiveNetworkConfig(config);
  const host = active.host;
  const isPortValid = isPortInRange(
    rawPort,
    PORT_RANGES.ELASTICACHE_START,
    PORT_RANGES.ELASTICACHE_END
  );

  if (!isPortValid) {
    logger.warn(
      { resourceId, rawPort },
      "ElastiCache port outside of configured range. Using safe fallback."
    );
  }

  return {
    host,
    port: rawPort,
    isPortValid,
    redisCliCommand: `redis-cli -h ${host} -p ${rawPort} PING`,
  };
}

/**
 * Generates copyable AWS CLI configuration environment variables for user terminal setup.
 */
export function getAwsCliSnippet(
  config?: FlociNetworkConfig,
  region: string = "us-east-1",
  accessKey: string = "test",
  secretKey: string = "test"
): string {
  const endpointUrl = buildFlociApiEndpoint(config);
  return `export AWS_ENDPOINT_URL=${endpointUrl}\nexport AWS_DEFAULT_REGION=${region}\nexport AWS_ACCESS_KEY_ID=${accessKey}\nexport AWS_SECRET_ACCESS_KEY=${secretKey}`;
}

/**
 * Returns human-readable security notice based on the active network mode.
 */
export function getSecurityNotice(mode: FlociNetworkConfig["mode"]): string {
  switch (mode) {
    case "local":
      return "Local machine mode: only this machine can access these services (isolated to localhost).";
    case "lan":
      return "LAN mode: devices on your allowed local network/Wi-Fi may be able to connect. Ensure your firewall and Docker ports are properly secured.";
    case "tailscale":
      return "Tailscale mode: only devices authenticated and connected to the same Tailscale tailnet can connect.";
    case "custom":
      return "Custom hostname mode: ensure your reverse proxy, VPN, firewall, TLS, and authentication are correctly configured.";
  }
}

/**
 * Returns structured network diagnostics metadata.
 */
export function getNetworkDiagnostics(config?: FlociNetworkConfig, isLocked: boolean = false): NetworkDiagnostics {
  const active = getActiveNetworkConfig(config);

  return {
    status: isLocked ? "locked" : "configured",
    mode: active.mode,
    apiEndpoint: buildFlociApiEndpoint(active),
    host: active.host,
    protocol: active.protocol,
    apiPort: active.apiPort,
    isLocked,
    portRanges: {
      rds: `${PORT_RANGES.RDS_START}–${PORT_RANGES.RDS_END}`,
      ec2Ssh: `${PORT_RANGES.EC2_SSH_START}–${PORT_RANGES.EC2_SSH_END}`,
      elastiCache: `${PORT_RANGES.ELASTICACHE_START}–${PORT_RANGES.ELASTICACHE_END}`,
    },
    securityNotice: getSecurityNotice(active.mode),
  };
}

/**
 * Backward compatibility alias for existing code referencing getPublicServiceEndpoint / getTailscaleAwsCliSnippet.
 */
export const getPublicServiceEndpoint = buildFlociApiEndpoint;
export const getTailscaleAwsCliSnippet = getAwsCliSnippet;
