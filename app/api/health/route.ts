import { NextResponse } from "next/server";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { awsConfig } from "@/lib/aws/config";
import { handleAwsError } from "@/lib/aws/error-handler";
import { getS3Client } from "@/lib/aws/clients";
import { getServerNetworkDiagnostics } from "@/lib/floci-network-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics = getServerNetworkDiagnostics();
  const publicEndpoint = diagnostics.apiEndpoint;

  try {
    const healthUrl = `${awsConfig.FLOCI_ENDPOINT}/_floci/health`;
    
    // Attempt to probe Floci health endpoint
    try {
      const flociResponse = await fetch(healthUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });

      if (flociResponse.ok) {
        const body = await flociResponse.json();
        return NextResponse.json({
          status: "UP",
          networkStatus: diagnostics.mode,
          publicEndpoint,
          version: body.version || "1.0.0",
          services: body.services || {},
          uptime: body.uptime,
          diagnostics,
        });
      }
    } catch {
      // Fallback: Check if Floci responds to standard S3 ListBuckets
      const s3 = getS3Client();
      await s3.send(new ListBucketsCommand({}));
      return NextResponse.json({
        status: "UP",
        networkStatus: diagnostics.mode,
        publicEndpoint,
        version: "floci-emulator",
        services: { s3: "available" },
        diagnostics,
      });
    }

    return NextResponse.json({
      status: "DOWN",
      networkStatus: diagnostics.mode,
      publicEndpoint,
      version: "unavailable",
      services: {},
      diagnostics,
    });
  } catch (error) {
    return NextResponse.json({
      status: "DOWN",
      networkStatus: diagnostics.mode,
      publicEndpoint,
      version: "unavailable",
      error: error instanceof Error ? error.message : "Unreachable",
      diagnostics,
    });
  }
}

export async function POST() {
  try {
    const resetUrl = `${awsConfig.FLOCI_ENDPOINT}/_floci/reset`;
    const response = await fetch(resetUrl, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: "State reset request sent (or Floci returned non-200)" },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true, message: "Floci state successfully reset" });
  } catch (error) {
    return handleAwsError(error, "HEALTH_RESET");
  }
}
