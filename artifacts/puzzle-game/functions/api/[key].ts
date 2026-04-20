type StoreValue = {
  data: string;
  createdAt: number;
  deleteToken: string;
};

async function readStoredObject(context: any, key: string): Promise<StoreValue | null> {
  const object = await context.env.PUZZLE_IMAGES.get(key);
  if (!object) return null;

  const text = await object.text();
  return JSON.parse(text) as StoreValue;
}

export async function onRequestGet(context: any) {
  try {
    const key = context.params.key;

    if (!key) {
      return Response.json({ error: "Key 없음" }, { status: 400 });
    }

    const stored = await readStoredObject(context, key);

    if (!stored) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({
      data: stored.data,
    });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "이미지 불러오기 실패" },
      { status: 500 }
    );
  }
}

export async function onRequestDelete(context: any) {
  try {
    const key = context.params.key;

    if (!key) {
      return Response.json({ error: "Key 없음" }, { status: 400 });
    }

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
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "삭제 실패" },
      { status: 500 }
    );
  }
}