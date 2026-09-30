import { NextRequest, NextResponse } from "next/server";
import { getRDSClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { buildServerRdsDetails } from "@/lib/floci-network-server";
import {
  getRdsPassword,
  saveRdsPassword,
  deleteRdsPassword,
} from "@/lib/rds-credential-store";
import {
  createRDSInstanceSchema,
  deleteRDSInstanceSchema,
} from "@/lib/validations/rds";
import {
  DescribeDBInstancesCommand,
  CreateDBInstanceCommand,
  DeleteDBInstanceCommand,
} from "@aws-sdk/client-rds";

export async function GET() {
  try {
    const rds = getRDSClient();
    const command = new DescribeDBInstancesCommand({});
    const response = await rds.send(command);

    const instances = (response.DBInstances || []).map((db) => {
      const rawAddress = db.Endpoint?.Address;
      const rawPort = db.Endpoint?.Port;
      const engine = db.Engine || "postgres";
      const username = db.MasterUsername || "postgres";
      const dbName = db.DBName || (engine === "postgres" ? "postgres" : "");
      const identifier = db.DBInstanceIdentifier || "";
      const masterPassword = getRdsPassword(identifier);

      // Use central endpoint utility with server config and actual stored password
      const connectionDetails = buildServerRdsDetails(
        rawAddress,
        rawPort,
        engine,
        username,
        dbName,
        identifier,
        masterPassword
      );

      return {
        identifier,
        status: db.DBInstanceStatus || "unknown",
        engine,
        engineVersion: db.EngineVersion || "",
        instanceClass: db.DBInstanceClass || "",
        allocatedStorage: db.AllocatedStorage || 0,
        endpoint: connectionDetails.endpoint,
        host: connectionDetails.host,
        port: connectionDetails.port,
        isPortValid: connectionDetails.isPortValid,
        masterUsername: username,
        masterPassword,
        dbName,
        psqlUri: connectionDetails.psqlUri,
        psqlCliCommand: connectionDetails.psqlCliCommand,
        pgPasswordCommand: connectionDetails.pgPasswordCommand,
        mysqlCliCommand: connectionDetails.mysqlCliCommand,
        createTime: db.InstanceCreateTime,
      };
    });

    return NextResponse.json({ instances, count: instances.length });
  } catch (error) {
    return handleAwsError(error, "RDS_DESCRIBE_INSTANCES");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createRDSInstanceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const {
      dbInstanceIdentifier,
      engine,
      dbInstanceClass,
      masterUsername,
      masterUserPassword,
      allocatedStorage,
      dbName,
    } = validation.data;

    const rds = getRDSClient();
    const command = new CreateDBInstanceCommand({
      DBInstanceIdentifier: dbInstanceIdentifier,
      Engine: engine,
      DBInstanceClass: dbInstanceClass,
      MasterUsername: masterUsername,
      MasterUserPassword: masterUserPassword,
      AllocatedStorage: allocatedStorage,
      DBName: dbName,
    });

    const response = await rds.send(command);

    if (masterUserPassword) {
      saveRdsPassword(dbInstanceIdentifier, masterUserPassword);
    }

    return NextResponse.json({
      success: true,
      instance: {
        identifier: response.DBInstance?.DBInstanceIdentifier,
        status: response.DBInstance?.DBInstanceStatus || "creating",
        engine: response.DBInstance?.Engine,
      },
    });
  } catch (error) {
    return handleAwsError(error, "RDS_CREATE_INSTANCE");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = deleteRDSInstanceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const rds = getRDSClient();
    const command = new DeleteDBInstanceCommand({
      DBInstanceIdentifier: validation.data.dbInstanceIdentifier,
      SkipFinalSnapshot: validation.data.skipFinalSnapshot,
    });

    await rds.send(command);

    if (validation.data.dbInstanceIdentifier) {
      deleteRdsPassword(validation.data.dbInstanceIdentifier);
    }

    return NextResponse.json({
      success: true,
      message: `DB instance ${validation.data.dbInstanceIdentifier} deletion initiated`,
    });
  } catch (error) {
    return handleAwsError(error, "RDS_DELETE_INSTANCE");
  }
}
