import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "SYS:standard",
        },
      },
});

export function getScopedLogger(context: string, requestId?: string) {
  return logger.child({
    context,
    requestId: requestId || `req-${Math.random().toString(36).substring(2, 9)}`,
  });
}
