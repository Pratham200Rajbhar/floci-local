import { z } from "zod";

export const createRDSInstanceSchema = z.object({
  dbInstanceIdentifier: z
    .string()
    .min(1, "Instance identifier is required")
    .regex(/^[a-zA-Z][a-zA-Z0-9-]*$/, "Must start with a letter and contain only alphanumeric characters and hyphens"),
  engine: z.enum(["postgres", "mysql", "mariadb"]),
  dbInstanceClass: z.string().min(1, "Instance class is required").default("db.t3.micro"),
  masterUsername: z.string().min(1, "Master username is required"),
  masterUserPassword: z.string().min(8, "Master password must be at least 8 characters"),
  allocatedStorage: z.number().int().min(5, "Storage must be at least 5 GB").default(20),
  dbName: z.string().optional(),
});

export type CreateRDSInstanceInput = z.infer<typeof createRDSInstanceSchema>;

export const deleteRDSInstanceSchema = z.object({
  dbInstanceIdentifier: z.string().min(1, "Instance identifier is required"),
  skipFinalSnapshot: z.boolean().default(true),
});

export type DeleteRDSInstanceInput = z.infer<typeof deleteRDSInstanceSchema>;

export const testRDSConnectionSchema = z.object({
  identifier: z.string().min(1, "Instance identifier is required"),
  engine: z.enum(["postgres", "mysql", "mariadb"]).optional(),
  host: z.string().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  masterUsername: z.string().optional(),
  masterPassword: z.string().optional(),
  dbName: z.string().optional(),
});

export type TestRDSConnectionInput = z.infer<typeof testRDSConnectionSchema>;
