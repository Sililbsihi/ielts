/** 客户端文件抽取 + 词法处理（导入向导共用） */

export type Progress = (msg: string, pct?: number) => void;

/** 从各类文件抽取纯文本：txt/md 直读；pdf→pdfjs；图片→Tesseract OCR；docx→服务端 mammoth */
export async function extractTextFromFile(file: File, onProgress?: Progress): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md")) return file.text();
  if (name.endsWith(".docx")) {
    onProgress?.("解析 Word 文档…", 30);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/extract-docx", { method: "POST", body: form });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Word 解析失败");
    return json.text as string;
  }
  if (name.endsWith(".pdf")) {
    onProgress?.("加载 PDF 引擎…", 10);
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.(`抽取第 ${i}/${doc.numPages} 页文字…`, 10 + Math.round((i / doc.numPages) * 85));
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
    }
    return text;
  }
  if (/\.(png|jpe?g|webp|bmp)$/.test(name)) {
    onProgress?.("OCR 引擎加载中（首次较慢）…", 10);
    const Tesseract = await import("tesseract.js");
    onProgress?.("识别图片文字中…", 20);
    const result = await Tesseract.recognize(file, "eng", {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") onProgress?.(`识别中 ${Math.round(m.progress * 100)}%`, 20 + m.progress * 75);
      },
    });
    return result.data.text;
  }
  // 兜底：按纯文本读
  return file.text();
}

export function normWord(w: string): string {
  return String(w).trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export interface ParsedWord {
  word: string;
  meaning: string;
  is_phrase: boolean;
  freq: number; // 文章模式下的出现次数
}

const SEPARATORS = /\t+|\s*[—–]\s*|\s+-\s+|：|:/;

/** 词表模式：一行一词/短语，可带释义（tab/——/: 分隔） */
export function parseWordList(text: string): ParsedWord[] {
  const map = new Map<string, ParsedWord>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.split(SEPARATORS);
    const word = (m[0] ?? "").trim();
    if (!word || word.length > 80) continue;
    if (!/^[A-Za-z][A-Za-z'\-.\s]*$/.test(word)) continue; // 只收英文词/短语
    const meaning = m.slice(1).join(";").trim().slice(0, 200);
    const key = normWord(word);
    if (!key) continue;
    const prev = map.get(key);
    if (prev) {
      if (!prev.meaning && meaning) prev.meaning = meaning;
      prev.freq += 1;
    } else {
      map.set(key, { word: word.trim(), meaning, is_phrase: /\s/.test(word), freq: 1 });
    }
  }
  return [...map.values()];
}

/** 文章模式：连续英文文本 → 去重单词表（含频次），排除纯单字母与数字 */
export function tokenizeProse(text: string): ParsedWord[] {
  const map = new Map<string, ParsedWord>();
  const tokens = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  for (const t of tokens) {
    const key = normWord(t);
    if (!key || key.length < 2) continue; // 排除 a/I 等单字母与噪声
    if (/^(?:'s|n't|'re|'ve|'ll|'d)$/.test(key)) continue;
    const prev = map.get(key);
    if (prev) prev.freq += 1;
    else map.set(key, { word: key, meaning: "", is_phrase: false, freq: 1 });
  }
  return [...map.values()].sort((a, b) => b.freq - a.freq || a.word.localeCompare(b.word));
}
