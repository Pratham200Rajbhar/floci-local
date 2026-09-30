import { NextResponse } from "next/server";
import { logger } from "../logger";

export interface StandardApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function handleAwsError(error: unknown, context: string = "AWS_OPERATION"): NextResponse<StandardApiError> {
  const log = logger.child({ context });

  if (error instanceof Error) {
    const errorName = (error as { name?: string }).name || "UnknownError";
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode || 500;
    const errorMessage = error.message || "An unexpected error occurred.";

    log.error({ err: error, name: errorName, statusCode }, `Error in ${context}: ${errorMessage}`);

    // Map common AWS errors to standard HTTP status codes if not explicitly set
    let finalStatus = statusCode;
    if (finalStatus === 500) {
      if (
        errorName.includes("NotFound") ||
        errorName.includes("NoSuchBucket") ||
        errorName.includes("NoSuchKey") ||
        errorName.includes("ResourceNotFound")
      ) {
        finalStatus = 404;
      } else if (
        errorName.includes("AlreadyExists") ||
        errorName.includes("BucketAlreadyExists") ||
        errorName.includes("Duplicate")
      ) {
        finalStatus = 409;
      } else if (
        errorName.includes("InvalidParameter") ||
        errorName.includes("ValidationException")
      ) {
        finalStatus = 400;
      }
    }

    return NextResponse.json(
      {
        error: {
          code: errorName,
          message: errorMessage,
        },
      },
      { status: finalStatus }
    );
  }

  log.error({ err: error }, `Non-standard error encountered in ${context}`);

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: String(error) || "An unexpected error occurred.",
      },
    },
    { status: 500 }
  );
}
