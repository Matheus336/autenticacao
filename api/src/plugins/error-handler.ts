import { Elysia } from "elysia";
import { HttpError } from "../utils/errors";

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  { as: "global" },
  ({ error, set }) => {
    if (error instanceof HttpError) {
      set.status = error.status;
      if (error.retryAfterSeconds !== undefined) {
        set.headers["Retry-After"] = String(error.retryAfterSeconds);
      }
      return { error: error.message };
    }
  },
);
