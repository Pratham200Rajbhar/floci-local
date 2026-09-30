import { NextRequest, NextResponse } from "next/server";
import { getSNSClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { createSNSTopicSchema } from "@/lib/validations/messaging";
import {
  ListTopicsCommand,
  CreateTopicCommand,
  DeleteTopicCommand,
} from "@aws-sdk/client-sns";

export async function GET() {
  try {
    const sns = getSNSClient();
    const command = new ListTopicsCommand({});
    const response = await sns.send(command);

    const topics = (response.Topics || []).map((t) => {
      const arn = t.TopicArn || "";
      const name = arn.split(":").pop() || arn;
      const isFifo = name.endsWith(".fifo");
      return {
        topicArn: arn,
        name,
        isFifo,
      };
    });

    return NextResponse.json({ topics, count: topics.length });
  } catch (error) {
    return handleAwsError(error, "SNS_LIST_TOPICS");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createSNSTopicSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { topicName, isFifo } = validation.data;
    const finalTopicName = isFifo && !topicName.endsWith(".fifo") ? `${topicName}.fifo` : topicName;

    const sns = getSNSClient();
    const command = new CreateTopicCommand({
      Name: finalTopicName,
      Attributes: isFifo
        ? {
            FifoTopic: "true",
            ContentBasedDeduplication: "true",
          }
        : undefined,
    });

    const response = await sns.send(command);

    return NextResponse.json({
      success: true,
      topicArn: response.TopicArn,
      topicName: finalTopicName,
    });
  } catch (error) {
    return handleAwsError(error, "SNS_CREATE_TOPIC");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topicArn = searchParams.get("topicArn");

    if (!topicArn) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "topicArn parameter is required" } },
        { status: 400 }
      );
    }

    const sns = getSNSClient();
    const command = new DeleteTopicCommand({
      TopicArn: topicArn,
    });

    await sns.send(command);

    return NextResponse.json({
      success: true,
      message: `Topic ${topicArn} deleted successfully`,
    });
  } catch (error) {
    return handleAwsError(error, "SNS_DELETE_TOPIC");
  }
}
