import { pino } from "pino";
import { env, isProd } from "@/config/env.js";

// Structured logger. In production, JSON lines (one entry per line); locally,
// pretty-printed when `pino-pretty` is available. Request IDs are added by
// `pino-http` in app.ts.
export const log = pino({
  level: env.LOG_LEVEL,
  base: { service: "sfu-api", env: env.NODE_ENV },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "password",
      "token",
      "mfa_secret",
      "secret",
    ],
    censor: "[redacted]",
  },
  transport: isProd()
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, singleLine: true, ignore: "pid,hostname,service,env" },
      },
});
