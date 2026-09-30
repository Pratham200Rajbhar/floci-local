import { z } from "zod";

export const createCacheClusterSchema = z.object({
  cacheClusterId: z
    .string()
    .min(1, "Cluster ID is required")
    .regex(/^[a-z0-9-]+$/, "Must contain only lowercase alphanumeric characters and hyphens"),
  engine: z.enum(["redis", "valkey", "memcached"]).default("redis"),
  cacheNodeType: z.string().min(1, "Node type is required").default("cache.t3.micro"),
  numCacheNodes: z.number().int().min(1).max(6).default(1),
  description: z.string().optional(),
});

export type CreateCacheClusterInput = z.infer<typeof createCacheClusterSchema>;

export const deleteCacheClusterSchema = z.object({
  cacheClusterId: z.string().min(1, "Cluster ID is required"),
});

export type DeleteCacheClusterInput = z.infer<typeof deleteCacheClusterSchema>;
