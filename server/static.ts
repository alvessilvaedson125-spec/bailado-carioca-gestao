import express, { type Express } from "express";
import path from "path";
import fs from "fs";

export function serveStatic(app: Express) {
  // Try multiple possible paths for the client files
  const possiblePaths = [
    path.resolve(__dirname, "client"),           // dist/client (bundled)
    path.resolve(process.cwd(), "dist", "client"), // CWD/dist/client
    path.resolve(process.cwd(), "client"),       // CWD/client (fallback)
  ];

  let clientPath = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, "index.html"))) {
      clientPath = p;
      console.log(`[static] Serving from: ${clientPath}`);
      break;
    }
  }

  if (!clientPath) {
    console.error("[static] Could not find client files!");
    console.error("[static] Tried paths:", possiblePaths);
    console.error("[static] __dirname:", __dirname);
    console.error("[static] cwd:", process.cwd());
    return;
  }

  const publicPath = path.resolve(clientPath, "public");

  // Serve static files from client/public with no-cache for JS/CSS
  app.use(express.static(publicPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
  
  // Serve other static files from client folder (logo, etc.)
  app.use(express.static(clientPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(clientPath, "index.html"));
  });
}
