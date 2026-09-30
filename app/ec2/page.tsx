"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Server, Plus, Play, Square, Trash2, RefreshCw } from "lucide-react";
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
import { launchEC2InstanceSchema, type LaunchEC2InstanceInput } from "@/lib/validations/ec2";

interface EC2InstanceItem {
  instanceId: string;
  state: string;
  instanceType: string;
  imageId: string;
  launchTime?: string;
  publicIpAddress?: string;
  privateIpAddress?: string;
  internalContainerAddress?: string;
  sshPort: number;
  isPortValid: boolean;
  sshCommand: string;
}

export default function EC2Page() {
  const queryClient = useQueryClient();
  const { config } = useNetworkConfig();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [instanceToTerminate, setInstanceToTerminate] = useState<string | null>(null);
  const [showTerminated, setShowTerminated] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LaunchEC2InstanceInput>({
    resolver: zodResolver(launchEC2InstanceSchema),
    defaultValues: {
      imageId: "ami-12345678",
      instanceType: "t2.micro",
      minCount: 1,
      maxCount: 1,
    },
  });

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<{ instances: EC2InstanceItem[] }>({
    queryKey: ["ec2-instances"],
    queryFn: async () => {
      const res = await fetch("/api/ec2");
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    refetchInterval: 8000,
  });

  // Launch Mutation
  const launchMutation = useMutation({
    mutationFn: async (values: LaunchEC2InstanceInput) => {
      const res = await fetch("/api/ec2", {
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
      queryClient.invalidateQueries({ queryKey: ["ec2-instances"] });
      setCreateDialogOpen(false);
      reset();
    },
  });

  // Action Mutation with Optimistic UI Update
  const actionMutation = useMutation({
    mutationFn: async ({ instanceId, action }: { instanceId: string; action: string }) => {
      const res = await fetch(`/api/ec2/${instanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    onMutate: async ({ instanceId, action }) => {
      await queryClient.cancelQueries({ queryKey: ["ec2-instances"] });
      const previousData = queryClient.getQueryData<{ instances: EC2InstanceItem[] }>(["ec2-instances"]);

      if (previousData) {
        const targetState = action === "start" ? "running" : action === "stop" ? "stopped" : "terminated";
        queryClient.setQueryData(["ec2-instances"], {
          ...previousData,
          instances: previousData.instances.map((inst) =>
            inst.instanceId === instanceId ? { ...inst, state: targetState } : inst
          ),
        });
      }

      return { previousData };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["ec2-instances"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ec2-instances"] });
      setInstanceToTerminate(null);
    },
  });

  const instances = data?.instances || [];
  const terminatedCount = instances.filter(
    (inst) => inst.state === "terminated" || inst.state === "shutting-down"
  ).length;
  const displayedInstances = showTerminated
    ? instances
    : instances.filter(
        (inst) => inst.state !== "terminated" && inst.state !== "shutting-down"
      );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">EC2 Instances</h2>
          <p className="text-sm text-slate-500 mt-1">
            Launch virtual servers with {config.mode.toUpperCase()}-accessible port-forwarded SSH access (ports 2200–2299).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Launch Instance
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner error={error} onRetry={() => refetch()} /> : null}
      {actionMutation.error ? (
        <ErrorBanner error={actionMutation.error} className="mb-4" />
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Instances ({displayedInstances.length})</CardTitle>
            <CardDescription>
              All virtual machines published on host <code className="font-semibold text-slate-700">{config.host}</code> (SSH ports 2200–2299)
            </CardDescription>
          </div>
          {terminatedCount > 0 && (
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTerminated}
                onChange={(e) => setShowTerminated(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              Show Terminated ({terminatedCount})
            </label>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner message="Fetching EC2 instances..." />
          ) : displayedInstances.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No EC2 instances running"
                description="Launch an instance to get started."
                actionLabel="Launch Instance"
                onAction={() => setCreateDialogOpen(true)}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-y border-slate-200 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Instance ID</th>
                    <th className="py-3 px-5">State</th>
                    <th className="py-3 px-5">Type & AMI</th>
                    <th className="py-3 px-5">SSH Command</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedInstances.map((inst) => {
                    const isRunning = inst.state === "running";
                    const isStopped = inst.state === "stopped";
                    const isTerminated = inst.state === "terminated" || inst.state === "shutting-down";
                    const isTransitioning = inst.state === "pending" || inst.state === "stopping" || inst.state === "rebooting";

                    return (
                      <tr key={inst.instanceId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-slate-400" />
                            <span>{inst.instanceId}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs">
                          <Badge
                            variant={
                              isRunning
                                ? "success"
                                : isStopped
                                ? "warning"
                                : isTerminated
                                ? "danger"
                                : "default"
                            }
                          >
                            {inst.state}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-slate-600">
                          <span className="font-semibold">{inst.instanceType}</span>
                          <span className="text-slate-400 ml-1">({inst.imageId})</span>
                          {inst.internalContainerAddress ? (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Internal: {inst.internalContainerAddress}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3.5 px-5 text-xs">
                          {isRunning && inst.isPortValid ? (
                            <div className="flex items-center gap-2">
                              <code className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono text-slate-800">
                                {inst.sshCommand}
                              </code>
                              <CopyButton text={inst.sshCommand} />
                            </div>
                          ) : isRunning ? (
                            <span className="text-amber-600 text-xs italic">
                              SSH endpoint not available yet
                            </span>
                          ) : isTerminated ? (
                            <span className="text-slate-400 text-xs italic">Terminated</span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Instance stopped</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isRunning && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-amber-600 hover:bg-amber-50"
                                onClick={() =>
                                  actionMutation.mutate({ instanceId: inst.instanceId, action: "stop" })
                                }
                                isLoading={actionMutation.isPending}
                                title="Stop Instance"
                              >
                                <Square className="h-3.5 w-3.5 mr-1" />
                                Stop
                              </Button>
                            )}
                            {isStopped && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-emerald-600 hover:bg-emerald-50"
                                onClick={() =>
                                  actionMutation.mutate({ instanceId: inst.instanceId, action: "start" })
                                }
                                isLoading={actionMutation.isPending}
                                title="Start Instance"
                              >
                                <Play className="h-3.5 w-3.5 mr-1" />
                                Start
                              </Button>
                            )}
                            {isTransitioning && (
                              <span className="text-[11px] text-slate-400 italic px-2">Updating...</span>
                            )}
                            {!isTerminated && !isTransitioning && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-red-600 hover:bg-red-50"
                                onClick={() => setInstanceToTerminate(inst.instanceId)}
                                title="Terminate Instance"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {isTerminated && (
                              <span className="text-[11px] text-slate-400 italic px-2">Terminated</span>
                            )}
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

      {/* Launch Instance Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch EC2 Instance</DialogTitle>
            <DialogDescription>
              Deploy emulated virtual instances mapped to published host SSH proxy ports.
            </DialogDescription>
          </DialogHeader>

          {launchMutation.error ? (
            <ErrorBanner error={launchMutation.error} className="mb-4" />
          ) : null}

          <form
            onSubmit={handleSubmit((values) =>
              launchMutation.mutate({
                ...values,
                minCount: Number(values.minCount),
                maxCount: Number(values.maxCount),
              })
            )}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                AMI ID
              </label>
              <Input
                placeholder="ami-12345678"
                {...register("imageId")}
                error={errors.imageId?.message}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instance Type
                </label>
                <select
                  {...register("instanceType")}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="t2.micro">t2.micro</option>
                  <option value="t2.small">t2.small</option>
                  <option value="t3.micro">t3.micro</option>
                  <option value="t3.medium">t3.medium</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instance Count
                </label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  {...register("minCount", { valueAsNumber: true })}
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
              <Button type="submit" size="sm" isLoading={launchMutation.isPending}>
                Launch
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Terminate Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(instanceToTerminate)}
        onOpenChange={(open) => !open && setInstanceToTerminate(null)}
        title={`Terminate Instance "${instanceToTerminate}"?`}
        description="Are you sure you want to permanently terminate this virtual machine instance?"
        confirmLabel="Terminate Instance"
        variant="destructive"
        isLoading={actionMutation.isPending}
        onConfirm={() =>
          instanceToTerminate &&
          actionMutation.mutate({ instanceId: instanceToTerminate, action: "terminate" })
        }
      />
    </div>
  );
}
