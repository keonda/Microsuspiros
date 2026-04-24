declare module "pdf-parse" {
  export type PdfParseResult = {
    numpages: number;
    numrender: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    text: string;
    version?: string;
  };

  export default function pdfParse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  import pdfParse from "pdf-parse";
  export = pdfParse;
}
