import { NextRequest, NextResponse } from "next/server";
import { getSNSClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { publishSNSTopicSchema } from "@/lib/validations/messaging";
import { PublishCommand } from "@aws-sdk/client-sns";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = publishSNSTopicSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { topicArn, message, subject } = validation.data;
    const isFifo = topicArn.includes(".fifo");

    const sns = getSNSClient();
    const command = new PublishCommand({
      TopicArn: topicArn,
      Message: message,
      Subject: subject,
      MessageGroupId: isFifo ? "default-group" : undefined,
      MessageDeduplicationId: isFifo ? `msg-${Date.now()}` : undefined,
    });

    const response = await sns.send(command);

    return NextResponse.json({
      success: true,
      messageId: response.MessageId,
      sequenceNumber: response.SequenceNumber,
    });
  } catch (error) {
    return handleAwsError(error, "SNS_PUBLISH_TOPIC");
  }
}
