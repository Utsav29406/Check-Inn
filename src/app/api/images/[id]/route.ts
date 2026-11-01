import { query } from "@/lib/db";

/** Serves an uploaded photo. Photos never change once saved, so browsers and Vercel's CDN keep them for a year. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Not found", { status: 404 });
  const [img] = await query<{ content_type: string; data: Buffer }>("SELECT content_type, data FROM images WHERE id = $1", [id]);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.content_type,
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
