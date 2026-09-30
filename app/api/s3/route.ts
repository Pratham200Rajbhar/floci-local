import { NextRequest, NextResponse } from "next/server";
import { getS3Client } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { createBucketSchema, deleteBucketSchema } from "@/lib/validations/s3";
import {
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";

export async function GET() {
  try {
    const s3 = getS3Client();
    const command = new ListBucketsCommand({});
    const response = await s3.send(command);

    const buckets = (response.Buckets || []).map((bucket) => ({
      name: bucket.Name || "",
      creationDate: bucket.CreationDate,
    }));

    return NextResponse.json({ buckets, count: buckets.length });
  } catch (error) {
    return handleAwsError(error, "S3_LIST_BUCKETS");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createBucketSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const s3 = getS3Client();
    const command = new CreateBucketCommand({
      Bucket: validation.data.bucketName,
    });
    await s3.send(command);

    return NextResponse.json({
      success: true,
      bucket: {
        name: validation.data.bucketName,
        creationDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleAwsError(error, "S3_CREATE_BUCKET");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = deleteBucketSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const s3 = getS3Client();
    const command = new DeleteBucketCommand({
      Bucket: validation.data.bucketName,
    });
    await s3.send(command);

    return NextResponse.json({
      success: true,
      message: `Bucket ${validation.data.bucketName} deleted successfully`,
    });
  } catch (error) {
    return handleAwsError(error, "S3_DELETE_BUCKET");
  }
}
