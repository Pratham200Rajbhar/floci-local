"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FlociNetworkConfig, NetworkDiagnostics } from "@/lib/network-config/types";
import {
  buildFlociApiEndpoint,
  buildRdsConnectionDetails,
  buildEc2SshDetails,
  buildElastiCacheDetails,
  getAwsCliSnippet,
  RdsConnectionDetails,
  Ec2SshDetails,
  ElastiCacheConnectionDetails,
} from "@/lib/floci-network";

interface NetworkContextValue {
  config: FlociNetworkConfig;
  diagnostics?: NetworkDiagnostics;
  isLocked: boolean;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
  apiEndpoint: string;
  buildRds: (
    rawAddress?: string,
    rawPort?: number,
    engine?: string,
    username?: string,
    dbName?: string,
    resourceId?: string
  ) => RdsConnectionDetails;
  buildEc2: (
    rawPort: number,
    user?: string,
    rawPrivateIp?: string,
    resourceId?: string
  ) => Ec2SshDetails;
  buildElastiCache: (
    rawPort: number,
    resourceId?: string
  ) => ElastiCacheConnectionDetails;
  awsCliSnippet: string;
}

const DEFAULT_CONFIG: FlociNetworkConfig = {
  mode: "local",
  protocol: "http",
  host: "localhost",
  apiPort: 4566,
  updatedAt: new Date().toISOString(),
};

const NetworkContext = createContext<NetworkContextValue>({
  config: DEFAULT_CONFIG,
  isLocked: false,
  isLoading: false,
  refetch: async () => {},
  apiEndpoint: "http://localhost:4566",
  buildRds: () => buildRdsConnectionDetails(undefined, 7001, "postgres", "postgres", "postgres", undefined, DEFAULT_CONFIG),
  buildEc2: (port: number) => buildEc2SshDetails(port, "root", undefined, undefined, DEFAULT_CONFIG),
  buildElastiCache: (port: number) => buildElastiCacheDetails(port, undefined, DEFAULT_CONFIG),
  awsCliSnippet: getAwsCliSnippet(DEFAULT_CONFIG),
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["network-config"],
    queryFn: async () => {
      const res = await fetch("/api/network-config");
      if (!res.ok) throw new Error("Failed to fetch network configuration");
      return (await res.json()) as {
        config: FlociNetworkConfig;
        diagnostics: NetworkDiagnostics;
        isLocked: boolean;
      };
    },
    staleTime: 10000,
  });

  const activeConfig = data?.config || DEFAULT_CONFIG;
  const isLocked = Boolean(data?.isLocked);
  const diagnostics = data?.diagnostics;

  const value = useMemo<NetworkContextValue>(() => {
    const apiEndpoint = buildFlociApiEndpoint(activeConfig);
    const awsCliSnippet = getAwsCliSnippet(activeConfig);

    return {
      config: activeConfig,
      diagnostics,
      isLocked,
      isLoading,
      refetch,
      apiEndpoint,
      buildRds: (rawAddress, rawPort, engine, username, dbName, resourceId) =>
        buildRdsConnectionDetails(rawAddress, rawPort, engine, username, dbName, resourceId, activeConfig),
      buildEc2: (rawPort, user, rawPrivateIp, resourceId) =>
        buildEc2SshDetails(rawPort, user, rawPrivateIp, resourceId, activeConfig),
      buildElastiCache: (rawPort, resourceId) =>
        buildElastiCacheDetails(rawPort, resourceId, activeConfig),
      awsCliSnippet,
    };
  }, [activeConfig, diagnostics, isLocked, isLoading, refetch]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkConfig(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetworkConfig must be used within a NetworkProvider");
  }
  return context;
}
