import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  ElastiCacheClient,
  DescribeCacheClustersCommand,
  DescribeReplicationGroupsCommand,
  CreateReplicationGroupCommand,
  CreateCacheClusterCommand,
  DeleteReplicationGroupCommand,
  DeleteCacheClusterCommand,
} from "@aws-sdk/client-elasticache";
import { GET, POST, DELETE } from "@/app/api/elasticache/route";
import { NextRequest } from "next/server";

const elastiCacheMock = mockClient(ElastiCacheClient);

describe("ElastiCache API Route Handlers", () => {
  beforeEach(() => {
    elastiCacheMock.reset();
  });

  it("GET /api/elasticache combines replication groups and standalone clusters without duplicates", async () => {
    elastiCacheMock.on(DescribeReplicationGroupsCommand).resolves({
      ReplicationGroups: [
        {
          ReplicationGroupId: "my-redis-group",
          Status: "available",
          Engine: "redis",
          CacheNodeType: "cache.t3.micro",
          MemberClusters: ["my-redis-group-001"],
          NodeGroups: [
            {
              NodeGroupId: "0001",
              PrimaryEndpoint: { Address: "localhost", Port: 6380 },
            },
          ],
        },
      ],
    });

    elastiCacheMock.on(DescribeCacheClustersCommand).resolves({
      CacheClusters: [
        {
          CacheClusterId: "my-redis-group-001",
          ReplicationGroupId: "my-redis-group",
          Engine: "redis",
          CacheClusterStatus: "available",
        },
        {
          CacheClusterId: "my-memcached-cluster",
          Engine: "memcached",
          CacheClusterStatus: "available",
          ConfigurationEndpoint: { Address: "localhost", Port: 11211 },
        },
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.clusters).toHaveLength(2);

    const redisCluster = data.clusters.find(
      (c: { cacheClusterId: string }) => c.cacheClusterId === "my-redis-group"
    );
    expect(redisCluster).toBeDefined();
    expect(redisCluster.engine).toBe("redis");
    expect(redisCluster.port).toBe(6380);
    expect(redisCluster.isReplicationGroup).toBe(true);

    const memcachedCluster = data.clusters.find(
      (c: { cacheClusterId: string }) => c.cacheClusterId === "my-memcached-cluster"
    );
    expect(memcachedCluster).toBeDefined();
    expect(memcachedCluster.engine).toBe("memcached");
    expect(memcachedCluster.port).toBe(11211);
    expect(memcachedCluster.isReplicationGroup).toBe(false);
  });

  it("POST /api/elasticache sends CreateReplicationGroup for Redis", async () => {
    elastiCacheMock.on(CreateReplicationGroupCommand).resolves({
      ReplicationGroup: {
        ReplicationGroupId: "new-redis",
        Status: "creating",
        Engine: "redis",
      },
    });

    const req = new NextRequest("http://localhost:3000/api/elasticache", {
      method: "POST",
      body: JSON.stringify({
        cacheClusterId: "new-redis",
        engine: "redis",
        cacheNodeType: "cache.t3.micro",
        numCacheNodes: 1,
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cluster.cacheClusterId).toBe("new-redis");
    expect(elastiCacheMock.commandCalls(CreateReplicationGroupCommand)).toHaveLength(1);
    expect(elastiCacheMock.commandCalls(CreateCacheClusterCommand)).toHaveLength(0);
  });

  it("POST /api/elasticache sends CreateCacheCluster for Memcached", async () => {
    elastiCacheMock.on(CreateCacheClusterCommand).resolves({
      CacheCluster: {
        CacheClusterId: "new-memcached",
        CacheClusterStatus: "creating",
        Engine: "memcached",
      },
    });

    const req = new NextRequest("http://localhost:3000/api/elasticache", {
      method: "POST",
      body: JSON.stringify({
        cacheClusterId: "new-memcached",
        engine: "memcached",
        cacheNodeType: "cache.t3.micro",
        numCacheNodes: 1,
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cluster.cacheClusterId).toBe("new-memcached");
    expect(elastiCacheMock.commandCalls(CreateCacheClusterCommand)).toHaveLength(1);
    expect(elastiCacheMock.commandCalls(CreateReplicationGroupCommand)).toHaveLength(0);
  });

  it("DELETE /api/elasticache tries DeleteReplicationGroup and falls back to DeleteCacheCluster", async () => {
    elastiCacheMock
      .on(DeleteReplicationGroupCommand)
      .rejects(new Error("ReplicationGroupNotFoundFault"));
    elastiCacheMock.on(DeleteCacheClusterCommand).resolves({});

    const req = new NextRequest("http://localhost:3000/api/elasticache", {
      method: "DELETE",
      body: JSON.stringify({
        cacheClusterId: "standalone-memcached",
      }),
    });

    const response = await DELETE(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(elastiCacheMock.commandCalls(DeleteCacheClusterCommand)).toHaveLength(1);
  });
});
