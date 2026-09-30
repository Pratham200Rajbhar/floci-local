import { NextRequest, NextResponse } from "next/server";
import { getS3Client } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { getMimeType } from "@/lib/mime-types";
import { GetObjectCommand } from "@aws-sdk/client-s3";

interface RouteParams {
  params: Promise<{ bucket: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { bucket } = await params;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const isInline = searchParams.get("inline") === "true";

    if (!key) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "Object key parameter is required" } },
        { status: 400 }
      );
    }

    const s3 = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3.send(command);

    if (!response.Body) {
      return NextResponse.json(
        { error: { code: "NoSuchKey", message: "Object body is empty" } },
        { status: 404 }
      );
    }

    const byteArray = await response.Body.transformToByteArray();
    const filename = key.split("/").pop() || key;
    const contentType = getMimeType(filename, response.ContentType);

    const contentDisposition = isInline
      ? `inline; filename="${encodeURIComponent(filename)}"`
      : `attachment; filename="${encodeURIComponent(filename)}"`;

    return new Response(Buffer.from(byteArray), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Content-Length": byteArray.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return handleAwsError(error, "S3_DOWNLOAD_OBJECT");
  }
}
