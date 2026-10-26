import { Elysia } from "elysia";
import { isRecord, rawString, stringValue } from "../utils/guards";

export const passwordRoutes = new Elysia({ prefix: "/auth" })
  .post("/encrypt", async ({ body, set }) => {
    const username = isRecord(body) ? stringValue(body.username) : "";
    const password = isRecord(body) ? rawString(body.password) : "";

    if (!username || !password) {
      set.status = 400;
      return { error: "username and password are required" };
    }

    const hashBcrypt = await Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: 4,
    });
    return { username, hashBcrypt };
  })
  .post("/verify", async ({ body, set }) => {
    const password = isRecord(body) ? rawString(body.password) : "";
    const hash = isRecord(body) ? stringValue(body.hash) : "";

    if (!password || !hash) {
      set.status = 400;
      return { verified: false, error: "password and hash required" };
    }

    return { verified: await Bun.password.verify(password, hash) };
  });
