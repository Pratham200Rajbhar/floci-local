import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/rds/extension/route";
import { NextRequest } from "next/server";

vi.mock("pg", () => {
  return {
    default: {
      Client: vi.fn().mockImplementation(() => {
        return {
          connect: vi.fn(async () => {}),
          query: vi.fn(async (queryText: string) => {
            if (queryText.includes("CREATE EXTENSION")) {
              return { rows: [] };
            }
            if (queryText.includes("pg_available_extensions")) {
              return {
                rows: [
                  {
                    name: "vector",
                    default_version: "0.8.6",
                    installed_version: "0.8.6",
                    comment: "vector data type and ivfflat and hnsw access methods",
                  },
                ],
              };
            }
            return { rows: [] };
          }),
          end: vi.fn(async () => {}),
        };
      }),
    },
  };
});

describe("POST /api/rds/extension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates missing identifier", async () => {
    const req = new NextRequest("http://localhost:3050/api/rds/extension", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("enables pgvector extension and returns status", async () => {
    const req = new NextRequest("http://localhost:3050/api/rds/extension", {
      method: "POST",
      body: JSON.stringify({
        identifier: "test-db",
        extension: "vector",
        action: "enable",
        host: "127.0.0.1",
        port: 7001,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.installed).toBe(true);
    expect(data.installedVersion).toBe("0.8.6");
  });
});
