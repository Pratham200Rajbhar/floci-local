import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { SQSClient, ListQueuesCommand, CreateQueueCommand } from "@aws-sdk/client-sqs";
import { GET, POST } from "@/app/api/sqs/route";
import { NextRequest } from "next/server";

const sqsMock = mockClient(SQSClient);

describe("SQS API Route Handlers", () => {
  beforeEach(() => {
    sqsMock.reset();
  });

  it("GET /api/sqs returns list of queues", async () => {
    sqsMock.on(ListQueuesCommand).resolves({
      QueueUrls: ["http://localhost:4566/000000000000/my-test-queue"],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.queues).toHaveLength(1);
    expect(data.queues[0].name).toBe("my-test-queue");
  });

  it("POST /api/sqs creates queue", async () => {
    sqsMock.on(CreateQueueCommand).resolves({
      QueueUrl: "http://localhost:4566/000000000000/orders-queue",
    });

    const req = new NextRequest("http://localhost:3000/api/sqs", {
      method: "POST",
      body: JSON.stringify({
        queueName: "orders-queue",
        isFifo: false,
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.queueName).toBe("orders-queue");
  });
});
