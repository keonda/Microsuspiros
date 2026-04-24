import { readFile } from "node:fs/promises";
import type { ResourceExtractionStatus } from "@prisma/client";

const MAX_PDF_IMPORT_SIZE = 25 * 1024 * 1024;

export type PdfExtractionResult = {
  status: ResourceExtractionStatus;
  text: string | null;
  pageCount: number | null;
  error: string | null;
};

export async function extractPdfText(filePath: string, fileSize: number): Promise<PdfExtractionResult> {
  if (fileSize > MAX_PDF_IMPORT_SIZE) {
    return {
      status: "TOO_LARGE",
      text: null,
      pageCount: null,
      error: "PDF imports are limited to 25 MB for text extraction."
    };
  }

  try {
    const buffer = await readFile(filePath);
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = normalizePdfText(parsed.text || "");
    if (!text) {
      return {
        status: "NO_TEXT",
        text: null,
        pageCount: parsed.total || null,
        error: "No selectable text was found. Scanned PDFs may require OCR, which is not included yet."
      };
    }
    return {
      status: "EXTRACTED",
      text,
      pageCount: parsed.total || null,
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not extract text from this PDF.";
    const encrypted = /password|encrypted|decrypt/i.test(message);
    return {
      status: encrypted ? "ENCRYPTED" : "FAILED",
      text: null,
      pageCount: null,
      error: encrypted ? "This PDF appears to be encrypted or password protected." : message.slice(0, 500)
    };
  }
}

export function normalizePdfText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function pdfPreview(text: string | null | undefined) {
  if (!text) return "";
  return text.length > 4000 ? `${text.slice(0, 4000)}\n\n...` : text;
}
