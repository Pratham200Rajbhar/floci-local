import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { EC2Client, DescribeInstancesCommand, RunInstancesCommand } from "@aws-sdk/client-ec2";
import { GET, POST } from "@/app/api/ec2/route";
import { NextRequest } from "next/server";

const ec2Mock = mockClient(EC2Client);

describe("EC2 API Route Handlers", () => {
  beforeEach(() => {
    ec2Mock.reset();
  });

  it("GET /api/ec2 returns list of instances and Tailscale SSH commands", async () => {
    ec2Mock.on(DescribeInstancesCommand).resolves({
      Reservations: [
        {
          Instances: [
            {
              InstanceId: "i-0123456789abcdef0",
              State: { Name: "running" },
              InstanceType: "t2.micro",
              ImageId: "ami-12345678",
              PrivateIpAddress: "10.0.4.5",
            },
          ],
        },
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.instances).toHaveLength(1);
    expect(data.instances[0].instanceId).toBe("i-0123456789abcdef0");
    expect(data.instances[0].sshPort).toBe(2200);
    expect(data.instances[0].sshCommand).toContain("ssh -p 2200");
    expect(data.instances[0].sshCommand).not.toContain("10.0.4.5");
    expect(data.instances[0].internalContainerAddress).toBe("10.0.4.5");
  });

  it("POST /api/ec2 launches instances", async () => {
    ec2Mock.on(RunInstancesCommand).resolves({
      Instances: [
        {
          InstanceId: "i-newinstance",
          State: { Name: "pending" },
          InstanceType: "t2.micro",
        },
      ],
    });

    const req = new NextRequest("http://100.101.187.9:3000/api/ec2", {
      method: "POST",
      body: JSON.stringify({
        imageId: "ami-12345678",
        instanceType: "t2.micro",
        minCount: 1,
        maxCount: 1,
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.instances[0].instanceId).toBe("i-newinstance");
  });
});
