import { NextRequest, NextResponse } from "next/server";
import { getSQSClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { sendSQSMessageSchema } from "@/lib/validations/messaging";
import {
  ReceiveMessageCommand,
  SendMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queueUrl = searchParams.get("queueUrl");
    const maxMessages = parseInt(searchParams.get("maxMessages") || "10", 10);
    const waitTimeSeconds = parseInt(searchParams.get("waitTimeSeconds") || "2", 10);

    if (!queueUrl) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "queueUrl parameter is required" } },
        { status: 400 }
      );
    }

    const sqs = getSQSClient();
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: Math.min(maxMessages, 10),
      WaitTimeSeconds: waitTimeSeconds,
      AttributeNames: ["All"],
      MessageAttributeNames: ["All"],
    });

    const response = await sqs.send(command);

    const messages = (response.Messages || []).map((msg) => ({
      messageId: msg.MessageId || "",
      receiptHandle: msg.ReceiptHandle || "",
      body: msg.Body || "",
      md5OfBody: msg.MD5OfBody || "",
      attributes: msg.Attributes || {},
      sentTimestamp: msg.Attributes?.SentTimestamp
        ? new Date(parseInt(msg.Attributes.SentTimestamp, 10)).toISOString()
        : undefined,
    }));

    return NextResponse.json({ messages, count: messages.length });
  } catch (error) {
    return handleAwsError(error, "SQS_RECEIVE_MESSAGES");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = sendSQSMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { queueUrl, messageBody, delaySeconds } = validation.data;
    const isFifo = queueUrl.includes(".fifo");

    const sqs = getSQSClient();
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: messageBody,
      DelaySeconds: isFifo ? undefined : delaySeconds,
      MessageGroupId: isFifo ? "default-group" : undefined,
      MessageDeduplicationId: isFifo ? `msg-${Date.now()}` : undefined,
    });

    const response = await sqs.send(command);

    return NextResponse.json({
      success: true,
      messageId: response.MessageId,
      md5OfMessageBody: response.MD5OfMessageBody,
    });
  } catch (error) {
    return handleAwsError(error, "SQS_SEND_MESSAGE");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queueUrl = searchParams.get("queueUrl");
    const receiptHandle = searchParams.get("receiptHandle");

    if (!queueUrl || !receiptHandle) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "queueUrl and receiptHandle are required" } },
        { status: 400 }
      );
    }

    const sqs = getSQSClient();
    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await sqs.send(command);

    return NextResponse.json({
      success: true,
      message: "Message deleted from queue",
    });
  } catch (error) {
    return handleAwsError(error, "SQS_DELETE_MESSAGE");
  }
}
