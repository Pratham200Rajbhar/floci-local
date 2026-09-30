import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, ListBucketsCommand, CreateBucketCommand, DeleteBucketCommand } from "@aws-sdk/client-s3";
import { GET, POST, DELETE } from "@/app/api/s3/route";
import { NextRequest } from "next/server";

const s3Mock = mockClient(S3Client);

describe("S3 API Route Handlers", () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it("GET /api/s3 returns list of buckets", async () => {
    s3Mock.on(ListBucketsCommand).resolves({
      Buckets: [
        { Name: "test-bucket-1", CreationDate: new Date("2026-01-01T00:00:00Z") },
        { Name: "test-bucket-2", CreationDate: new Date("2026-01-02T00:00:00Z") },
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.buckets).toHaveLength(2);
    expect(data.buckets[0].name).toBe("test-bucket-1");
  });

  it("POST /api/s3 creates a bucket with valid name", async () => {
    s3Mock.on(CreateBucketCommand).resolves({});

    const req = new NextRequest("http://localhost:3000/api/s3", {
      method: "POST",
      body: JSON.stringify({ bucketName: "valid-bucket-name" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.bucket.name).toBe("valid-bucket-name");
  });

  it("POST /api/s3 rejects invalid bucket name", async () => {
    const req = new NextRequest("http://localhost:3000/api/s3", {
      method: "POST",
      body: JSON.stringify({ bucketName: "INVALID_UPPERCASE" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("DELETE /api/s3 deletes a bucket", async () => {
    s3Mock.on(DeleteBucketCommand).resolves({});

    const req = new NextRequest("http://localhost:3000/api/s3", {
      method: "DELETE",
      body: JSON.stringify({ bucketName: "my-bucket" }),
    });

    const response = await DELETE(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
