"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Cpu, Plus, Play, Trash2, Code2, RefreshCw } from "lucide-react";
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
import { createLambdaFunctionSchema, type CreateLambdaFunctionInput } from "@/lib/validations/lambda";
import { formatBytes } from "@/lib/utils";

interface LambdaFunctionItem {
  functionName: string;
  runtime: string;
  handler: string;
  codeSize: number;
  description?: string;
  lastModified?: string;
  arn: string;
}

export default function LambdaPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [functionToDelete, setFunctionToDelete] = useState<string | null>(null);
  const [activeInvokeFunction, setActiveInvokeFunction] = useState<string | null>(null);
  const [payloadInput, setPayloadInput] = useState<string>('{\n  "key": "value"\n}');
  const [invokeResult, setInvokeResult] = useState<unknown>(null);
  const [zipBase64, setZipBase64] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateLambdaFunctionInput>({
    resolver: zodResolver(createLambdaFunctionSchema),
    defaultValues: {
      runtime: "nodejs20.x",
      handler: "index.handler",
    },
  });

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<{ functions: LambdaFunctionItem[] }>({
    queryKey: ["lambda-functions"],
    queryFn: async () => {
      const res = await fetch("/api/lambda");
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
  });

  // Handle Zip file input
  const handleZipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] || result;
        setZipBase64(base64);
        setValue("codeZipBase64", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: CreateLambdaFunctionInput) => {
      const res = await fetch("/api/lambda", {
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
      queryClient.invalidateQueries({ queryKey: ["lambda-functions"] });
      setCreateDialogOpen(false);
      reset();
      setZipBase64("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (functionName: string) => {
      const res = await fetch(`/api/lambda?functionName=${encodeURIComponent(functionName)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lambda-functions"] });
      setFunctionToDelete(null);
    },
  });

  const invokeMutation = useMutation({
    mutationFn: async ({ fnName, payload }: { fnName: string; payload: string }) => {
      const res = await fetch(`/api/lambda/${encodeURIComponent(fnName)}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    onSuccess: (data) => {
      setInvokeResult(data);
    },
    onError: (err) => {
      setInvokeResult({ error: err });
    },
  });

  const functions = data?.functions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Lambda Functions</h2>
          <p className="text-sm text-slate-500 mt-1">
            Deploy serverless functions and test live invocations with JSON payloads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Function
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner error={error} onRetry={() => refetch()} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Function List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Functions ({functions.length})</CardTitle>
              <CardDescription>Serverless functions deployed to Floci</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <LoadingSpinner message="Fetching Lambda functions..." />
              ) : functions.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No functions found"
                    description="Upload a ZIP package to create a Lambda function."
                    actionLabel="Create Function"
                    onAction={() => setCreateDialogOpen(true)}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 border-y border-slate-200 text-xs font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-5">Function Name</th>
                        <th className="py-3 px-5">Runtime</th>
                        <th className="py-3 px-5">Handler</th>
                        <th className="py-3 px-5">Size</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {functions.map((fn) => {
                        const isSelected = activeInvokeFunction === fn.functionName;
                        return (
                          <tr
                            key={fn.functionName}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isSelected ? "bg-blue-50/50" : ""
                            }`}
                          >
                            <td className="py-3.5 px-5 font-semibold text-slate-900 font-mono text-xs">
                              <div className="flex items-center gap-2">
                                <Cpu className="h-4 w-4 text-slate-400" />
                                <span>{fn.functionName}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-5 text-xs">
                              <Badge variant="outline">{fn.runtime}</Badge>
                            </td>
                            <td className="py-3.5 px-5 text-xs font-mono text-slate-600">
                              {fn.handler}
                            </td>
                            <td className="py-3.5 px-5 text-xs text-slate-600">
                              {formatBytes(fn.codeSize)}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant={isSelected ? "primary" : "outline"}
                                  size="sm"
                                  className="h-8 px-2.5"
                                  onClick={() => {
                                    setActiveInvokeFunction(fn.functionName);
                                    setInvokeResult(null);
                                  }}
                                >
                                  <Play className="h-3.5 w-3.5 mr-1" />
                                  Test
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-red-600 hover:bg-red-50"
                                  onClick={() => setFunctionToDelete(fn.functionName)}
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
        </div>

        {/* Function Invocation Panel */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-blue-600" />
                <CardTitle>Invoke Test</CardTitle>
              </div>
              <CardDescription>
                {activeInvokeFunction
                  ? `Invoking: ${activeInvokeFunction}`
                  : "Select a function to test payload"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Event JSON Payload
                </label>
                <textarea
                  value={payloadInput}
                  onChange={(e) => setPayloadInput(e.target.value)}
                  rows={6}
                  disabled={!activeInvokeFunction}
                  className="w-full font-mono text-xs rounded-md border border-slate-300 p-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <Button
                disabled={!activeInvokeFunction}
                isLoading={invokeMutation.isPending}
                size="sm"
                className="w-full"
                onClick={() => {
                  if (activeInvokeFunction) {
                    invokeMutation.mutate({
                      fnName: activeInvokeFunction,
                      payload: payloadInput,
                    });
                  }
                }}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Execute Function
              </Button>

              {invokeResult !== null && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Invocation Response
                    </label>
                    <CopyButton
                      text={
                        typeof invokeResult === "string"
                          ? invokeResult
                          : JSON.stringify(invokeResult, null, 2)
                      }
                      label="Copy"
                    />
                  </div>
                  <pre className="p-3 bg-slate-50 text-slate-800 font-mono text-xs rounded-md overflow-x-auto max-h-60 border border-slate-200">
                    {JSON.stringify(invokeResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Function Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy Lambda Function</DialogTitle>
            <DialogDescription>
              Upload a ZIP containing handler logic to register with Floci.
            </DialogDescription>
          </DialogHeader>

          {createMutation.error ? (
            <ErrorBanner error={createMutation.error} className="mb-4" />
          ) : null}

          <form
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Function Name
              </label>
              <Input
                placeholder="my-function"
                {...register("functionName")}
                error={errors.functionName?.message}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Runtime
                </label>
                <select
                  {...register("runtime")}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="nodejs20.x">Node.js 20.x</option>
                  <option value="nodejs18.x">Node.js 18.x</option>
                  <option value="python3.12">Python 3.12</option>
                  <option value="python3.11">Python 3.11</option>
                  <option value="python3.10">Python 3.10</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Handler Name
                </label>
                <Input
                  placeholder="index.handler"
                  {...register("handler")}
                  error={errors.handler?.message}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Code ZIP File (.zip)
              </label>
              <input
                type="file"
                accept=".zip"
                onChange={handleZipFileChange}
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs file:border-0 file:bg-transparent file:text-xs file:font-semibold"
              />
              {errors.codeZipBase64?.message ? (
                <p className="text-xs text-red-600 mt-1">{errors.codeZipBase64.message}</p>
              ) : null}
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
              <Button
                type="submit"
                size="sm"
                disabled={!zipBase64}
                isLoading={createMutation.isPending}
              >
                Deploy Function
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(functionToDelete)}
        onOpenChange={(open) => !open && setFunctionToDelete(null)}
        title={`Delete Function "${functionToDelete}"?`}
        description="Are you sure you want to permanently delete this Lambda function?"
        confirmLabel="Delete Function"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => functionToDelete && deleteMutation.mutate(functionToDelete)}
      />
    </div>
  );
}
