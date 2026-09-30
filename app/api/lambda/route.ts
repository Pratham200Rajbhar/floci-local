import { NextRequest, NextResponse } from "next/server";
import { getLambdaClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { createLambdaFunctionSchema } from "@/lib/validations/lambda";
import {
  ListFunctionsCommand,
  CreateFunctionCommand,
  DeleteFunctionCommand,
} from "@aws-sdk/client-lambda";

export async function GET() {
  try {
    const lambda = getLambdaClient();
    const command = new ListFunctionsCommand({});
    const response = await lambda.send(command);

    const functions = (response.Functions || []).map((fn) => ({
      functionName: fn.FunctionName || "",
      runtime: fn.Runtime || "",
      handler: fn.Handler || "",
      codeSize: fn.CodeSize || 0,
      description: fn.Description || "",
      lastModified: fn.LastModified,
      state: fn.State || "Active",
      arn: fn.FunctionArn || "",
    }));

    return NextResponse.json({ functions, count: functions.length });
  } catch (error) {
    return handleAwsError(error, "LAMBDA_LIST_FUNCTIONS");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createLambdaFunctionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { functionName, runtime, handler, codeZipBase64, description } = validation.data;
    const zipBuffer = Buffer.from(codeZipBase64, "base64");

    const lambda = getLambdaClient();
    const command = new CreateFunctionCommand({
      FunctionName: functionName,
      Runtime: runtime as never,
      Role: "arn:aws:iam::000000000000:role/floci-lambda-role",
      Handler: handler,
      Code: {
        ZipFile: zipBuffer,
      },
      Description: description,
    });

    const response = await lambda.send(command);

    return NextResponse.json({
      success: true,
      function: {
        functionName: response.FunctionName,
        runtime: response.Runtime,
        handler: response.Handler,
        arn: response.FunctionArn,
      },
    });
  } catch (error) {
    return handleAwsError(error, "LAMBDA_CREATE_FUNCTION");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const functionName = searchParams.get("functionName");

    if (!functionName) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "functionName parameter is required" } },
        { status: 400 }
      );
    }

    const lambda = getLambdaClient();
    const command = new DeleteFunctionCommand({
      FunctionName: functionName,
    });

    await lambda.send(command);

    return NextResponse.json({
      success: true,
      message: `Function ${functionName} deleted successfully`,
    });
  } catch (error) {
    return handleAwsError(error, "LAMBDA_DELETE_FUNCTION");
  }
}
