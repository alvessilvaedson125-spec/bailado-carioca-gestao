import express, { type Express } from "express";
import path from "path";

export function serveStatic(app: Express) {
  const clientPath = path.resolve(__dirname, "..", "client");
  const publicPath = path.resolve(clientPath, "public");

  // Serve static files from client/public (app.js, style.css, etc.)
  app.use(express.static(publicPath));
  
  // Serve other static files from client folder (logo, etc.)
  app.use(express.static(clientPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(clientPath, "index.html"));
  });
}
