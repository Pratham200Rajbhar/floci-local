import { z } from "zod";

export const createLambdaFunctionSchema = z.object({
  functionName: z
    .string()
    .min(1, "Function name is required")
    .regex(/^[a-zA-Z0-9-_]+$/, "Only letters, numbers, hyphens, and underscores allowed"),
  runtime: z.enum([
    "nodejs20.x",
    "nodejs18.x",
    "python3.12",
    "python3.11",
    "python3.10",
  ]),
  handler: z.string().min(1, "Handler name is required (e.g. index.handler)").default("index.handler"),
  codeZipBase64: z.string().min(1, "ZIP file content (base64) is required"),
  description: z.string().optional(),
});

export type CreateLambdaFunctionInput = z.infer<typeof createLambdaFunctionSchema>;

export const invokeLambdaSchema = z.object({
  functionName: z.string().min(1, "Function name is required"),
  payload: z.string().optional(),
});

export type InvokeLambdaInput = z.infer<typeof invokeLambdaSchema>;
