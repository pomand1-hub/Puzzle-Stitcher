//force deploy
async function readStoredObject(context: any, key: string) {
  const object = await context.env.PUZZLE_IMAGES.get(key);
  if (!object) return null;

  const text = await object.text();
  return JSON.parse(text);
}

export async function onRequest(context: any) {
  const method = context.request.method;
  const key = context.params.key;

  if (!key) {
    return Response.json({ error: "Key 없음" }, { status: 400 });
  }

  try {
    if (method === "GET") {
      const stored = await readStoredObject(context, key);

      if (!stored) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }

      return Response.json({
        data: stored.data,
      });
    }

    if (method === "DELETE") {
      const auth = context.request.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

      const stored = await readStoredObject(context, key);

      if (!stored) {
        return Response.json({ success: true });
      }

      if (!token || token !== stored.deleteToken) {
        return Response.json({ error: "삭제 권한 없음" }, { status: 401 });
      }

      await context.env.PUZZLE_IMAGES.delete(key);

      return Response.json({ success: true });
    }

    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, DELETE" },
    });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "처리 실패" },
      { status: 500 }
    );
  }
}