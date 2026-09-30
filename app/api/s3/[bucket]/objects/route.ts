import { NextRequest, NextResponse } from "next/server";
import { getS3Client } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { deleteObjectSchema } from "@/lib/validations/s3";
import {
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

interface RouteParams {
  params: Promise<{ bucket: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { bucket } = await params;
    const { searchParams } = new URL(request.url);
    const continuationToken = searchParams.get("continuationToken") || undefined;
    const maxKeys = parseInt(searchParams.get("maxKeys") || "50", 10);
    const prefix = searchParams.get("prefix") || undefined;

    const s3 = getS3Client();
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
      MaxKeys: Math.min(maxKeys, 100),
      Prefix: prefix,
    });

    const response = await s3.send(command);

    const objects = (response.Contents || []).map((item) => ({
      key: item.Key || "",
      size: item.Size || 0,
      lastModified: item.LastModified,
      etag: item.ETag?.replace(/"/g, "") || "",
      storageClass: item.StorageClass || "STANDARD",
      s3Uri: `s3://${bucket}/${item.Key}`,
    }));

    return NextResponse.json({
      bucket,
      objects,
      isTruncated: response.IsTruncated || false,
      nextContinuationToken: response.NextContinuationToken || null,
      keyCount: response.KeyCount || 0,
    });
  } catch (error) {
    return handleAwsError(error, "S3_LIST_OBJECTS");
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { bucket } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const key = (formData.get("key") as string | null) || file?.name;

    if (!file || !key) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "File and object key are required" } },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const s3 = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    });

    await s3.send(command);

    return NextResponse.json({
      success: true,
      object: {
        key,
        size: buffer.length,
        s3Uri: `s3://${bucket}/${key}`,
        lastModified: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleAwsError(error, "S3_PUT_OBJECT");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { bucket } = await params;
    const body = await request.json();
    const validation = deleteObjectSchema.safeParse({ ...body, bucketName: bucket });

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const s3 = getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: validation.data.key,
    });
    await s3.send(command);

    return NextResponse.json({
      success: true,
      message: `Object ${validation.data.key} deleted successfully`,
    });
  } catch (error) {
    return handleAwsError(error, "S3_DELETE_OBJECT");
  }
}
