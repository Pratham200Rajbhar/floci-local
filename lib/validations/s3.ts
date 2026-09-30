import { z } from "zod";

export const createBucketSchema = z.object({
  bucketName: z
    .string()
    .min(3, "Bucket name must be at least 3 characters")
    .max(63, "Bucket name must be at most 63 characters")
    .regex(
      /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/,
      "Bucket name can only contain lowercase letters, numbers, hyphens, and periods, and must start/end with a letter or number"
    ),
});

export type CreateBucketInput = z.infer<typeof createBucketSchema>;

export const deleteBucketSchema = z.object({
  bucketName: z.string().min(1, "Bucket name is required"),
});

export type DeleteBucketInput = z.infer<typeof deleteBucketSchema>;

export const deleteObjectSchema = z.object({
  bucketName: z.string().min(1, "Bucket name is required"),
  key: z.string().min(1, "Object key is required"),
});

export type DeleteObjectInput = z.infer<typeof deleteObjectSchema>;
