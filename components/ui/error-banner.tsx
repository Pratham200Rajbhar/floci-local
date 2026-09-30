import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";

interface ErrorBannerProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBanner({ error, onRetry, className }: ErrorBannerProps) {
  let message = "An error occurred";
  let code: string | undefined;

  if (typeof error === "string") {
    message = error;
  } else if (error && typeof error === "object") {
    const errObj = error as {
      error?: { code?: string; message?: string };
      message?: string;
      code?: string;
    };
    if (errObj.error) {
      code = errObj.error.code;
      message = errObj.error.message || message;
    } else if (errObj.message) {
      message = errObj.message;
      code = errObj.code;
    }
  }

  return (
    <div
      className={`rounded-md border border-red-200 bg-red-50 p-4 text-red-800 ${className || ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            {code ? (
              <span className="inline-block font-mono text-xs font-semibold bg-red-100 text-red-800 px-1.5 py-0.5 rounded mb-1">
                {code}
              </span>
            ) : null}
            <p className="text-sm font-medium text-red-900">{message}</p>
          </div>
        </div>
        {onRetry ? (
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
            onClick={onRetry}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}
