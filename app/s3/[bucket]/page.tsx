"use client";

import React, { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Download,
  Trash2,
  FileText,
  ChevronRight,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyButton } from "@/components/ui/copy-button";
import { formatBytes, formatDate } from "@/lib/utils";

interface S3ObjectItem {
  key: string;
  size: number;
  lastModified?: string;
  etag: string;
  storageClass: string;
  s3Uri: string;
}

interface S3ObjectsResponse {
  bucket: string;
  objects: S3ObjectItem[];
  isTruncated: boolean;
  nextContinuationToken: string | null;
}

export default function BucketDetailPage({
  params,
}: {
  params: Promise<{ bucket: string }>;
}) {
  const resolvedParams = use(params);
  const bucketName = resolvedParams.bucket;
  const queryClient = useQueryClient();

  const [continuationToken, setContinuationToken] = useState<string | undefined>(undefined);
  const [tokenHistory, setTokenHistory] = useState<string[]>([]);
  const [objectToDelete, setObjectToDelete] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<S3ObjectsResponse>({
    queryKey: ["s3-objects", bucketName, continuationToken],
    queryFn: async () => {
      const url = new URL(`/api/s3/${bucketName}/objects`, window.location.origin);
      if (continuationToken) {
        url.searchParams.set("continuationToken", continuationToken);
      }
      const res = await fetch(url.toString());
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadProgress(`Uploading ${file.name}...`);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", file.name);

      const res = await fetch(`/api/s3/${bucketName}/objects`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      setUploadProgress(null);
      queryClient.invalidateQueries({ queryKey: ["s3-objects", bucketName] });
    },
    onError: (err: { error?: { message?: string }; message?: string }) => {
      setUploadProgress(`Upload error: ${err.error?.message || err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/s3/${bucketName}/objects`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      setObjectToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["s3-objects", bucketName] });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleNextPage = () => {
    if (data?.nextContinuationToken) {
      setTokenHistory((prev) => [...prev, continuationToken || ""]);
      setContinuationToken(data.nextContinuationToken);
    }
  };

  const handlePrevPage = () => {
    const prevTokens = [...tokenHistory];
    const prevToken = prevTokens.pop();
    setTokenHistory(prevTokens);
    setContinuationToken(prevToken || undefined);
  };

  const objects = data?.objects || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/s3"
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Buckets
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {bucketName}
            </h2>
            <CopyButton text={`s3://${bucketName}`} label="Copy S3 URI" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploadMutation.isPending}
            />
            <span className="inline-flex items-center justify-center font-medium rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700 h-9 px-4 text-sm gap-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              Upload Object
            </span>
          </label>
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner error={error} onRetry={() => refetch()} /> : null}

      {/* Upload Drag and Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-200 bg-white"
        }`}
      >
        <p className="text-sm font-medium text-slate-700">
          Drag & drop files here to upload directly to <span className="font-mono">{bucketName}</span>
        </p>
        <p className="text-xs text-slate-400 mt-1">Files are stored locally in the Floci emulator volume</p>
        {uploadProgress ? (
          <p className="text-xs text-blue-600 font-semibold mt-2">{uploadProgress}</p>
        ) : null}
      </div>

      {/* Objects Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Bucket Objects</CardTitle>
            <CardDescription>Listing objects with pagination tokens</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner message="Fetching objects..." />
          ) : objects.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Bucket is empty"
                description="Upload an object to get started."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-y border-slate-200 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Object Key</th>
                    <th className="py-3 px-5">Size</th>
                    <th className="py-3 px-5">Storage Class</th>
                    <th className="py-3 px-5">Last Modified</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {objects.map((obj) => (
                    <tr key={obj.key} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs text-slate-900 font-medium">
                        <a
                          href={`/api/s3/${bucketName}/objects/download?key=${encodeURIComponent(
                            obj.key
                          )}&inline=true`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 hover:text-blue-600 transition-colors text-left group"
                          title="Open in new tab"
                        >
                          <FileText className="h-4 w-4 text-slate-400 group-hover:text-blue-500 shrink-0" />
                          <span className="truncate max-w-xs underline-offset-2 group-hover:underline">{obj.key}</span>
                        </a>
                      </td>
                      <td className="py-3.5 px-5 text-xs text-slate-600">{formatBytes(obj.size)}</td>
                      <td className="py-3.5 px-5 text-xs text-slate-600">{obj.storageClass}</td>
                      <td className="py-3.5 px-5 text-xs text-slate-600 font-mono">
                        {formatDate(obj.lastModified)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/api/s3/${bucketName}/objects/download?key=${encodeURIComponent(
                              obj.key
                            )}&inline=true`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm" className="h-8 px-2" title="Open in new tab">
                              <ExternalLink className="h-3.5 w-3.5 text-slate-600" />
                            </Button>
                          </a>
                          <CopyButton text={obj.s3Uri} label="URI" />
                          <a
                            href={`/api/s3/${bucketName}/objects/download?key=${encodeURIComponent(
                              obj.key
                            )}`}
                            download
                          >
                            <Button variant="outline" size="sm" className="h-8 px-2" title="Download file">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-600 hover:bg-red-50"
                            onClick={() => setObjectToDelete(obj.key)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {(data?.isTruncated || tokenHistory.length > 0) && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <Button
                variant="outline"
                size="sm"
                disabled={tokenHistory.length === 0}
                onClick={handlePrevPage}
              >
                Previous Page
              </Button>
              <span className="text-slate-500">
                Page {tokenHistory.length + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!data?.isTruncated}
                onClick={handleNextPage}
              >
                Next Page
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Object Confirm */}
      <ConfirmDialog
        open={Boolean(objectToDelete)}
        onOpenChange={(open) => !open && setObjectToDelete(null)}
        title={`Delete Object "${objectToDelete}"?`}
        description="Are you sure you want to permanently delete this object from the bucket?"
        confirmLabel="Delete Object"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => objectToDelete && deleteMutation.mutate(objectToDelete)}
      />
    </div>
  );
}
