export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json();
    const data = body?.data;

    if (!data) {
      return Response.json({ error: "이미지 없음" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const deleteToken = crypto.randomUUID();

    await context.env.PUZZLE_IMAGES.put(
      id,
      JSON.stringify({
        data,
        deleteToken,
      })
    );

    return Response.json({ id, deleteToken });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}