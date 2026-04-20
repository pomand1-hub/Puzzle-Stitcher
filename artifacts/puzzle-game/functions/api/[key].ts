export async function onRequestGet(context: any) {
  try {
    const key = context.params.key;

    if (!key) {
      return new Response("Key 없음", { status: 400 });
    }

    const object = await context.env.PUZZLE_IMAGES.get(key);

    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        "Content-Type":
          object.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (e: any) {
    return new Response(e?.message || "이미지 불러오기 실패", {
      status: 500,
    });
  }
}

// (선택) 삭제 기능
export async function onRequestDelete(context: any) {
  try {
    const key = context.params.key;

    if (!key) {
      return new Response("Key 없음", { status: 400 });
    }

    await context.env.PUZZLE_IMAGES.delete(key);

    return Response.json({ success: true });
  } catch (e: any) {
    return new Response(e?.message || "삭제 실패", { status: 500 });
  }
}