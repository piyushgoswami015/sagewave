import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isValidJobId, jobDir, MIME, readMeta } from "@/lib/jobs";

export const runtime = "nodejs";

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

function streamFile(filePath: string, opts?: { start?: number; end?: number }): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(filePath, opts);
  return new ReadableStream({
    start(controller) {
      let closed = false;
      nodeStream.on("data", (chunk: Buffer | string) => {
        if (closed) return;
        try {
          const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
          controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
        } catch {
          closed = true;
          nodeStream.destroy();
        }
      });
      nodeStream.on("end", () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      });
      nodeStream.on("error", () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

/**
 * GET /api/files/:id/:file            → inline (for players / previews), supports Range
 * GET /api/files/:id/:file?download=1 → attachment with a friendly filename
 */
export async function HEAD(req: Request, ctx: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await ctx.params;
  if (!isValidJobId(id) || !SAFE_NAME.test(file)) {
    return new NextResponse(null, { status: 404 });
  }
  const dir = jobDir(id);
  const full = path.join(dir, file);
  const st = await fs.stat(full).catch(() => null);
  if (!st || !st.isFile()) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string; file: string }> }) {
  const session = await getSession();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id, file } = await ctx.params;
  if (!isValidJobId(id) || !SAFE_NAME.test(file) || file === "meta.json" || file.startsWith("raw_")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const dir = jobDir(id);
  const meta = await readMeta<{ downloadName?: string; owner?: string }>(dir);
  const userKey = session.user.email || session.user.name || "user";
  if (meta?.owner && meta.owner !== userKey) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const full = path.join(dir, file);
  const st = await fs.stat(full).catch(() => null);
  if (!st || !st.isFile()) return new NextResponse("This file has expired.", { status: 404 });

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  const url = new URL(req.url);
  const headers = new Headers({
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });

  if (url.searchParams.get("download")) {
    const name = file.startsWith("media") && meta?.downloadName ? meta.downloadName : file;
    headers.set("Content-Disposition", `attachment; filename="${name}"`);
  }

  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), st.size - 1) : st.size - 1;
      if (start <= end && start < st.size) {
        headers.set("Content-Range", `bytes ${start}-${end}/${st.size}`);
        headers.set("Content-Length", String(end - start + 1));
        return new NextResponse(streamFile(full, { start, end }), { status: 206, headers });
      }
    }
  }

  headers.set("Content-Length", String(st.size));
  return new NextResponse(streamFile(full), { status: 200, headers });
}
