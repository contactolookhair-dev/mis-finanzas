declare module "pdf-parse/lib/pdf-parse.js" {
  import type { Buffer } from "buffer";
  type PdfParse = (buffer: Buffer) => Promise<{ text?: string }>;
  const parser: PdfParse;
  export default parser;
}
