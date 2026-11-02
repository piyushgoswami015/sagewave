import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isValidJobId } from "@/lib/jobs";
import { pollSeparation } from "@/lib/stems";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!isValidJobId(id)) return NextResponse.json({ error: "Invalid job." }, { status: 400 });

  const userKey = session.user.email || session.user.name || "user";
  try {
    const meta = await pollSeparation(id, userKey);
    return NextResponse.json({
      id: meta.id,
      status: meta.status,
      error: meta.error,
      files: meta.files,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
