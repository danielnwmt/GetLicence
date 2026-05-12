#!/usr/bin/env node
import http from "node:http";
import process from "node:process";
import { Readable } from "node:stream";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);

async function loadApp() {
  const entry = await import("../.output/server/index.mjs");
  const app = entry.default ?? entry;

  if (!app || typeof app.fetch !== "function") {
    throw new Error("Build inválido: .output/server/index.mjs não exporta fetch(). Rode bun run build novamente.");
  }

  return app;
}

function requestUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const hostHeader = req.headers.host || `${host}:${port}`;
  return `${proto}://${hostHeader}${req.url || "/"}`;
}

function requestBody(req) {
  if (["GET", "HEAD"].includes(req.method || "GET")) return undefined;
  return Readable.toWeb(req);
}

function writeResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));

  if (!response.body) {
    res.end();
    return;
  }

  Readable.fromWeb(response.body).pipe(res);
}

const app = await loadApp();

const server = http.createServer(async (req, res) => {
  try {
    const request = new Request(requestUrl(req), {
      method: req.method,
      headers: req.headers,
      body: requestBody(req),
      duplex: "half",
    });

    const response = await app.fetch(request, process.env, {
      waitUntil: () => undefined,
      passThroughOnException: () => undefined,
    });

    writeResponse(res, response);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Erro interno do GetLicence");
  }
});

server.listen(port, host, () => {
  console.log(`GetLicence ouvindo em http://${host}:${port}`);
});