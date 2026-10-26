import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { config } from "./config";
import { errorHandler } from "./plugins/error-handler";
import { authRoutes } from "./routes/auth.routes";
import { passwordRoutes } from "./routes/password.routes";

export const app = new Elysia({
  serve: { maxRequestBodySize: 2_200_000 },
})
  .use(cors({ origin: config.webOrigin, credentials: true }))
  .use(errorHandler)
  .use(authRoutes)
  .use(passwordRoutes);
