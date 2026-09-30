"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  HardDrive,
  Database,
  Server,
  Zap,
  Cpu,
  MessageSquare,
  Mail,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Shield,
  Network,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { CopyButton } from "@/components/ui/copy-button";
import { useNetworkConfig } from "@/components/providers/network-provider";
import Link from "next/link";

interface HealthApiResponse {
  status: "UP" | "DOWN";
  networkStatus: string;
  publicEndpoint: string;
  version: string;
  diagnostics?: {
    status: string;
    publicHost: string;
    publicProtocol: string;
    publicServiceEndpoint: string;
    servicePort: number;
    portRanges: {
      rds: string;
      ec2Ssh: string;
      elastiCache: string;
    };
  };
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { config: networkConfig, apiEndpoint } = useNetworkConfig();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  // Health query
  const { data: health, isLoading: healthLoading, error: healthError } = useQuery<HealthApiResponse>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error("Could not reach Floci health endpoint");
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Resource summaries
  const { data: s3Data } = useQuery({
    queryKey: ["s3-buckets"],
    queryFn: async () => (await fetch("/api/s3")).json(),
  });

  const { data: rdsData } = useQuery({
    queryKey: ["rds-instances"],
    queryFn: async () => (await fetch("/api/rds")).json(),
  });

  const { data: ec2Data } = useQuery({
    queryKey: ["ec2-instances"],
    queryFn: async () => (await fetch("/api/ec2")).json(),
  });

  const { data: elastiCacheData } = useQuery({
    queryKey: ["elasticache-clusters"],
    queryFn: async () => (await fetch("/api/elasticache")).json(),
  });

  const { data: lambdaData } = useQuery({
    queryKey: ["lambda-functions"],
    queryFn: async () => (await fetch("/api/lambda")).json(),
  });

  const { data: sqsData } = useQuery({
    queryKey: ["sqs-queues"],
    queryFn: async () => (await fetch("/api/sqs")).json(),
  });

  const { data: sesData } = useQuery({
    queryKey: ["ses-identities"],
    queryFn: async () => (await fetch("/api/ses")).json(),
  });

