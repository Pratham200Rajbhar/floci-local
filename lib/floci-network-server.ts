import { networkConfigRepo } from "./network-config/repository";
import type { FlociNetworkConfig, NetworkDiagnostics } from "./network-config/types";
import {
  buildRdsConnectionDetails as buildRdsPure,
  buildEc2SshDetails as buildEc2Pure,
  buildElastiCacheDetails as buildElastiCachePure,
  getNetworkDiagnostics as getNetworkDiagnosticsPure,
} from "./floci-network";

export * from "./floci-network";

export function getServerNetworkConfig(): FlociNetworkConfig {
  return networkConfigRepo.get();
}

export function getServerNetworkDiagnostics(): NetworkDiagnostics {
  const config = getServerNetworkConfig();
  const isLocked = networkConfigRepo.isLocked();
  return getNetworkDiagnosticsPure(config, isLocked);
}

export function buildServerRdsDetails(
  rawAddress?: string,
  rawPort?: number,
  engine: string = "postgres",
  username: string = "postgres",
  dbName: string = "postgres",
  resourceId?: string,
  password?: string
) {
  return buildRdsPure(rawAddress, rawPort, engine, username, dbName, resourceId, getServerNetworkConfig(), password);
}

export function buildServerEc2Details(
  rawPort: number,
  user: string = "root",
  rawPrivateIp?: string,
  resourceId?: string
) {
  return buildEc2Pure(rawPort, user, rawPrivateIp, resourceId, getServerNetworkConfig());
}

export function buildServerElastiCacheDetails(rawPort: number, resourceId?: string) {
  return buildElastiCachePure(rawPort, resourceId, getServerNetworkConfig());
}
