export async function onRequest(context: any) {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  try {
    const body = await context.request.json();
    const data = body?.data;

    if (!data || typeof data !== "string") {
      return Response.json(
        { error: "이미지 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const deleteToken = crypto.randomUUID();

    await context.env.PUZZLE_IMAGES.put(
      id,
      JSON.stringify({
        data,
        deleteToken,
        createdAt: Date.now(),
      }),
      {
        httpMetadata: {
          contentType: "application/json",
        },
      }
    );

    return Response.json({
      id,
      deleteToken,
    });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "업로드 실패" },
      { status: 500 }
    );
  }
}