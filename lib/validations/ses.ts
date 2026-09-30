import { z } from "zod";

export const verifyEmailIdentitySchema = z.object({
  emailAddress: z.string().email("Must be a valid email address"),
});

export type VerifyEmailIdentityInput = z.infer<typeof verifyEmailIdentitySchema>;

export const sendEmailSchema = z.object({
  source: z.string().email("Sender must be a valid email address"),
  destination: z.string().email("Recipient must be a valid email address"),
  subject: z.string().min(1, "Subject is required"),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
}).refine((data) => Boolean(data.bodyText || data.bodyHtml), {
  message: "Either plain text body or HTML body must be provided",
  path: ["bodyText"],
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
