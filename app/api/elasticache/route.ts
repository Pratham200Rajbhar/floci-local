import { NextRequest, NextResponse } from "next/server";
import { getElastiCacheClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { buildServerElastiCacheDetails } from "@/lib/floci-network-server";
import {
  createCacheClusterSchema,
  deleteCacheClusterSchema,
} from "@/lib/validations/elasticache";
import {
  DescribeCacheClustersCommand,
  DescribeReplicationGroupsCommand,
  CreateCacheClusterCommand,
  CreateReplicationGroupCommand,
  DeleteCacheClusterCommand,
  DeleteReplicationGroupCommand,
} from "@aws-sdk/client-elasticache";

export async function GET() {
  try {
    const elastiCache = getElastiCacheClient();

    const [cacheClustersRes, replicationGroupsRes] = await Promise.allSettled([
      elastiCache.send(new DescribeCacheClustersCommand({ ShowCacheNodeInfo: true })),
      elastiCache.send(new DescribeReplicationGroupsCommand({})),
    ]);

    interface FormattedCacheItem {
      cacheClusterId: string;
      status: string;
      engine: string;
      cacheNodeType: string;
      numCacheNodes: number;
      endpoint: string;
      host: string;
      port: number;
      isPortValid: boolean;
      redisCliCommand: string;
      createTime?: Date;
      isReplicationGroup: boolean;
    }

    const clusters: FormattedCacheItem[] = [];
    const seenClusterIds = new Set<string>();

    // 1. Process Replication Groups (Redis / Valkey)
    if (replicationGroupsRes.status === "fulfilled") {
      const repGroups = replicationGroupsRes.value.ReplicationGroups || [];
      for (const group of repGroups) {
        const repGroupId = group.ReplicationGroupId || "";
        if (!repGroupId) continue;
        seenClusterIds.add(repGroupId);
        if (group.MemberClusters) {
          for (const member of group.MemberClusters) {
            seenClusterIds.add(member);
          }
        }

        const nodeGroup = group.NodeGroups?.[0];
        const primaryEndpoint = nodeGroup?.PrimaryEndpoint;
        const configEndpoint = group.ConfigurationEndpoint;
        const resolvedPort =
          primaryEndpoint?.Port || configEndpoint?.Port || 6379;

        const cacheDetails = buildServerElastiCacheDetails(
          resolvedPort,
          repGroupId
        );

        clusters.push({
          cacheClusterId: repGroupId,
          status: group.Status || "unknown",
          engine: group.Engine || "redis",
          cacheNodeType: group.CacheNodeType || "cache.t3.micro",
          numCacheNodes: group.MemberClusters?.length || 1,
          endpoint: `${cacheDetails.host}:${cacheDetails.port}`,
          host: cacheDetails.host,
          port: cacheDetails.port,
          isPortValid: cacheDetails.isPortValid,
          redisCliCommand: cacheDetails.redisCliCommand,
          isReplicationGroup: true,
        });
      }
    }

    // 2. Process standalone Cache Clusters (Memcached or standalone Redis)
    if (cacheClustersRes.status === "fulfilled") {
      const cacheClusters = cacheClustersRes.value.CacheClusters || [];
      for (const cluster of cacheClusters) {
        const clusterId = cluster.CacheClusterId || "";
        // Skip if this cluster belongs to an already added replication group
        if (
          seenClusterIds.has(clusterId) ||
          (cluster.ReplicationGroupId && seenClusterIds.has(cluster.ReplicationGroupId))
        ) {
          continue;
        }

        const port =
          cluster.ConfigurationEndpoint?.Port ||
          (cluster.Engine === "memcached" ? 11211 : 6379);

        const cacheDetails = buildServerElastiCacheDetails(port, clusterId);

        clusters.push({
          cacheClusterId: clusterId,
          status: cluster.CacheClusterStatus || "unknown",
          engine: cluster.Engine || "memcached",
          cacheNodeType: cluster.CacheNodeType || "cache.t3.micro",
          numCacheNodes: cluster.NumCacheNodes || 1,
          endpoint: `${cacheDetails.host}:${cacheDetails.port}`,
          host: cacheDetails.host,
          port: cacheDetails.port,
          isPortValid: cacheDetails.isPortValid,
          redisCliCommand:
            cluster.Engine === "memcached"
              ? `nc -v ${cacheDetails.host} ${cacheDetails.port}`
              : cacheDetails.redisCliCommand,
          createTime: cluster.CacheClusterCreateTime,
          isReplicationGroup: false,
        });
      }
    }

    return NextResponse.json({ clusters, count: clusters.length });
  } catch (error) {
    return handleAwsError(error, "ELASTICACHE_DESCRIBE_CLUSTERS");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createCacheClusterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "ValidationError",
            message: validation.error.errors[0]?.message || "Invalid input",
          },
        },
        { status: 400 }
      );
    }

    const { cacheClusterId, engine, cacheNodeType, numCacheNodes, description } =
      validation.data;
    const elastiCache = getElastiCacheClient();

    if (engine === "redis" || engine === "valkey") {
      const command = new CreateReplicationGroupCommand({
        ReplicationGroupId: cacheClusterId,
        ReplicationGroupDescription:
          description || `Replication group for ${cacheClusterId}`,
        Engine: engine,
        CacheNodeType: cacheNodeType,
        NumCacheClusters: numCacheNodes,
      });

      const response = await elastiCache.send(command);

      return NextResponse.json({
        success: true,
        cluster: {
          cacheClusterId: response.ReplicationGroup?.ReplicationGroupId,
          status: response.ReplicationGroup?.Status || "creating",
          engine: response.ReplicationGroup?.Engine || engine,
        },
      });
    }

    const command = new CreateCacheClusterCommand({
      CacheClusterId: cacheClusterId,
      Engine: engine,
      CacheNodeType: cacheNodeType,
      NumCacheNodes: numCacheNodes,
    });

    const response = await elastiCache.send(command);

    return NextResponse.json({
      success: true,
      cluster: {
        cacheClusterId: response.CacheCluster?.CacheClusterId,
        status: response.CacheCluster?.CacheClusterStatus || "creating",
        engine: response.CacheCluster?.Engine || engine,
      },
    });
  } catch (error) {
    return handleAwsError(error, "ELASTICACHE_CREATE_CLUSTER");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = deleteCacheClusterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "ValidationError",
            message: validation.error.errors[0]?.message || "Invalid input",
          },
        },
        { status: 400 }
      );
    }

    const { cacheClusterId } = validation.data;
    const elastiCache = getElastiCacheClient();

    // Try deleting as Replication Group first (standard for Redis/Valkey)
    try {
      await elastiCache.send(
        new DeleteReplicationGroupCommand({
          ReplicationGroupId: cacheClusterId,
        })
      );

      return NextResponse.json({
        success: true,
        message: `Replication group ${cacheClusterId} deletion initiated`,
      });
    } catch (repError) {
      const errorName = (repError as { name?: string }).name || "";
      const errorMessage = (repError as { message?: string }).message || "";
      const isNotFoundOrInvalid =
        errorName.includes("NotFound") ||
        errorName.includes("InvalidParameter") ||
        errorName.includes("NoSuch") ||
        errorMessage.includes("NotFound") ||
        errorMessage.includes("InvalidParameter") ||
        errorMessage.includes("NoSuch");

      // If it is not a replication group (e.g. Memcached cluster), delete as Cache Cluster
      if (isNotFoundOrInvalid) {
        await elastiCache.send(
          new DeleteCacheClusterCommand({
            CacheClusterId: cacheClusterId,
          })
        );

        return NextResponse.json({
          success: true,
          message: `Cache cluster ${cacheClusterId} deletion initiated`,
        });
      }

      throw repError;
    }
  } catch (error) {
    return handleAwsError(error, "ELASTICACHE_DELETE_CLUSTER");
  }
}
