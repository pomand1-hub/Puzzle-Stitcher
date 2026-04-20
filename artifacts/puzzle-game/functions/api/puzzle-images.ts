type StoreValue = {
  data: string;
  createdAt: number;
  deleteToken: string;
};

function makeDeleteToken() {
  return crypto.randomUUID();
}

export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json();
    const data = body?.data;

    if (!data || typeof data !== "string") {
      return Response.json({ error: "이미지 데이터가 없습니다." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const deleteToken = makeDeleteToken();

    const value: StoreValue = {
      data,
      createdAt: Date.now(),
      deleteToken,
    };

    await context.env.PUZZLE_IMAGES.put(id, JSON.stringify(value), {
      httpMetadata: {
        contentType: "application/json",
      },
    });

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