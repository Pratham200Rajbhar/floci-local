"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Database,
  Plus,
  Trash2,
  RefreshCw,
  Shield,
  Terminal,
  Key,
  Eye,
  EyeOff,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyButton } from "@/components/ui/copy-button";
import { useNetworkConfig } from "@/components/providers/network-provider";
import { createRDSInstanceSchema, type CreateRDSInstanceInput } from "@/lib/validations/rds";

interface RDSTestResult {
  success: boolean;
  latencyMs?: number;
  testedEndpoint?: string;
  engine?: string;
  version?: string;
  vectorSupported?: boolean;
  vectorInstalled?: boolean;
  vectorVersion?: string | null;
  message?: string;
  error?: string;
  hint?: string;
}

interface RDSInstanceItem {
  identifier: string;
  status: string;
  engine: string;
  engineVersion?: string;
  instanceClass: string;
  allocatedStorage: number;
  endpoint: string;
  host: string;
  port: number;
  isPortValid: boolean;
  masterUsername: string;
  masterPassword?: string;
  dbName?: string;
  psqlUri: string;
  psqlCliCommand: string;
  pgPasswordCommand: string;
  mysqlCliCommand: string;
  createTime?: string;
}

export default function RDSPage() {
  const queryClient = useQueryClient();
  const { config } = useNetworkConfig();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<string | null>(null);
  const [viewConnectionInstance, setViewConnectionInstance] = useState<RDSInstanceItem | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testingIdentifier, setTestingIdentifier] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, RDSTestResult>>({});

  const testMutation = useMutation({
    mutationFn: async (payload: { identifier: string; engine?: string; host?: string; port?: number; masterUsername?: string; masterPassword?: string; dbName?: string }) => {
      setTestingIdentifier(payload.identifier);
      const res = await fetch("/api/rds/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: RDSTestResult = await res.json();
      return { identifier: payload.identifier, result };
    },
    onSuccess: ({ identifier, result }) => {
      setTestResults((prev) => ({ ...prev, [identifier]: result }));
      setTestingIdentifier(null);
    },
    onError: (err: Error, variables) => {
      setTestResults((prev) => ({
        ...prev,
        [variables.identifier]: {
          success: false,
          error: err.message || "Failed to test database connection",
        },
      }));
      setTestingIdentifier(null);
    },
  });

  const [extensionActionLoading, setExtensionActionLoading] = useState(false);
  const [extensionStatusMsg, setExtensionStatusMsg] = useState<string | null>(null);

  const extensionMutation = useMutation({
    mutationFn: async (payload: { identifier: string; extension: string; action: "enable" | "status"; host?: string; port?: number; masterUsername?: string; masterPassword?: string; dbName?: string }) => {
      setExtensionActionLoading(true);
      setExtensionStatusMsg(null);
      const res = await fetch("/api/rds/extension", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return { identifier: payload.identifier, data };
    },
    onSuccess: ({ identifier, data }) => {
      setExtensionActionLoading(false);
      if (data.success) {
        setExtensionStatusMsg(data.message || `Extension enabled.`);
        // Refresh connection test to update badge
        if (viewConnectionInstance) {
          testMutation.mutate({
            identifier,
            engine: viewConnectionInstance.engine,
            host: viewConnectionInstance.host,
            port: viewConnectionInstance.port,
            masterUsername: viewConnectionInstance.masterUsername,
            masterPassword: viewConnectionInstance.masterPassword,
            dbName: viewConnectionInstance.dbName,
          });
        }
      } else {
        setExtensionStatusMsg(`Error: ${data.error || "Failed to manage extension"}`);
      }
    },
    onError: (err: Error) => {
      setExtensionActionLoading(false);
      setExtensionStatusMsg(`Error: ${err.message || "Failed to execute extension operation"}`);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRDSInstanceInput>({
    resolver: zodResolver(createRDSInstanceSchema),
    defaultValues: {
      engine: "postgres",
      dbInstanceClass: "db.t3.micro",
      allocatedStorage: 20,
      masterUsername: "postgres",
    },
  });

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<{ instances: RDSInstanceItem[] }>({
    queryKey: ["rds-instances"],
    queryFn: async () => {
      const res = await fetch("/api/rds");
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateRDSInstanceInput) => {
      const res = await fetch("/api/rds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rds-instances"] });
      setCreateDialogOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (dbInstanceIdentifier: string) => {
      const res = await fetch("/api/rds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbInstanceIdentifier }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rds-instances"] });
      setInstanceToDelete(null);
    },
  });

  const instances = data?.instances || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">RDS Databases</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage PostgreSQL, MySQL, and MariaDB instances with {config.mode.toUpperCase()} access connection strings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Database Instance
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner error={error} onRetry={() => refetch()} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Instances ({instances.length})</CardTitle>
          <CardDescription>
            All RDS databases published on host <code className="font-semibold text-slate-700">{config.host}</code> (proxy ports 7001–7099)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner message="Fetching RDS instances..." />
          ) : instances.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No database instances found"
                description="Launch a new PostgreSQL or MySQL instance to begin."
                actionLabel="Create Database Instance"
                onAction={() => setCreateDialogOpen(true)}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-y border-slate-200 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Identifier</th>
                    <th className="py-3 px-5">Engine</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Endpoint ({config.mode.toUpperCase()})</th>
                    <th className="py-3 px-5">Class & Storage</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {instances.map((db) => {
                    const isAvailable = db.status === "available";
                    return (
                      <tr key={db.identifier} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-semibold text-slate-900 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-slate-400" />
                            <span>{db.identifier}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs">
                          <Badge variant="outline" className="capitalize">
                            {db.engine}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-xs">
                          <Badge variant={isAvailable ? "success" : "warning"}>
                            {db.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-xs font-mono text-slate-700">
                          <div className="flex items-center gap-2">
                            <span>{db.endpoint}</span>
                            <CopyButton text={db.endpoint} label="Copy" />
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-slate-600">
                          {db.instanceClass} ({db.allocatedStorage} GB)
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {testResults[db.identifier] ? (
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant={testResults[db.identifier].success ? "success" : "danger"}
                                  className="text-[11px] font-normal"
                                  title={testResults[db.identifier].error || testResults[db.identifier].message}
                                >
                                  {testResults[db.identifier].success ? (
                                    <>
                                      <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600 inline" />
                                      Online ({testResults[db.identifier].latencyMs}ms)
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="h-3 w-3 mr-1 text-red-600 inline" />
                                      Error
                                    </>
                                  )}
                                </Badge>
                                {db.engine === "postgres" && testResults[db.identifier].success ? (
                                  <Badge
                                    variant={testResults[db.identifier].vectorInstalled ? "success" : "outline"}
                                    className={`text-[10px] font-mono px-1.5 py-0.5 ${
                                      testResults[db.identifier].vectorInstalled
                                        ? "bg-violet-50 text-violet-700 border-violet-200"
                                        : testResults[db.identifier].vectorSupported
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-slate-50 text-slate-500 border-slate-200"
                                    }`}
                                    title={
                                      testResults[db.identifier].vectorInstalled
                                        ? `pgvector v${testResults[db.identifier].vectorVersion} installed`
                                        : testResults[db.identifier].vectorSupported
                                        ? "pgvector available but not installed in database"
                                        : "pgvector not available in image"
                                    }
                                  >
                                    <Sparkles className="h-2.5 w-2.5 mr-1 inline text-violet-500" />
                                    {testResults[db.identifier].vectorInstalled
                                      ? `pgvector`
                                      : testResults[db.identifier].vectorSupported
                                      ? `pgvector ready`
                                      : `no pgvector`}
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/50 border-emerald-200"
                              isLoading={testingIdentifier === db.identifier}
                              onClick={() =>
                                testMutation.mutate({
                                  identifier: db.identifier,
                                  engine: db.engine,
                                  host: db.host,
                                  port: db.port,
                                  masterUsername: db.masterUsername,
                                  masterPassword: db.masterPassword,
                                  dbName: db.dbName,
                                })
                              }
                            >
                              <Activity className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                              Test Connection
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs text-blue-700 bg-blue-50/50 hover:bg-blue-100/50 border-blue-200"
                              onClick={() => setViewConnectionInstance(db)}
                            >
                              <Terminal className="h-3.5 w-3.5 mr-1 text-blue-600" />
                              Connection Details
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-red-600 hover:bg-red-50"
                              onClick={() => setInstanceToDelete(db.identifier)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Instance Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create RDS Instance</DialogTitle>
            <DialogDescription>
              Launch a relational database instance with proxy port mapping ({config.mode.toUpperCase()} mode).
            </DialogDescription>
          </DialogHeader>

          {createMutation.error ? (
            <ErrorBanner error={createMutation.error} className="mb-4" />
          ) : null}

          <form
            onSubmit={handleSubmit((values) =>
              createMutation.mutate({
                ...values,
                allocatedStorage: Number(values.allocatedStorage),
              })
            )}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                DB Instance Identifier
              </label>
              <Input
                placeholder="floci-postgres-db"
                {...register("dbInstanceIdentifier")}
                error={errors.dbInstanceIdentifier?.message}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Engine
                </label>
                <select
                  {...register("engine")}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="mariadb">MariaDB</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instance Class
                </label>
                <Input
                  placeholder="db.t3.micro"
                  {...register("dbInstanceClass")}
                  error={errors.dbInstanceClass?.message}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Master Username
                </label>
                <Input
                  placeholder="postgres"
                  {...register("masterUsername")}
                  error={errors.masterUsername?.message}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Master Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  {...register("masterUserPassword")}
                  error={errors.masterUserPassword?.message}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Allocated Storage (GB)
                </label>
                <Input
                  type="number"
                  placeholder="20"
                  {...register("allocatedStorage", { valueAsNumber: true })}
                  error={errors.allocatedStorage?.message}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Database Name
                </label>
                <Input
                  placeholder="app_db"
                  {...register("dbName")}
                  error={errors.dbName?.message}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={createMutation.isPending}>
                Create Instance
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Connection Details Modal */}
      <Dialog
        open={Boolean(viewConnectionInstance)}
        onOpenChange={(open) => !open && setViewConnectionInstance(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Connection Details</DialogTitle>
            <DialogDescription>
              Connect to <span className="font-mono font-semibold text-slate-800">{viewConnectionInstance?.identifier}</span> via {config.mode.toUpperCase()} access.
            </DialogDescription>
          </DialogHeader>

          {viewConnectionInstance ? (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded text-blue-900 flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Reachable at {viewConnectionInstance.endpoint} ({config.mode} mode).</strong>
                  <p className="text-[11px] text-blue-800 mt-0.5">Your instance master password is included directly in the connection commands below.</p>
                </div>
              </div>

              {/* Master Password */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-slate-500" />
                  Master Password
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    type={showPassword ? "text" : "password"}
                    value={viewConnectionInstance.masterPassword || "postgres"}
                    className="flex-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-2 border border-slate-200 rounded hover:bg-slate-100 text-slate-600 transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <CopyButton text={viewConnectionInstance.masterPassword || "postgres"} />
                </div>
              </div>

              {/* Endpoint */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Host Endpoint
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={viewConnectionInstance.endpoint}
                    className="flex-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-800"
                  />
                  <CopyButton text={viewConnectionInstance.endpoint} />
                </div>
              </div>

              {/* Postgres Specific Snippets */}
              {viewConnectionInstance.engine === "postgres" ? (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      psql (libpq Connection String)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={viewConnectionInstance.psqlCliCommand}
                        className="flex-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-800"
                      />
                      <CopyButton text={viewConnectionInstance.psqlCliCommand} />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      psql (Inline Password Command)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={viewConnectionInstance.pgPasswordCommand}
                        className="flex-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-800"
                      />
                      <CopyButton text={viewConnectionInstance.pgPasswordCommand} />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Application Connection URI (Prisma / DBeaver)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={viewConnectionInstance.psqlUri}
                        className="flex-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-800"
                      />
                      <CopyButton text={viewConnectionInstance.psqlUri} />
                    </div>
                  </div>

                  {/* pgvector AI & Embeddings Section */}
                  <div className="p-3 bg-violet-50/60 border border-violet-200 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-violet-900">
                        <Sparkles className="h-4 w-4 text-violet-600" />
                        <span>pgvector Support (AI & Vector Embeddings)</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs text-violet-700 bg-white hover:bg-violet-100 border-violet-300"
                        isLoading={extensionActionLoading}
                        onClick={() =>
                          extensionMutation.mutate({
                            identifier: viewConnectionInstance.identifier,
                            extension: "vector",
                            action: "enable",
                            host: viewConnectionInstance.host,
                            port: viewConnectionInstance.port,
                            masterUsername: viewConnectionInstance.masterUsername,
                            masterPassword: viewConnectionInstance.masterPassword,
                            dbName: viewConnectionInstance.dbName,
                          })
                        }
                      >
                        <Sparkles className="h-3 w-3 mr-1 text-violet-600" />
                        Enable pgvector
                      </Button>
                    </div>

                    {extensionStatusMsg ? (
                      <p className={`text-[11px] p-2 rounded ${extensionStatusMsg.startsWith("Error") ? "bg-red-100/70 text-red-800" : "bg-emerald-100/70 text-emerald-800"}`}>
                        {extensionStatusMsg}
                      </p>
                    ) : null}

                    <div>
                      <label className="block text-[11px] font-medium text-violet-950 mb-1">
                        SQL Activation & Vector Table Example:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={`CREATE EXTENSION IF NOT EXISTS vector; CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(1536));`}
                          className="flex-1 font-mono text-[11px] bg-white border border-violet-200 rounded p-1.5 text-slate-800"
                        />
                        <CopyButton text={`CREATE EXTENSION IF NOT EXISTS vector;\nCREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(1536));`} />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* MySQL / MariaDB Snippets */
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    mysql CLI Command
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={viewConnectionInstance.mysqlCliCommand}
                      className="flex-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-800"
                    />
                    <CopyButton text={viewConnectionInstance.mysqlCliCommand} />
                  </div>
                </div>
              )}

              {/* Connection Test Section */}
              {(() => {
                const result = testResults[viewConnectionInstance.identifier];
                return (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <Activity className="h-4 w-4 text-slate-500" />
                        <span>Database Health & Connectivity</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300"
                        isLoading={testingIdentifier === viewConnectionInstance.identifier}
                        onClick={() =>
                          testMutation.mutate({
                            identifier: viewConnectionInstance.identifier,
                            engine: viewConnectionInstance.engine,
                            host: viewConnectionInstance.host,
                            port: viewConnectionInstance.port,
                            masterUsername: viewConnectionInstance.masterUsername,
                            masterPassword: viewConnectionInstance.masterPassword,
                            dbName: viewConnectionInstance.dbName,
                          })
                        }
                      >
                        <Activity className="h-3 w-3 mr-1 text-emerald-600" />
                        Run Test
                      </Button>
                    </div>

                    {result ? (
                      <div
                        className={`p-2.5 rounded border text-[11px] ${
                          result.success
                            ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                            : "bg-red-50/80 border-red-200 text-red-900"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-medium">
                          {result.success ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Connection Verified ({result.latencyMs}ms latency)</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                              <span>Connection Test Failed</span>
                            </>
                          )}
                        </div>

                        {result.success ? (
                          <div className="mt-1 space-y-0.5 text-emerald-800">
                            <div>Tested Endpoint: <span className="font-mono">{result.testedEndpoint}</span></div>
                            {result.version ? <div>Server Version: <span className="font-mono">{result.version}</span></div> : null}
                            {result.vectorInstalled ? (
                              <div className="text-violet-700 font-medium">
                                pgvector: <span className="font-mono">v{result.vectorVersion || "enabled"} (Active)</span>
                              </div>
                            ) : result.vectorSupported ? (
                              <div className="text-amber-700">
                                pgvector: <span className="font-mono">Available in image (Click &quot;Enable pgvector&quot; above)</span>
                              </div>
                            ) : viewConnectionInstance.engine === "postgres" ? (
                              <div className="text-slate-600">
                                pgvector: <span className="font-mono">Not installed in base container image</span>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-1 space-y-1 text-red-800">
                            <div><strong>Error:</strong> {result.error}</div>
                            {result.hint ? <div className="text-[10px] text-red-700">{result.hint}</div> : null}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Click &quot;Run Test&quot; to probe this database endpoint directly over port {viewConnectionInstance.port}.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewConnectionInstance(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(instanceToDelete)}
        onOpenChange={(open) => !open && setInstanceToDelete(null)}
        title={`Delete Instance "${instanceToDelete}"?`}
        description="Are you sure you want to terminate and delete this database instance?"
        confirmLabel="Delete Instance"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => instanceToDelete && deleteMutation.mutate(instanceToDelete)}
      />
    </div>
  );
}
