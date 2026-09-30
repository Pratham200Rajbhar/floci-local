import { NextRequest, NextResponse } from "next/server";
import { getEC2Client } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { buildServerEc2Details } from "@/lib/floci-network-server";
import { launchEC2InstanceSchema } from "@/lib/validations/ec2";
import {
  DescribeInstancesCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

export async function GET() {
  try {
    const ec2 = getEC2Client();
    const command = new DescribeInstancesCommand({});
    const response = await ec2.send(command);

    const instances: Array<{
      instanceId: string;
      state: string;
      instanceType: string;
      imageId: string;
      launchTime?: Date;
      publicIpAddress?: string;
      privateIpAddress?: string;
      internalContainerAddress?: string;
      sshPort: number;
      isPortValid: boolean;
      sshCommand: string;
    }> = [];

    let portOffset = 2200;
    for (const reservation of response.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        const instanceId = instance.InstanceId || "unknown";
        const state = instance.State?.Name || "unknown";
        const sshPort = portOffset++;
        const privateIp = instance.PrivateIpAddress;

        // Build SSH details using server config
        const sshDetails = buildServerEc2Details(sshPort, "root", privateIp, instanceId);

        instances.push({
          instanceId,
          state,
          instanceType: instance.InstanceType || "t2.micro",
          imageId: instance.ImageId || "",
          launchTime: instance.LaunchTime,
          publicIpAddress: instance.PublicIpAddress,
          privateIpAddress: instance.PrivateIpAddress,
          internalContainerAddress: sshDetails.internalContainerAddress,
          sshPort: sshDetails.port,
          isPortValid: sshDetails.isPortValid,
          sshCommand: sshDetails.sshCommand,
        });
      }
    }

    return NextResponse.json({ instances, count: instances.length });
  } catch (error) {
    return handleAwsError(error, "EC2_DESCRIBE_INSTANCES");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = launchEC2InstanceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { imageId, instanceType, minCount, maxCount, keyName } = validation.data;
    const ec2 = getEC2Client();
    const command = new RunInstancesCommand({
      ImageId: imageId,
      InstanceType: instanceType as never,
      MinCount: minCount,
      MaxCount: maxCount,
      KeyName: keyName,
    });

    const response = await ec2.send(command);
    const launched = (response.Instances || []).map((inst) => ({
      instanceId: inst.InstanceId,
      state: inst.State?.Name || "pending",
      instanceType: inst.InstanceType,
    }));

    return NextResponse.json({
      success: true,
      instances: launched,
    });
  } catch (error) {
    return handleAwsError(error, "EC2_RUN_INSTANCES");
  }
}
