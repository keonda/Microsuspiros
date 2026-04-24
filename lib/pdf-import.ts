import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { ResourceExtractionStatus } from "@prisma/client";

const MAX_PDF_IMPORT_SIZE = 25 * 1024 * 1024;
const require = createRequire(import.meta.url);

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
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as typeof import("pdf-parse").default;
    const parsed = await pdfParse(buffer);
    const text = normalizePdfText(parsed.text || "");
    if (!text) {
      return {
        status: "NO_TEXT",
        text: null,
        pageCount: parsed.numpages || null,
        error: "This PDF appears to be scanned or image-based. OCR is not supported yet."
      };
    }
    return {
      status: "EXTRACTED",
      text,
      pageCount: parsed.numpages || null,
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

export type DetectedPdfSection = {
  id: string;
  title: string;
  startIndex: number;
  endIndex: number;
  text: string;
  confidence: number;
  detectedPattern: string;
  include: boolean;
  warnings?: string[];
};

const MIN_SECTION_CHARS = 1200;
const MAX_SECTIONS = 120;

const chapterPatterns: { name: string; regex: RegExp; baseConfidence: number }[] = [
  { name: "chapter-number", regex: /^chapter\s+\d+\b[\s:.-]*(.*)$/i, baseConfidence: 0.92 },
  { name: "chapter-word", regex: /^chapter\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b[\s:.-]*(.*)$/i, baseConfidence: 0.88 },
  { name: "chapter-roman", regex: /^chapter\s+[ivxlcdm]+\b[\s:.-]*(.*)$/i, baseConfidence: 0.88 },
  { name: "numbered-title", regex: /^\d{1,2}\.\s+.{2,80}$/i, baseConfidence: 0.78 },
  { name: "number-dash-title", regex: /^\d{1,2}\s+[-\u2013\u2014]\s+.{2,80}$/i, baseConfidence: 0.78 },
  { name: "part", regex: /^part\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b.*$/i, baseConfidence: 0.72 },
  { name: "act", regex: /^act\s+(\d+|[ivxlcdm]+|one|two|three|four|five)\b.*$/i, baseConfidence: 0.7 },
  { name: "scene", regex: /^scene\s+\d+\b.*$/i, baseConfidence: 0.66 },
  { name: "front-back-matter", regex: /^(prologue|epilogue|interlude)$/i, baseConfidence: 0.82 }
];

export function detectPdfSections(text: string): { sections: DetectedPdfSection[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines = text.split("\n");
  const candidates: { title: string; index: number; pattern: string; confidence: number }[] = [];
  let index = 0;

  for (const line of lines) {
    const raw = line;
    const trimmed = raw.trim();
    const lineStart = index + raw.search(/\S|$/);
    index += raw.length + 1;
    if (!trimmed || trimmed.length > 90) continue;
    if (/[.!?]$/.test(trimmed) && trimmed.split(/\s+/).length > 6) continue;

    const matched = chapterPatterns.find((pattern) => pattern.regex.test(trimmed));
    if (!matched) continue;

    const shortLineBoost = trimmed.length <= 42 ? 0.05 : 0;
    const capsBoost = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) ? 0.06 : 0;
    const title = titleFromHeading(trimmed);
    candidates.push({
      title,
      index: lineStart,
      pattern: matched.name,
      confidence: Math.min(0.98, matched.baseConfidence + shortLineBoost + capsBoost)
    });
  }

  const normalizedCounts = new Map<string, number>();
  for (const candidate of candidates) normalizedCounts.set(candidate.title.toLowerCase(), (normalizedCounts.get(candidate.title.toLowerCase()) || 0) + 1);
  const filtered = candidates.filter((candidate) => (normalizedCounts.get(candidate.title.toLowerCase()) || 0) <= 3);
  if (filtered.length !== candidates.length) warnings.push("Some repeated chapter-like headings were ignored because they appeared too often.");

  if (!filtered.length) {
    return {
      sections: [
        {
          id: "section-1",
          title: "Imported PDF",
          startIndex: 0,
          endIndex: text.length,
          text,
          confidence: 0.35,
          detectedPattern: "single-document-fallback",
          include: true,
          warnings: ["PDF text extracted successfully, but no chapters were detected."]
        }
      ],
      warnings: ["PDF text extracted successfully, but no chapters were detected."]
    };
  }

  const sections = filtered.map((candidate, order) => {
    const endIndex = filtered[order + 1]?.index ?? text.length;
    const sectionText = text.slice(candidate.index, endIndex).trim();
    const tooShort = sectionText.length < MIN_SECTION_CHARS;
    return {
      id: `section-${order + 1}`,
      title: candidate.title || `Section ${order + 1}`,
      startIndex: candidate.index,
      endIndex,
      text: sectionText,
      confidence: tooShort ? Math.max(0.2, candidate.confidence - 0.25) : candidate.confidence,
      detectedPattern: candidate.pattern,
      include: true,
      warnings: tooShort ? ["This section is short; review before importing."] : []
    };
  });

  if (sections.length > MAX_SECTIONS) warnings.push("Chapter detection found many sections; review carefully before importing.");
  if (sections.some((section) => section.confidence < 0.55)) warnings.push("Chapter detection uncertain; review before importing.");
  if (sections.filter((section) => section.text.length < MIN_SECTION_CHARS).length > sections.length / 2) {
    warnings.push("Many detected sections are very short, so the split may be noisy.");
  }

  return { sections, warnings };
}

export function applyManualSplitMarker(text: string, marker: string) {
  const trimmed = marker.trim();
  if (!trimmed) return detectPdfSections(text);
  const indexes: number[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const found = text.toLowerCase().indexOf(trimmed.toLowerCase(), cursor);
    if (found === -1) break;
    indexes.push(found);
    cursor = found + trimmed.length;
  }
  if (!indexes.length) return detectPdfSections(text);
  const sections = indexes.map((startIndex, order) => {
    const endIndex = indexes[order + 1] ?? text.length;
    const sectionText = text.slice(startIndex, endIndex).trim();
    return {
      id: `manual-${order + 1}`,
      title: firstMeaningfulLine(sectionText) || `Manual section ${order + 1}`,
      startIndex,
      endIndex,
      text: sectionText,
      confidence: 0.7,
      detectedPattern: `manual: ${trimmed}`,
      include: true,
      warnings: sectionText.length < MIN_SECTION_CHARS ? ["This section is short; review before importing."] : []
    };
  });
  return { sections, warnings: [`Re-ran detection using manual split marker: ${trimmed}`] };
}

export function mergeSections(sections: DetectedPdfSection[], mergePreviousIds: Set<string>) {
  const merged: DetectedPdfSection[] = [];
  for (const section of sections) {
    if (mergePreviousIds.has(section.id) && merged.length) {
      const previous = merged[merged.length - 1];
      previous.endIndex = section.endIndex;
      previous.text = `${previous.text}\n\n${section.text}`.trim();
      previous.title = previous.title || section.title;
      previous.confidence = Math.min(previous.confidence, section.confidence);
      previous.detectedPattern = `${previous.detectedPattern} + merged`;
      previous.warnings = [...(previous.warnings || []), "Merged with following section."];
    } else {
      merged.push({ ...section });
    }
  }
  return merged.map((section, index) => ({ ...section, id: `section-${index + 1}` }));
}

function titleFromHeading(line: string) {
  return line.replace(/\s+/g, " ").trim().replace(/^chapter\b/i, "Chapter");
}

function firstMeaningfulLine(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && line.length <= 90);
}

// TODO: Add OCR support for scanned PDFs.
// TODO: Add AI-assisted chapter detection and automatic chapter title cleanup.
// TODO: Split by table of contents when reliable page-level extraction is available.
// TODO: Add DOCX import and EPUB import.
