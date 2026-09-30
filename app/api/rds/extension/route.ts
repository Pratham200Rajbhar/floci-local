import { NextRequest, NextResponse } from "next/server";
import { getRDSClient } from "@/lib/aws/clients";
import { DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { getRdsPassword } from "@/lib/rds-credential-store";
import { buildServerRdsDetails } from "@/lib/floci-network-server";
import { logger } from "@/lib/logger";
import pg from "pg";
import { z } from "zod";

export const dynamic = "force-dynamic";

const rdsExtensionSchema = z.object({
  identifier: z.string().min(1, "Instance identifier is required"),
  extension: z.string().min(1).default("vector"),
  action: z.enum(["status", "enable"]).default("enable"),
  host: z.string().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  masterUsername: z.string().optional(),
  masterPassword: z.string().optional(),
  dbName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = rdsExtensionSchema.safeParse(body);

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
    let host = input.host;
    let port = input.port;
    let username = input.masterUsername || "postgres";
    let dbName = input.dbName || "postgres";
    const password = input.masterPassword || getRdsPassword(input.identifier) || "postgres";

    if (!host || !port) {
      try {
        const rds = getRDSClient();
        const command = new DescribeDBInstancesCommand({
          DBInstanceIdentifier: input.identifier,
        });
        const response = await rds.send(command);
        const db = response.DBInstances?.[0];

        if (db) {
          username = input.masterUsername || db.MasterUsername || username;
          dbName = input.dbName || db.DBName || "postgres";
          const details = buildServerRdsDetails(
            db.Endpoint?.Address,
            db.Endpoint?.Port,
            "postgres",
            username,
            dbName,
            input.identifier,
            password
          );
          host = details.host;
          port = details.port;
        }
      } catch (err) {
        logger.warn({ err, identifier: input.identifier }, "Failed to describe instance for extension management");
      }
    }

    const resolvedHost = host || "127.0.0.1";
    const resolvedPort = port || 7001;

    const client = new pg.Client({
      host: resolvedHost,
      port: resolvedPort,
      user: username,
      password: password,
      database: dbName || "postgres",
      connectionTimeoutMillis: 4000,
      ssl: false,
    });

    await client.connect();

    try {
      if (input.action === "enable") {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "${input.extension}";`);
      }

      const extResult = await client.query(
        "SELECT name, default_version, installed_version, comment FROM pg_available_extensions WHERE name = $1;",
        [input.extension]
      );

      await client.end();

      const row = extResult.rows?.[0];
      const isSupported = Boolean(row);
      const isInstalled = Boolean(row?.installed_version);

      return NextResponse.json({
        success: true,
        extension: input.extension,
        supported: isSupported,
        installed: isInstalled,
        installedVersion: row?.installed_version || null,
        defaultVersion: row?.default_version || null,
        comment: row?.comment || "",
        message: isInstalled
          ? `Extension "${input.extension}" is enabled (v${row.installed_version}).`
          : isSupported
          ? `Extension "${input.extension}" is available to install.`
          : `Extension "${input.extension}" is not available in this PostgreSQL container image.`,
      });
    } catch (queryErr) {
      try {
        await client.end();
      } catch {
        // ignore
      }
      const message = queryErr instanceof Error ? queryErr.message : "Failed to execute extension operation";
      return NextResponse.json(
        {
          success: false,
          error: message,
          hint:
            input.extension === "vector"
              ? "Ensure the PostgreSQL instance is running an image with pgvector (e.g. pgvector/pgvector:pg16)."
              : undefined,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error({ error }, "RDS extension operation error");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error executing extension command",
      },
      { status: 500 }
    );
  }
}
