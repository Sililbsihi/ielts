/** docx 文字抽取（服务端 mammoth）：POST formData(file) → {text} */
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "缺少文件" }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return NextResponse.json({ ok: true, text: value.slice(0, 500000) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "解析失败" }, { status: 500 });
  }
}
