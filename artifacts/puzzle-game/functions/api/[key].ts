export async function onRequestGet(context: any) {
  const key = context.params.key;

  const object = await context.env.PUZZLE_IMAGES.get(key);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType || "application/octet-stream",
    },
  });
}

// (선택) 삭제 기능까지 쓰고 싶으면 아래도 유지
export async function onRequestDelete(context: any) {
  const key = context.params.key;

  await context.env.PUZZLE_IMAGES.delete(key);

  return Response.json({ success: true });
}