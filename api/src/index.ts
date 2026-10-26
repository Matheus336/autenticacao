import { app } from "./app";
import { config } from "./config";

app.listen(config.port);

console.log(`App running at ${app.server?.hostname}:${app.server?.port}`);
