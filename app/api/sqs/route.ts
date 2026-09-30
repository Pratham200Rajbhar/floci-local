import { NextRequest, NextResponse } from "next/server";
import { getSQSClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { createSQSQueueSchema } from "@/lib/validations/messaging";
import {
  ListQueuesCommand,
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";

export async function GET() {
  try {
    const sqs = getSQSClient();
    const command = new ListQueuesCommand({});
    const response = await sqs.send(command);

    const queueUrls = response.QueueUrls || [];
    const queues = await Promise.all(
      queueUrls.map(async (url) => {
        const name = url.split("/").pop() || url;
        let approximateNumberOfMessages = 0;
        let isFifo = name.endsWith(".fifo");

        try {
          const attrCmd = new GetQueueAttributesCommand({
            QueueUrl: url,
            AttributeNames: ["ApproximateNumberOfMessages", "FifoQueue"],
          });
          const attrs = await sqs.send(attrCmd);
          approximateNumberOfMessages = parseInt(
            attrs.Attributes?.ApproximateNumberOfMessages || "0",
            10
          );
          isFifo = attrs.Attributes?.FifoQueue === "true" || isFifo;
        } catch {
          // Keep defaults if attributes fail
        }

        return {
          name,
          url,
          approximateNumberOfMessages,
          isFifo,
        };
      })
    );

    return NextResponse.json({ queues, count: queues.length });
  } catch (error) {
    return handleAwsError(error, "SQS_LIST_QUEUES");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createSQSQueueSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { queueName, isFifo } = validation.data;
    const finalQueueName = isFifo && !queueName.endsWith(".fifo") ? `${queueName}.fifo` : queueName;

    const sqs = getSQSClient();
    const command = new CreateQueueCommand({
      QueueName: finalQueueName,
      Attributes: isFifo
        ? {
            FifoQueue: "true",
            ContentBasedDeduplication: "true",
          }
        : undefined,
    });

    const response = await sqs.send(command);

    return NextResponse.json({
      success: true,
      queueUrl: response.QueueUrl,
      queueName: finalQueueName,
    });
  } catch (error) {
    return handleAwsError(error, "SQS_CREATE_QUEUE");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queueUrl = searchParams.get("queueUrl");

    if (!queueUrl) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "queueUrl parameter is required" } },
        { status: 400 }
      );
    }

    const sqs = getSQSClient();
    const command = new DeleteQueueCommand({
      QueueUrl: queueUrl,
    });

    await sqs.send(command);

    return NextResponse.json({
      success: true,
      message: `Queue ${queueUrl} deleted successfully`,
    });
  } catch (error) {
    return handleAwsError(error, "SQS_DELETE_QUEUE");
  }
}
