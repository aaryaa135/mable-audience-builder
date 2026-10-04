import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";

import { getUserConditionCounts, initializeDatabase } from "../db/database";
import { audienceRuleSchema } from "../domain/validation";
import { selectMembers } from "../domain/evaluator";

initializeDatabase();

export const app = express();

app.use(cors());

// Request logging middleware - runs first to capture requestId for all routes
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  const requestId = randomUUID();

  res.setHeader("X-Request-Id", requestId);

  // Attach requestId to request for use in route handlers
  (req as Request & { requestId?: string }).requestId = requestId;

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    const logData: Record<string, unknown> = {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
    };

    // Additional fields for successful POST /v1/audiences/preview
    if (req.method === "POST" && req.path === "/v1/audiences/preview" && res.statusCode === 200) {
      // Access response body data via locals set by the route handler
      const locals = res.locals as { conditionCount?: number; audienceTotal?: number };
      if (locals.conditionCount !== undefined) {
        logData.conditionCount = locals.conditionCount;
      }
      if (locals.audienceTotal !== undefined) {
        logData.audienceTotal = locals.audienceTotal;
      }
    }

    console.info(logData);
  });

  next();
});

// Handle JSON parsing errors and body size limits
app.use(express.json({ limit: "100kb" }));

// Error handler for JSON parsing and body size errors from express.json()
app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    // Express json() middleware throws SyntaxError for malformed JSON
    // and a custom error for oversized payload (has status 413, type 'entity.too.large')
    if (error instanceof SyntaxError && "status" in error) {
      const status = (error as { status: number }).status;
      const requestId = res.getHeader("X-Request-Id")?.toString() ?? randomUUID();

      if (status === 400) {
        // Malformed JSON
        res.status(400).json({
          error: {
            code: "MALFORMED_JSON",
            message: "Request body contains invalid JSON.",
            requestId,
          },
        });
        return;
      }

      if (status === 413) {
        // Body too large
        res.status(413).json({
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Request body exceeds the maximum allowed size of 100 KB.",
            requestId,
          },
        });
        return;
      }
    }

    // Handle payload too large error from raw-body (not a SyntaxError)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status: number }).status === 413 &&
      "type" in error &&
      (error as { type: string }).type === "entity.too.large"
    ) {
      const requestId = res.getHeader("X-Request-Id")?.toString() ?? randomUUID();
      res.status(413).json({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Request body exceeds the maximum allowed size of 100 KB.",
          requestId,
        },
      });
      return;
    }

    next(error);
  },
);

// Middleware to enforce Content-Type for POST /v1/audiences/preview
app.use("/v1/audiences/preview", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST") {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      const requestId = res.getHeader("X-Request-Id")?.toString() ?? randomUUID();
      res.status(415).json({
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Content-Type must be application/json.",
          requestId,
        },
      });
      return;
    }
  }
  next();
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
  });
});

app.post(
  "/v1/audiences/preview",
  (req: Request, res: Response, next: NextFunction) => {
    const requestId = res.getHeader("X-Request-Id")?.toString() ?? randomUUID();

    try {
      const rule = audienceRuleSchema.parse(req.body);
      const asOf = new Date(rule.asOf);

      const users = getUserConditionCounts(
        asOf,
        rule.conditions,
      );

      const members = selectMembers(users, {
        asOf,
        conditions: rule.conditions,
      });

      // Set locals for request logging middleware
      res.locals.conditionCount = rule.conditions.length;
      res.locals.audienceTotal = members.length;

      res.status(200).json({
        name: rule.name,
        asOf: asOf.toISOString(),
        evaluatedUsers: users.length,
        total: members.length,
        members,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found.",
    },
  });
});

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const requestId =
      res.getHeader("X-Request-Id")?.toString() ?? randomUUID();

    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          code: "VALIDATION_FAILED",
          message: "The audience rule is invalid.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
          requestId,
        },
      });

      return;
    }

    console.error({
      requestId,
      error,
    });

    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected server error occurred.",
        requestId,
      },
    });
  },
);