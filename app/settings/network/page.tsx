"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Network,
  Laptop,
  Wifi,
  Shield,
  Globe,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Activity,
  Lock,
} from "lucide-react";
import { useNetworkConfig } from "@/components/providers/network-provider";
import {
  networkConfigSchema,
  type NetworkConfigInput,
} from "@/lib/network-config/validation";
import type { NetworkMode, TestConnectionResult } from "@/lib/network-config/types";
import {
  buildFlociApiEndpoint,
  buildRdsConnectionDetails,
  buildEc2SshDetails,
  buildElastiCacheDetails,
  getAwsCliSnippet,
  getSecurityNotice,
} from "@/lib/floci-network";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

const NETWORK_MODES: {
  id: NetworkMode;
  name: string;
  description: string;
  icon: React.ElementType;
  defaultHost: string;
}[] = [
  {
    id: "local",
    name: "Local Machine",
    description: "Connect via localhost (isolated to this machine)",
    icon: Laptop,
    defaultHost: "localhost",
  },
  {
    id: "lan",
    name: "LAN / Office Wi-Fi",
    description: "Access across your local subnet (192.168.x.x, .local)",
    icon: Wifi,
    defaultHost: "192.168.x.x",
  },
  {
    id: "tailscale",
    name: "Tailscale / Private VPN",
    description: "Secure tailnet access (100.x.x.x or MagicDNS *.ts.net)",
    icon: Shield,
    defaultHost: "100.x.x.x",
  },
  {
    id: "custom",
    name: "Custom Host / Reverse Proxy",
    description: "Custom domain, HTTPS, or reverse proxy infrastructure",
    icon: Globe,
    defaultHost: "floci.dev.internal",
  },
];

