"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../ui/badge";
import { Activity } from "lucide-react";
import { useNetworkConfig } from "../providers/network-provider";

interface HealthData {
  status: "UP" | "DOWN";
  networkStatus?: string;
  publicEndpoint?: string;
  version?: string;
  uptime?: number;
}

export function Header() {
  const { config, apiEndpoint } = useNetworkConfig();
  const { data: health, isLoading } = useQuery<HealthData>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const isUp = health?.status === "UP";
  const activeMode = config.mode;
  const currentEndpoint = health?.publicEndpoint || apiEndpoint;

  return (
    <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Emulator Status
        </span>
      </div>

      <div className="flex items-center gap-4">
        {isLoading ? (
          <Badge variant="default" className="text-slate-500">
            Checking status...
          </Badge>
        ) : isUp ? (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Badge variant="success" className="capitalize">
              ONLINE ({activeMode})
            </Badge>
            <span className="text-xs text-slate-500 font-mono">
              v{health?.version || "1.0.0"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <Badge variant="danger">OFFLINE</Badge>
            <span className="text-xs text-red-500">
              Unreachable at {currentEndpoint}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
