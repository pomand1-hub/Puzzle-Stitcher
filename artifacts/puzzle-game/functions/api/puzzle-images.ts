export async function onRequestPost(context: any) {
  try {
    const formData = await context.request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return new Response("파일 없음", { status: 400 });
    }

    const key = `uploads/${Date.now()}-${file.name}`;

    await context.env.PUZZLE_IMAGES.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    return Response.json({
      success: true,
      key,
      url: `/api/puzzle-images/${key}`,
    });
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
}