import { NextRequest, NextResponse } from "next/server";
import { getEC2Client } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { ec2InstanceActionSchema } from "@/lib/validations/ec2";
import {
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
  RebootInstancesCommand,
} from "@aws-sdk/client-ec2";

interface RouteParams {
  params: Promise<{ instanceId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { instanceId } = await params;
    const body = await request.json();
    const validation = ec2InstanceActionSchema.safeParse({ ...body, instanceId });

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { action } = validation.data;
    const ec2 = getEC2Client();

    let resultingState = "unknown";

    switch (action) {
      case "start": {
        const cmd = new StartInstancesCommand({ InstanceIds: [instanceId] });
        const res = await ec2.send(cmd);
        resultingState = res.StartingInstances?.[0]?.CurrentState?.Name || "pending";
        break;
      }
      case "stop": {
        const cmd = new StopInstancesCommand({ InstanceIds: [instanceId] });
        const res = await ec2.send(cmd);
        resultingState = res.StoppingInstances?.[0]?.CurrentState?.Name || "stopping";
        break;
      }
      case "terminate": {
        const cmd = new TerminateInstancesCommand({ InstanceIds: [instanceId] });
        const res = await ec2.send(cmd);
        resultingState = res.TerminatingInstances?.[0]?.CurrentState?.Name || "shutting-down";
        break;
      }
      case "reboot": {
        const cmd = new RebootInstancesCommand({ InstanceIds: [instanceId] });
        await ec2.send(cmd);
        resultingState = "rebooting";
        break;
      }
    }

    return NextResponse.json({
      success: true,
      instanceId,
      action,
      state: resultingState,
    });
  } catch (error) {
    return handleAwsError(error, "EC2_INSTANCE_ACTION");
  }
}