export default function NetworkSettingsPage() {
  const queryClient = useQueryClient();
  const { config, diagnostics, isLocked, refetch } = useNetworkConfig();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<NetworkConfigInput>({
    resolver: zodResolver(networkConfigSchema),
    defaultValues: {
      mode: config.mode,
      protocol: config.protocol,
      host: config.host,
      apiPort: config.apiPort,
    },
  });

  // Sync form when config is loaded
  useEffect(() => {
    reset({
      mode: config.mode,
      protocol: config.protocol,
      host: config.host,
      apiPort: config.apiPort,
    });
  }, [config, reset]);

  const watchedMode = watch("mode") || "local";
  const watchedProtocol = watch("protocol") || "http";
  const watchedHost = watch("host") || "localhost";
  const watchedPort = watch("apiPort") || 4566;

  // Active preview config constructed from live form inputs
  const previewConfig = {
    mode: watchedMode,
    protocol: watchedProtocol,
    host: watchedHost.trim() || "localhost",
    apiPort: Number(watchedPort) || 4566,
    updatedAt: new Date().toISOString(),
  };

  const previewEndpoint = buildFlociApiEndpoint(previewConfig);
  const previewAwsCli = getAwsCliSnippet(previewConfig);
  const previewRds = buildRdsConnectionDetails("10.0.4.2:7001", 7001, "postgres", "postgres", "postgres", undefined, previewConfig);
  const previewEc2 = buildEc2SshDetails(2200, "root", "10.0.4.5", undefined, previewConfig);
  const previewRedis = buildElastiCacheDetails(6379, undefined, previewConfig);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (data: NetworkConfigInput) => {
      setSaveSuccessMsg(null);
      const res = await fetch("/api/network-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update configuration");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-config"] });
      refetch();
      setSaveSuccessMsg("Network configuration saved successfully.");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    },
  });

  // Test Connection Mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      setTestResult(null);
      const res = await fetch("/api/network-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: watchedProtocol,
          host: watchedHost.trim(),
          apiPort: Number(watchedPort),
        }),
      });
      return (await res.json()) as TestConnectionResult;
    },
    onSuccess: (data) => {
      setTestResult(data);
    },
    onError: (err: Error) => {
      setTestResult({
        success: false,
        error: err.message,
        testedEndpoint: `${watchedProtocol}://${watchedHost}:${watchedPort}`,
      });
    },
  });

  // Reset Mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/network-config/reset", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reset configuration");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-config"] });
      refetch();
      setResetDialogOpen(false);
      setSaveSuccessMsg("Network configuration has been reset to local defaults.");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    },
  });

  const handleModeSelect = (mode: NetworkMode) => {
    if (isLocked) return;
    setValue("mode", mode, { shouldDirty: true, shouldValidate: true });
    if (mode === "local") {
      setValue("host", "localhost", { shouldDirty: true, shouldValidate: true });
      setValue("protocol", "http", { shouldDirty: true });
      setValue("apiPort", 4566, { shouldDirty: true });
    } else if (mode === "lan") {
      const defaultLanIp = diagnostics?.detectedLanIp || "192.168.31.185";
      if (watchedHost === "localhost" || watchedHost.startsWith("100.") || watchedHost === "192.168.1.50") {
        setValue("host", defaultLanIp, { shouldDirty: true, shouldValidate: true });
      }
    } else if (mode === "tailscale") {
      const defaultTailscale = diagnostics?.detectedTailscaleIp || "100.114.169.37";
      if (watchedHost === "localhost" || watchedHost.startsWith("192.168.") || watchedHost.startsWith("10.") || watchedHost.startsWith("172.")) {
        setValue("host", defaultTailscale, { shouldDirty: true, shouldValidate: true });
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Network className="h-6 w-6 text-blue-600" />
            Network & Access Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure how developers and client tools connect to Floci resources across your local machine, LAN, or Tailnet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLocked ? (
            <Badge variant="warning" className="gap-1.5 py-1 px-3">
              <Lock className="h-3.5 w-3.5" />
              Configuration Locked
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetDialogOpen(true)}
              disabled={resetMutation.isPending}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset Defaults
            </Button>
          )}
        </div>
      </div>

      {/* Lock Notice if locked */}
      {isLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 flex items-start gap-3 text-sm">
          <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Network Settings are Managed by Environment</div>
            <p className="text-xs text-amber-800 mt-0.5">
              <code>FLOCI_CONFIG_LOCKED=true</code> is active. Settings are in read-only mode and cannot be changed from the UI.
            </p>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 flex items-center gap-3 text-sm animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Save / Validation Errors */}
      {saveMutation.error && (
        <ErrorBanner error={saveMutation.error} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Mode selection & Form */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Select Network Access Mode</CardTitle>
              <CardDescription>
                Choose how client devices will access this Floci server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {NETWORK_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = watchedMode === mode.id;

                  return (
                    <button
                      type="button"
                      key={mode.id}
                      disabled={isLocked}
                      onClick={() => handleModeSelect(mode.id)}
                      className={cn(
                        "p-4 rounded-lg border text-left transition-all flex flex-col justify-between relative",
                        isSelected
                          ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
                        isLocked && "opacity-75 cursor-not-allowed"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className={cn(
                              "p-2 rounded-md",
                              isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div className="font-semibold text-sm text-slate-900">{mode.name}</div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {mode.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Configuration Form */}
          <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
            <Card>
              <CardHeader>
                <CardTitle>2. Connection Host & Endpoint Details</CardTitle>
                <CardDescription>
                  Configure the hostname or IP address published for client connection strings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Protocol */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Protocol</label>
                    <select
                      {...register("protocol")}
                      disabled={isLocked || watchedMode === "local"}
                      className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      <option value="http">http://</option>
                      <option value="https">https://</option>
                    </select>
                  </div>

                  {/* Host / IP */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {watchedMode === "local"
                        ? "Host (Isolated)"
                        : watchedMode === "lan"
                        ? "LAN IP / Hostname"
                        : watchedMode === "tailscale"
                        ? "Tailscale IP / MagicDNS"
                        : "Custom Domain / Hostname"}
                    </label>
                    <Input
                      {...register("host")}
                      placeholder={
                        watchedMode === "local"
                          ? "localhost"
                          : watchedMode === "lan"
                          ? (diagnostics?.detectedLanIp || "192.168.1.50")
                          : watchedMode === "tailscale"
                          ? (diagnostics?.detectedTailscaleIp || "100.x.x.x or *.ts.net")
                          : "floci.internal"
                      }
                      disabled={isLocked || watchedMode === "local"}
                      error={errors.host?.message}
                    />
                    {watchedMode === "lan" && diagnostics?.detectedIps && diagnostics.detectedIps.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>Auto-detected:</span>
                        {diagnostics.detectedIps.map((detected) => (
                          <button
                            key={`${detected.interface}-${detected.address}`}
                            type="button"
                            disabled={isLocked}
                            onClick={() => setValue("host", detected.address, { shouldDirty: true, shouldValidate: true })}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-mono transition-colors cursor-pointer",
                              watchedHost === detected.address
                                ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                            )}
                            title={`Click to use ${detected.interface} IP`}
                          >
                            {detected.type === "wifi" ? (
                              <Wifi className="h-3 w-3 text-blue-600" />
                            ) : (
                              <Laptop className="h-3 w-3 text-slate-500" />
                            )}
                            <span>{detected.interface}: {detected.address}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {watchedMode === "tailscale" && diagnostics?.detectedTailscaleIp && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>Auto-detected:</span>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => setValue("host", diagnostics.detectedTailscaleIp!, { shouldDirty: true, shouldValidate: true })}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-mono transition-colors cursor-pointer",
                            watchedHost === diagnostics.detectedTailscaleIp
                              ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                          )}
                          title="Click to use detected Tailscale IP"
                        >
                          <Shield className="h-3 w-3 text-blue-600" />
                          <span>tailscale: {diagnostics.detectedTailscaleIp}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Port */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Floci AWS API Port
                  </label>
                  <Input
                    type="number"
                    {...register("apiPort")}
                    placeholder="4566"
                    disabled={isLocked}
                    error={errors.apiPort?.message}
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Default Floci core API port is 4566.
                  </span>
                </div>

                {/* Mode Security Alert */}
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-start gap-2.5 text-xs text-slate-700">
                  <Shield className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">Access Scope: </span>
                    {getSecurityNotice(watchedMode)}
                  </div>
                </div>

                {/* Test Connection Button & Result */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => testMutation.mutate()}
                      isLoading={testMutation.isPending}
                    >
                      <Activity className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                      Test Connectivity
                    </Button>

                    {testResult && (
                      <div className="text-xs flex items-center gap-2">
                        {testResult.success ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Reachable ({testResult.latencyMs}ms) &bull; Floci v{testResult.version}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-red-700 font-medium bg-red-50 border border-red-200 px-2.5 py-1 rounded">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                            <span>Unreachable: {testResult.error}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button
                    type="submit"
                    disabled={isLocked || !isDirty}
                    isLoading={saveMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    Save Network Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Right Column: Live Dynamic Preview Panel */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-blue-200/70 bg-gradient-to-b from-white to-slate-50/50">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm">Live Connection Preview</CardTitle>
                </div>
                <Badge variant="info" className="capitalize text-[11px]">
                  {watchedMode} Mode
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Real-time preview of commands generated across all resource views based on current inputs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs">
              {/* Floci API Endpoint */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Floci AWS API Endpoint
                </label>
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-md p-2 font-mono text-slate-800 text-xs">
                  <span>{previewEndpoint}</span>
                  <CopyButton text={previewEndpoint} />
                </div>
              </div>

              {/* AWS CLI Configuration Snippet */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  AWS CLI Environment
                </label>
                <div className="relative bg-white border border-slate-200 rounded-md p-2.5 font-mono text-slate-800 text-[11px] whitespace-pre overflow-x-auto">
                  <div className="absolute top-1.5 right-1.5">
                    <CopyButton text={previewAwsCli} />
                  </div>
                  {previewAwsCli}
                </div>
              </div>

              {/* RDS PostgreSQL Command */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  PostgreSQL (RDS Port 7001)
                </label>
                <div className="relative bg-white border border-slate-200 rounded-md p-2 font-mono text-slate-800 text-[11px] break-all">
                  <div className="absolute top-1.5 right-1.5">
                    <CopyButton text={previewRds.psqlCliCommand} />
                  </div>
                  <span className="pr-6 block">{previewRds.psqlCliCommand}</span>
                </div>
              </div>

              {/* EC2 SSH Command */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  EC2 SSH (Port 2200)
                </label>
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-md p-2 font-mono text-slate-800 text-[11px]">
                  <span>{previewEc2.sshCommand}</span>
                  <CopyButton text={previewEc2.sshCommand} />
                </div>
              </div>

              {/* ElastiCache Redis Command */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  ElastiCache Redis (Port 6379)
                </label>
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-md p-2 font-mono text-slate-800 text-[11px]">
                  <span>{previewRedis.redisCliCommand}</span>
                  <CopyButton text={previewRedis.redisCliCommand} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="Reset to Local Defaults?"
        description="This will restore the network access mode to 'local' (http://localhost:4566). Any custom hostnames or Tailscale IPs will be reset."
        confirmLabel="Reset Defaults"
        variant="destructive"
        isLoading={resetMutation.isPending}
        onConfirm={() => resetMutation.mutate()}
      />
    </div>
  );
}
