import { NextRequest, NextResponse } from "next/server";
import { getLambdaClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { InvokeCommand } from "@aws-sdk/client-lambda";

interface RouteParams {
  params: Promise<{ functionName: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { functionName } = await params;
    const body = await request.json().catch(() => ({}));
    const payloadString = typeof body.payload === "string" ? body.payload : JSON.stringify(body.payload ?? {});

    const lambda = getLambdaClient();
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(payloadString),
    });

    const response = await lambda.send(command);
    const responsePayload = response.Payload ? Buffer.from(response.Payload).toString("utf-8") : "";

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(responsePayload);
    } catch {
      parsedPayload = responsePayload;
    }

    return NextResponse.json({
      statusCode: response.StatusCode || 200,
      functionError: response.FunctionError || null,
      executedVersion: response.ExecutedVersion || "$LATEST",
      payload: parsedPayload,
      rawPayload: responsePayload,
    });
  } catch (error) {
    return handleAwsError(error, "LAMBDA_INVOKE_FUNCTION");
  }
}
