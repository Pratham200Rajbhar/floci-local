export type NetworkMode = "local" | "lan" | "tailscale" | "custom";

export interface FlociNetworkConfig {
  mode: NetworkMode;
  protocol: "http" | "https";
  host: string;
  apiPort: number;
  updatedAt: string;
}

export interface DetectedDeviceIp {
  interface: string;
  address: string;
  type: "wifi" | "ethernet" | "lan" | "tailscale";
}

export interface NetworkDiagnostics {
  status: "configured" | "locked" | "default";
  mode: NetworkMode;
  apiEndpoint: string;
  host: string;
  protocol: "http" | "https";
  apiPort: number;
  isLocked: boolean;
  detectedLanIp?: string;
  detectedTailscaleIp?: string;
  detectedIps?: DetectedDeviceIp[];
  portRanges: {
    rds: string;
    ec2Ssh: string;
    elastiCache: string;
  };
  securityNotice: string;
}

export interface TestConnectionResult {
  success: boolean;
  statusCode?: number;
  latencyMs?: number;
  version?: string;
  edition?: string;
  error?: string;
  testedEndpoint: string;
}