  // Reset Mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/health", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reset failed");
      return data;
    },
    onSuccess: () => {
      setResetDialogOpen(false);
      setResetFeedback("All Floci resource state has been reset.");
      queryClient.invalidateQueries();
      setTimeout(() => setResetFeedback(null), 4000);
    },
  });

  const isOnline = health?.status === "UP";
  const publicEndpoint = apiEndpoint || health?.publicEndpoint || "http://localhost:4566";
  const diagnostics = health?.diagnostics;

  const services = [
    {
      name: "S3 Buckets",
      count: s3Data?.buckets?.length ?? 0,
      icon: HardDrive,
      href: "/s3",
      description: "Object storage buckets & files",
    },
    {
      name: "RDS Databases",
      count: rdsData?.instances?.length ?? 0,
      icon: Database,
      href: "/rds",
      description: "Postgres & MySQL databases",
    },
    {
      name: "EC2 Instances",
      count: ec2Data?.instances?.length ?? 0,
      icon: Server,
      href: "/ec2",
      description: "Virtual server instances & SSH",
    },
    {
      name: "ElastiCache",
      count: elastiCacheData?.clusters?.length ?? 0,
      icon: Zap,
      href: "/elasticache",
      description: "Redis / Valkey clusters",
    },
    {
      name: "Lambda Functions",
      count: lambdaData?.functions?.length ?? 0,
      icon: Cpu,
      href: "/lambda",
      description: "Serverless code executions",
    },
    {
      name: "SQS Queues",
      count: sqsData?.queues?.length ?? 0,
      icon: MessageSquare,
      href: "/messaging",
      description: "Message queuing services",
    },
    {
      name: "SES Identities",
      count: sesData?.identities?.length ?? 0,
      icon: Mail,
      href: "/ses",
      description: "Verified senders & test inbox",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Environment Access Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 px-4 text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Shield className="h-4 w-4 text-blue-600 shrink-0" />
          <span>
            <strong>Access Mode:</strong> Configured for <span className="font-semibold uppercase">{networkConfig.mode}</span> access ({publicEndpoint}).
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" className="capitalize">{networkConfig.mode} Mode</Badge>
          <Link href="/settings/network">
            <Button variant="outline" size="sm" className="h-7 text-xs bg-white">
              Configure Access
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Overview</h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time status, network routing, and resource metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setResetDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset All Data
          </Button>
        </div>
      </div>

      {resetFeedback ? (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-sm">
          {resetFeedback}
        </div>
      ) : null}

      {/* Network Access Card */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Network Access & Endpoint Details</CardTitle>
                <CardDescription>
                  Published address and port mappings used across all CLI and database connection tools.
                </CardDescription>
              </div>
            </div>
            <div>
              <Badge variant="success" className="py-1 px-3 capitalize">
                {networkConfig.mode}-ready
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-md gap-3">
            <div>
              <span className="text-xs text-slate-500 font-medium">Public Service Endpoint:</span>
              <p className="font-mono text-sm font-semibold text-slate-900 mt-0.5">{publicEndpoint}</p>
            </div>
            <CopyButton text={publicEndpoint} label="Copy Endpoint" />
          </div>

          {/* Diagnostics Panel */}
          {diagnostics ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="p-3 bg-slate-50/70 rounded border border-slate-200">
                <span className="text-slate-500 block">Published Access Host</span>
                <span className="font-mono font-semibold text-slate-800 mt-1 block">{networkConfig.host}</span>
              </div>
              <div className="p-3 bg-slate-50/70 rounded border border-slate-200">
                <span className="text-slate-500 block">Service API Port</span>
                <span className="font-mono font-semibold text-slate-800 mt-1 block">:{networkConfig.apiPort}</span>
              </div>
              <div className="p-3 bg-slate-50/70 rounded border border-slate-200">
                <span className="text-slate-500 block">RDS Port Range</span>
                <span className="font-mono font-semibold text-slate-800 mt-1 block">{diagnostics.portRanges.rds}</span>
              </div>
              <div className="p-3 bg-slate-50/70 rounded border border-slate-200">
                <span className="text-slate-500 block">EC2 SSH / Redis Ranges</span>
                <span className="font-mono font-semibold text-slate-800 mt-1 block">SSH {diagnostics.portRanges.ec2Ssh} | Redis {diagnostics.portRanges.elastiCache}</span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Floci Health Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isOnline ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Floci Instance Status</CardTitle>
                <CardDescription>Target Host: {networkConfig.host}</CardDescription>
              </div>
            </div>
            <div>
              {healthLoading ? (
                <Badge variant="default">Checking...</Badge>
              ) : isOnline ? (
                <Badge variant="success" className="flex items-center gap-1.5 py-1 px-3">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  ONLINE
                </Badge>
              ) : (
                <Badge variant="danger" className="flex items-center gap-1.5 py-1 px-3">
                  <XCircle className="h-3.5 w-3.5" />
                  OFFLINE
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {healthError ? (
            <ErrorBanner error={healthError} className="mb-4" />
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-xs text-slate-500">Version</span>
              <p className="font-semibold text-slate-800 font-mono mt-0.5">
                {health?.version || "1.0.0"}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-xs text-slate-500">Health Polling</span>
              <p className="font-semibold text-slate-800 mt-0.5">Every 5 seconds</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-xs text-slate-500">AWS Region</span>
              <p className="font-semibold text-slate-800 font-mono mt-0.5">us-east-1</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-xs text-slate-500">Storage Persistence</span>
              <p className="font-semibold text-slate-800 mt-0.5">Enabled (./data)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Grid */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Emulated AWS Services</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {services.map((svc) => {
            const Icon = svc.icon;
            return (
              <Link key={svc.name} href={svc.href} className="group">
                <Card className="h-full transition-all duration-150 hover:border-blue-300 hover:shadow-sm">
                  <CardContent className="p-5 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-md bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors text-slate-600">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-2xl font-bold text-slate-900 font-mono">
                          {svc.count}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
                        {svc.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{svc.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Confirm Reset Dialog */}
      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="Reset All Floci Data?"
        description="This will clear all emulated S3 buckets, RDS tables, EC2 states, Lambda functions, and SQS queues in Floci. This action cannot be undone."
        confirmLabel="Reset Everything"
        variant="destructive"
        isLoading={resetMutation.isPending}
        onConfirm={() => resetMutation.mutate()}
      />
    </div>
  );
}
