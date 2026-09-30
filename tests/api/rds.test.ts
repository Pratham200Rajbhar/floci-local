import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { RDSClient, DescribeDBInstancesCommand, CreateDBInstanceCommand } from "@aws-sdk/client-rds";
import { GET, POST } from "@/app/api/rds/route";
import { NextRequest } from "next/server";

const rdsMock = mockClient(RDSClient);

describe("RDS API Route Handlers", () => {
  beforeEach(() => {
    rdsMock.reset();
  });

  it("GET /api/rds sanitizes raw internal address to Tailscale host", async () => {
    rdsMock.on(DescribeDBInstancesCommand).resolves({
      DBInstances: [
        {
          DBInstanceIdentifier: "test-db",
          DBInstanceStatus: "available",
          Engine: "postgres",
          Endpoint: { Address: "10.0.4.2", Port: 7001 },
          MasterUsername: "postgres",
        },
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.instances).toHaveLength(1);
    expect(data.instances[0].identifier).toBe("test-db");
    expect(data.instances[0].port).toBe(7001);
    expect(data.instances[0].psqlCliCommand).toContain("port=7001");
    expect(data.instances[0].psqlCliCommand).not.toContain("10.0.4.2");
  });

  it("POST /api/rds creates instance with valid parameters", async () => {
    rdsMock.on(CreateDBInstanceCommand).resolves({
      DBInstance: {
        DBInstanceIdentifier: "new-postgres-db",
        DBInstanceStatus: "creating",
        Engine: "postgres",
      },
    });

    const req = new NextRequest("http://100.101.187.9:3000/api/rds", {
      method: "POST",
      body: JSON.stringify({
        dbInstanceIdentifier: "new-postgres-db",
        engine: "postgres",
        dbInstanceClass: "db.t3.micro",
        masterUsername: "postgres",
        masterUserPassword: "password123",
        allocatedStorage: 20,
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.instance.identifier).toBe("new-postgres-db");
  });
});
