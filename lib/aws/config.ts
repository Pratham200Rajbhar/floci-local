import { z } from "zod";
import { isUnsafeHost } from "../network-config/validation";

export const envSchema = z.object({
  FLOCI_ENDPOINT: z
    .string()
    .url("FLOCI_ENDPOINT must be a valid URL")
    .default("http://localhost:4566"),
  FLOCI_NETWORK_MODE: z.enum(["local", "lan", "tailscale", "custom"]).default("local"),
  FLOCI_PUBLIC_HOST: z
    .string()
    .min(1, "FLOCI_PUBLIC_HOST is required")
    .refine((host) => !isUnsafeHost(host), {
      message: "FLOCI_PUBLIC_HOST must not target cloud metadata or contain dangerous characters.",
    })
    .default("localhost"),
  FLOCI_PUBLIC_PROTOCOL: z.enum(["http", "https"]).default("http"),
  FLOCI_API_PORT: z.coerce.number().int().min(1).max(65535).default(4566),
  FLOCI_CONFIG_LOCKED: z.coerce.boolean().default(false),
  FLOCI_CONFIG_STORAGE_PATH: z.string().default("./data/floci-ui-config.json"),
  FLOCI_RDS_PORT_RANGE_START: z.coerce.number().int().min(1024).max(65535).default(7001),
  FLOCI_RDS_PORT_RANGE_END: z.coerce.number().int().min(1024).max(65535).default(7099),
  FLOCI_EC2_SSH_PORT_RANGE_START: z.coerce.number().int().min(1024).max(65535).default(2200),
  FLOCI_EC2_SSH_PORT_RANGE_END: z.coerce.number().int().min(1024).max(65535).default(2299),
  FLOCI_ELASTICACHE_PORT_RANGE_START: z.coerce.number().int().min(1024).max(65535).default(6379),
  FLOCI_ELASTICACHE_PORT_RANGE_END: z.coerce.number().int().min(1024).max(65535).default(6399),
  AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID is required").default("test"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY is required").default("test"),
  AWS_REGION: z.string().min(1, "AWS_REGION is required").default("us-east-1"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppConfig = z.infer<typeof envSchema>;

export function getValidatedConfig(customEnv?: Record<string, string | undefined>): AppConfig {
  const envSource = customEnv || process.env;

  const result = envSchema.safeParse({
    FLOCI_ENDPOINT: envSource.FLOCI_ENDPOINT || "http://localhost:4566",
    FLOCI_NETWORK_MODE: envSource.FLOCI_NETWORK_MODE || "local",
    FLOCI_PUBLIC_HOST: envSource.FLOCI_PUBLIC_HOST || "localhost",
    FLOCI_PUBLIC_PROTOCOL: envSource.FLOCI_PUBLIC_PROTOCOL || "http",
    FLOCI_API_PORT: envSource.FLOCI_API_PORT || 4566,
    FLOCI_CONFIG_LOCKED: envSource.FLOCI_CONFIG_LOCKED === "true" || envSource.FLOCI_CONFIG_LOCKED === "1",
    FLOCI_CONFIG_STORAGE_PATH: envSource.FLOCI_CONFIG_STORAGE_PATH || "./data/floci-ui-config.json",
    FLOCI_RDS_PORT_RANGE_START: envSource.FLOCI_RDS_PORT_RANGE_START || 7001,
    FLOCI_RDS_PORT_RANGE_END: envSource.FLOCI_RDS_PORT_RANGE_END || 7099,
    FLOCI_EC2_SSH_PORT_RANGE_START: envSource.FLOCI_EC2_SSH_PORT_RANGE_START || 2200,
    FLOCI_EC2_SSH_PORT_RANGE_END: envSource.FLOCI_EC2_SSH_PORT_RANGE_END || 2299,
    FLOCI_ELASTICACHE_PORT_RANGE_START: envSource.FLOCI_ELASTICACHE_PORT_RANGE_START || 6379,
    FLOCI_ELASTICACHE_PORT_RANGE_END: envSource.FLOCI_ELASTICACHE_PORT_RANGE_END || 6399,
    AWS_ACCESS_KEY_ID: envSource.AWS_ACCESS_KEY_ID || "test",
    AWS_SECRET_ACCESS_KEY: envSource.AWS_SECRET_ACCESS_KEY || "test",
    AWS_REGION: envSource.AWS_REGION || "us-east-1",
    NODE_ENV: envSource.NODE_ENV || "development",
  });

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join(".")}: ${err.message}`)
      .join(", ");
    throw new Error(`Invalid Floci Environment Configuration: ${errorDetails}`);
  }

  return result.data;
}

export const awsConfig = getValidatedConfig();
