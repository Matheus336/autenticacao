import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { resolve } from "path";
import { config } from "../config";
import { initializeSchema } from "./schema";

mkdirSync(config.dataDirectory, { recursive: true });

export const database = new Database(
  resolve(config.dataDirectory, "users.sqlite"),
);
initializeSchema(database);
