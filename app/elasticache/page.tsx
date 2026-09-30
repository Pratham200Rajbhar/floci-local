"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Zap, Plus, Trash2, RefreshCw } from "lucide-react";
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
import { createCacheClusterSchema, type CreateCacheClusterInput } from "@/lib/validations/elasticache";

interface CacheClusterItem {
  cacheClusterId: string;
  status: string;
  engine: string;
  cacheNodeType: string;
  numCacheNodes: number;
  endpoint: string;
  host: string;
  port: number;
  isPortValid: boolean;
  redisCliCommand: string;
  createTime?: string;
}

export default function ElastiCachePage() {
  const queryClient = useQueryClient();
  const { config } = useNetworkConfig();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCacheClusterInput>({
    resolver: zodResolver(createCacheClusterSchema),
    defaultValues: {
      engine: "redis",
      cacheNodeType: "cache.t3.micro",
      numCacheNodes: 1,
    },
  });

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<{ clusters: CacheClusterItem[] }>({
    queryKey: ["elasticache-clusters"],
    queryFn: async () => {
      const res = await fetch("/api/elasticache");
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateCacheClusterInput) => {
      const res = await fetch("/api/elasticache", {
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
      queryClient.invalidateQueries({ queryKey: ["elasticache-clusters"] });
      setCreateDialogOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (cacheClusterId: string) => {
      const res = await fetch("/api/elasticache", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cacheClusterId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elasticache-clusters"] });
      setClusterToDelete(null);
    },
  });

  const clusters = data?.clusters || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">ElastiCache Clusters</h2>
          <p className="text-sm text-slate-500 mt-1">
            Provision Redis & Valkey in-memory caching clusters reachable via {config.mode.toUpperCase()} access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Cluster
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
          <CardTitle>Clusters ({clusters.length})</CardTitle>
          <CardDescription>
            All cache clusters published on host <code className="font-semibold text-slate-700">{config.host}</code> (ports 6379–6399)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner message="Fetching ElastiCache clusters..." />
          ) : clusters.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No cache clusters found"
                description="Launch a Redis cluster to enable caching."
                actionLabel="Create Cluster"
                onAction={() => setCreateDialogOpen(true)}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-y border-slate-200 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Cluster ID</th>
                    <th className="py-3 px-5">Engine</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Cache Endpoint</th>
                    <th className="py-3 px-5">CLI / Connection Command</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clusters.map((c) => {
                    const isAvailable = c.status === "available";
                    return (
                      <tr key={c.cacheClusterId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-slate-400" />
                            <span>{c.cacheClusterId}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs">
                          <Badge variant="outline" className="uppercase font-mono">
                            {c.engine}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-xs">
                          <Badge variant={isAvailable ? "success" : "warning"}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-xs font-mono text-slate-700">
                          <div className="flex items-center gap-2">
                            <span>{c.endpoint}</span>
                            <CopyButton text={c.endpoint} label="Copy" />
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs">
                          <div className="flex items-center gap-2">
                            <code className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono text-slate-800">
                              {c.redisCliCommand}
                            </code>
                            <CopyButton text={c.redisCliCommand} />
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-600 hover:bg-red-50"
                            onClick={() => setClusterToDelete(c.cacheClusterId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

      {/* Create Cluster Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create ElastiCache Cluster</DialogTitle>
            <DialogDescription>
              Deploy an in-memory Redis or Valkey cache cluster with proxy port mapping.
            </DialogDescription>
          </DialogHeader>

          {createMutation.error ? (
            <ErrorBanner error={createMutation.error} className="mb-4" />
          ) : null}

          <form
            onSubmit={handleSubmit((values) =>
              createMutation.mutate({
                ...values,
                numCacheNodes: Number(values.numCacheNodes),
              })
            )}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cluster ID
              </label>
              <Input
                placeholder="my-redis-cache"
                {...register("cacheClusterId")}
                error={errors.cacheClusterId?.message}
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
                  <option value="redis">Redis</option>
                  <option value="valkey">Valkey</option>
                  <option value="memcached">Memcached</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Node Type
                </label>
                <Input
                  placeholder="cache.t3.micro"
                  {...register("cacheNodeType")}
                  error={errors.cacheNodeType?.message}
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
                Create Cluster
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(clusterToDelete)}
        onOpenChange={(open) => !open && setClusterToDelete(null)}
        title={`Delete Cluster "${clusterToDelete}"?`}
        description="Are you sure you want to delete this cache cluster? Cached keys will be lost."
        confirmLabel="Delete Cluster"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => clusterToDelete && deleteMutation.mutate(clusterToDelete)}
      />
    </div>
  );
}
