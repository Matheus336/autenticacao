import { Elysia } from "elysia";
import {
  activateTotp,
  loginUser,
  registerUser,
} from "../services/auth.service";
import { config } from "../config";
import {
  createUserSession,
  getUserSession,
  revokeUserSession,
} from "../services/session.service";
import {
  findUserAvatar,
  updateUserAvatar,
} from "../repositories/user.repository";
import { updateProfileDocument } from "../services/profile.service";
import { toPublicUser } from "../mappers/user.mapper";
import { HttpError } from "../utils/errors";
import { isRecord } from "../utils/guards";
import {
  clearSessionCookie,
  createSessionCookie,
  readSessionCookie,
} from "../utils/session-cookie";
import {
  parseCredentials,
  parseCpfBody,
  parseRegisterBody,
} from "../validators/auth.validators";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/register", async ({ body, set }) => {
    const result = await registerUser(parseRegisterBody(body));
    set.status = 201;
    return result;
  })
  .post("/totp/activate", ({ body, request, server }) =>
    activateTotp(
      parseCredentials(body, "Dados de ativação inválidos."),
      server?.requestIP(request)?.address ?? null,
    ),
  )
  .post("/login", async ({ body, headers, request, server, set }) => {
    const result = await loginUser(
      parseCredentials(body, "Dados de login inválidos."),
      server?.requestIP(request)?.address ?? null,
    );

    if (!("userId" in result) || typeof result.userId !== "number") {
      return result;
    }

    const previousToken = readSessionCookie(headers.cookie);
    if (previousToken) revokeUserSession(previousToken);

    const session = createUserSession(result.userId);
    set.headers["Set-Cookie"] = createSessionCookie(session.token);
    return {
      authenticated: true,
      user: result.user,
      authenticatedAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  })
  .get("/me", ({ headers, set }) => {
    const token = readSessionCookie(headers.cookie);
    const session = token ? getUserSession(token) : null;
    if (!session) {
      set.headers["Set-Cookie"] = clearSessionCookie();
      throw new HttpError(401, "Sessão não autenticada.");
    }

    return {
      user: toPublicUser(session.user),
      authenticatedAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  })
  .put("/me/document", ({ body, headers }) => {
    if (headers.origin !== config.webOrigin) {
      throw new HttpError(403, "Origem da solicitação não permitida.");
    }

    const token = readSessionCookie(headers.cookie);
    const session = token ? getUserSession(token) : null;
    if (!session) throw new HttpError(401, "Sessão não autenticada.");

    const document = parseCpfBody(body);
    updateProfileDocument(session.user.id, document);

    return { document };
  })
  .post("/logout", ({ headers, set }) => {
    if (headers.origin !== config.webOrigin) {
      throw new HttpError(403, "Origem da solicitação não permitida.");
    }
    const token = readSessionCookie(headers.cookie);
    if (token) revokeUserSession(token);
    set.headers["Set-Cookie"] = clearSessionCookie();
    return { loggedOut: true };
  })
  .post("/avatar", async ({ body, headers }) => {
    if (headers.origin !== config.webOrigin) {
      throw new HttpError(403, "Origem da solicitação não permitida.");
    }
    const token = readSessionCookie(headers.cookie);
    const session = token ? getUserSession(token) : null;
    if (!session) throw new HttpError(401, "Sessão não autenticada.");
    if (!isRecord(body) || !(body.photo instanceof File)) {
      throw new HttpError(400, "Envie uma imagem de perfil válida.");
    }

    const photo = body.photo;
    if (photo.size === 0 || photo.size > 2 * 1024 * 1024) {
      throw new HttpError(400, "A foto deve ter no máximo 2 MB.");
    }

    const bytes = new Uint8Array(await photo.arrayBuffer());
    const isJpeg =
      photo.type === "image/jpeg" &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
    const isPng =
      photo.type === "image/png" &&
      Buffer.from(bytes.slice(0, 8)).toString("hex") ===
        "89504e470d0a1a0a";
    const isWebp =
      photo.type === "image/webp" &&
      Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
      Buffer.from(bytes.slice(8, 12)).toString() === "WEBP";

    if (!isJpeg && !isPng && !isWebp) {
      throw new HttpError(400, "Use uma imagem JPEG, PNG ou WebP válida.");
    }

    updateUserAvatar(session.user.id, bytes, photo.type);
    return { uploaded: true };
  })
  .get("/avatar", ({ headers, set }) => {
    const token = readSessionCookie(headers.cookie);
    const session = token ? getUserSession(token) : null;
    if (!session) throw new HttpError(401, "Sessão não autenticada.");

    const avatar = findUserAvatar(session.user.id);
    if (!avatar) throw new HttpError(404, "A foto de perfil não foi definida.");

    set.headers["Cache-Control"] = "private, no-store";
    set.headers["X-Content-Type-Options"] = "nosniff";
    return new Response(Buffer.from(avatar.data), {
      headers: { "Content-Type": avatar.mime },
    });
  });
