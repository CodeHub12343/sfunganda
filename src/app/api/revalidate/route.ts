import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// Called by the outbox worker on publish/unpublish. Signed with a shared
// secret so untrusted callers cannot flush the cache.
export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: { code: "forbidden", message: "bad secret" } }, { status: 403 });
  }
  const url = new URL(request.url);
  const tag = url.searchParams.get("tag");
  if (!tag) {
    return NextResponse.json({ error: { code: "bad_request", message: "tag required" } }, { status: 400 });
  }
  try {
    revalidateTag(tag);
  } catch (err) {
    return NextResponse.json(
      { error: { code: "internal_error", message: (err as Error).message } },
      { status: 500 }
    );
  }
  return NextResponse.json({ data: { ok: true, tag } });
}
