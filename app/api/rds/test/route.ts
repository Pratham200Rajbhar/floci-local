import { NextRequest, NextResponse } from "next/server";
import { getRDSClient } from "@/lib/aws/clients";
import { DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { testRDSConnectionSchema } from "@/lib/validations/rds";
import { getRdsPassword } from "@/lib/rds-credential-store";
import { buildServerRdsDetails } from "@/lib/floci-network-server";
import { logger } from "@/lib/logger";
import pg from "pg";
import mysql from "mysql2/promise";
import net from "net";

export const dynamic = "force-dynamic";

function checkTcpSocket(host: string, port: number, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let isSettled = false;

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      isSettled = true;
      socket.destroy();
      resolve();
    });

    socket.on("timeout", () => {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        reject(new Error(`TCP connection to ${host}:${port} timed out after ${timeoutMs}ms`));
      }
    });

    socket.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        reject(err);
      }
    });

    socket.connect(port, host);
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = testRDSConnectionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0]?.message || "Invalid input",
        },
        { status: 400 }
      );
    }

    const input = validation.data;
    let engine = input.engine || "postgres";
    let host = input.host;
    let port = input.port;
    let username = input.masterUsername || "postgres";
    let dbName = input.dbName || (engine === "postgres" ? "postgres" : "");
    const password = input.masterPassword || getRdsPassword(input.identifier) || "postgres";

    // If host/port not fully specified, lookup the instance from RDS
    if (!host || !port) {
      try {
        const rds = getRDSClient();
        const command = new DescribeDBInstancesCommand({
          DBInstanceIdentifier: input.identifier,
        });
        const response = await rds.send(command);
        const db = response.DBInstances?.[0];

        if (db) {
          engine = (db.Engine || engine) as "postgres" | "mysql" | "mariadb";
          username = input.masterUsername || db.MasterUsername || username;
          dbName = input.dbName || db.DBName || (engine === "postgres" ? "postgres" : "");
          const details = buildServerRdsDetails(
            db.Endpoint?.Address,
            db.Endpoint?.Port,
            engine,
            username,
            dbName,
            input.identifier,
            password
          );
          host = details.host;
          port = details.port;
        }
      } catch (err) {
        logger.warn({ err, identifier: input.identifier }, "Failed to describe instance for testing");
      }
    }

    const resolvedHost = host || "127.0.0.1";
    const resolvedPort = port || 7001;

    // First, verify TCP socket reachability
    const startTime = Date.now();
    try {
      await checkTcpSocket(resolvedHost, resolvedPort, 3000);
    } catch (sockErr) {
      const latencyMs = Date.now() - startTime;
      const sockMessage = sockErr instanceof Error ? sockErr.message : "Port unreachable";
      return NextResponse.json({
        success: false,
        latencyMs,
        testedEndpoint: `${resolvedHost}:${resolvedPort}`,
        error: `Cannot reach ${resolvedHost}:${resolvedPort}. ${sockMessage}`,
        hint: "Verify that the backend container is running and Docker proxy ports 7001-7099 are published.",
      });
    }

    // Now test database authentication and query execution
    if (engine === "postgres") {
      const client = new pg.Client({
        host: resolvedHost,
        port: resolvedPort,
        user: username,
        password: password,
        database: dbName || "postgres",
        connectionTimeoutMillis: 4000,
        ssl: false,
      });

      try {
        await client.connect();
        const versionResult = await client.query("SELECT version() as ver;");

        // Check pgvector support and installation
        let vectorSupported = false;
        let vectorInstalled = false;
        let vectorVersion: string | null = null;

        try {
          const extResult = await client.query(
            "SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'vector';"
          );
          if (extResult.rows && extResult.rows.length > 0) {
            vectorSupported = true;
            if (extResult.rows[0].installed_version) {
              vectorInstalled = true;
              vectorVersion = String(extResult.rows[0].installed_version);
            }
          }
        } catch {
          // Ignore extension query errors if privileges restricted
        }

        await client.end();
        const latencyMs = Date.now() - startTime;
        const versionString = versionResult.rows?.[0]?.ver || "PostgreSQL";

        return NextResponse.json({
          success: true,
          latencyMs,
          testedEndpoint: `${resolvedHost}:${resolvedPort}`,
          engine: "postgres",
          version: typeof versionString === "string" ? versionString.split(" on ")[0] : "PostgreSQL",
          vectorSupported,
          vectorInstalled,
          vectorVersion,
          message: `Connected successfully in ${latencyMs}ms.`,
        });
      } catch (pgErr) {
        try {
          await client.end();
        } catch {
          // Ignore close errors
        }
        const latencyMs = Date.now() - startTime;
        const message = pgErr instanceof Error ? pgErr.message : "PostgreSQL connection failed";
        return NextResponse.json({
          success: false,
          latencyMs,
          testedEndpoint: `${resolvedHost}:${resolvedPort}`,
          error: message,
          hint: "The proxy port is listening, but PostgreSQL handshake/authentication failed. Check credentials or database container readiness.",
        });
      }
    } else {
      // MySQL / MariaDB
      try {
        const connection = await mysql.createConnection({
          host: resolvedHost,
          port: resolvedPort,
          user: username,
          password: password,
          database: dbName || undefined,
          connectTimeout: 4000,
        });

        const [rows] = await connection.query("SELECT VERSION() as ver;");
        await connection.end();
        const latencyMs = Date.now() - startTime;
        const versionRow = Array.isArray(rows) && rows[0] ? (rows[0] as { ver?: string }) : null;

        return NextResponse.json({
          success: true,
          latencyMs,
          testedEndpoint: `${resolvedHost}:${resolvedPort}`,
          engine,
          version: versionRow?.ver || `${engine} Server`,
          message: `Connected successfully in ${latencyMs}ms.`,
        });
      } catch (mysqlErr) {
        const latencyMs = Date.now() - startTime;
        const message = mysqlErr instanceof Error ? mysqlErr.message : "MySQL connection failed";
        return NextResponse.json({
          success: false,
          latencyMs,
          testedEndpoint: `${resolvedHost}:${resolvedPort}`,
          error: message,
          hint: "The proxy port is listening, but MySQL handshake/authentication failed. Check credentials or database container readiness.",
        });
      }
    }
  } catch (error) {
    logger.error({ error }, "RDS connection test error");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error testing RDS connection",
      },
      { status: 500 }
    );
  }
}
