import { z } from "zod";

export const createSQSQueueSchema = z.object({
  queueName: z
    .string()
    .min(1, "Queue name is required")
    .regex(/^[a-zA-Z0-9_-]+(\.fifo)?$/, "Queue name must be alphanumeric with hyphens or underscores (or .fifo suffix)"),
  isFifo: z.boolean().default(false),
});

export type CreateSQSQueueInput = z.infer<typeof createSQSQueueSchema>;

export const sendSQSMessageSchema = z.object({
  queueUrl: z.string().min(1, "Queue URL is required"),
  messageBody: z.string().min(1, "Message body cannot be empty"),
  delaySeconds: z.number().int().min(0).max(900).default(0),
});

export type SendSQSMessageInput = z.infer<typeof sendSQSMessageSchema>;

export const createSNSTopicSchema = z.object({
  topicName: z
    .string()
    .min(1, "Topic name is required")
    .regex(/^[a-zA-Z0-9_-]+(\.fifo)?$/, "Topic name must be alphanumeric with hyphens or underscores"),
  isFifo: z.boolean().default(false),
});

export type CreateSNSTopicInput = z.infer<typeof createSNSTopicSchema>;

export const publishSNSTopicSchema = z.object({
  topicArn: z.string().min(1, "Topic ARN is required"),
  message: z.string().min(1, "Message is required"),
  subject: z.string().optional(),
});

export type PublishSNSTopicInput = z.infer<typeof publishSNSTopicSchema>;
