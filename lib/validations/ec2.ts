import { z } from "zod";

export const launchEC2InstanceSchema = z.object({
  imageId: z.string().min(1, "AMI Image ID is required").default("ami-12345678"),
  instanceType: z.string().min(1, "Instance type is required").default("t2.micro"),
  minCount: z.number().int().min(1).max(10).default(1),
  maxCount: z.number().int().min(1).max(10).default(1),
  keyName: z.string().optional(),
});

export type LaunchEC2InstanceInput = z.infer<typeof launchEC2InstanceSchema>;

export const ec2InstanceActionSchema = z.object({
  instanceId: z.string().min(1, "Instance ID is required"),
  action: z.enum(["start", "stop", "terminate", "reboot"]),
});

export type EC2InstanceActionInput = z.infer<typeof ec2InstanceActionSchema>;
