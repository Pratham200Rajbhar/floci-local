import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/rds/test/route";
import { NextRequest } from "next/server";

// Mock net.Socket
vi.mock("net", () => {
  return {
    default: {
      Socket: vi.fn().mockImplementation(() => {
        const handlers: Record<string, Function> = {};
        return {
          setTimeout: vi.fn(),
          on: vi.fn((event: string, cb: Function) => {
            handlers[event] = cb;
          }),
          connect: vi.fn((port: number, host: string) => {
            setTimeout(() => {
              if (port === 9999) {
                if (handlers["error"]) handlers["error"](new Error("Connection refused"));
              } else {
                if (handlers["connect"]) handlers["connect"]();
              }
            }, 10);
          }),
          destroy: vi.fn(),
        };
      }),
    },
  };
});

// Mock pg
vi.mock("pg", () => {
  return {
    default: {
      Client: vi.fn().mockImplementation(({ password }: { password?: string }) => {
        return {
          connect: vi.fn(async () => {
            if (password === "wrong_pass") {
              throw new Error("password authentication failed for user");
            }
          }),
          query: vi.fn(async () => ({
            rows: [{ ver: "PostgreSQL 16.3 on x86_64-pc-linux-musl" }],
          })),
          end: vi.fn(async () => {}),
        };
      }),
    },
  };
});

describe("POST /api/rds/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates missing identifier", async () => {
    const req = new NextRequest("http://localhost:3050/api/rds/test", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.toLowerCase()).toContain("required");
  });

  it("successfully verifies connection to PostgreSQL instance", async () => {
    const req = new NextRequest("http://localhost:3050/api/rds/test", {
      method: "POST",
      body: JSON.stringify({
        identifier: "test-postgres",
        engine: "postgres",
        host: "127.0.0.1",
        port: 7001,
        masterUsername: "postgres",
        masterPassword: "password123",
        dbName: "postgres",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.engine).toBe("postgres");
    expect(data.version).toBe("PostgreSQL 16.3");
  });

  it("handles TCP unreachable failure", async () => {
    const req = new NextRequest("http://localhost:3050/api/rds/test", {
      method: "POST",
      body: JSON.stringify({
        identifier: "test-unreachable",
        engine: "postgres",
        host: "127.0.0.1",
        port: 9999,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Cannot reach 127.0.0.1:9999");
  });

  it("handles authentication failure", async () => {
    const req = new NextRequest("http://localhost:3050/api/rds/test", {
      method: "POST",
      body: JSON.stringify({
        identifier: "test-auth-fail",
        engine: "postgres",
        host: "127.0.0.1",
        port: 7001,
        masterPassword: "wrong_pass",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("password authentication failed");
  });
});
