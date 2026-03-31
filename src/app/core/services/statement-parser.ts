import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

// Serve worker from local assets (angular.json configured)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

export interface ParsedStatement {
  filename: string;
  amount: number | null;
  rawText: string;
}

@Injectable({ providedIn: 'root' })
export class StatementParserService {
  async parseFile(file: File): Promise<ParsedStatement> {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return Promise.race([
        this.parsePDF(file),
        new Promise<ParsedStatement>(resolve =>
          setTimeout(() => resolve({ filename: file.name, amount: null, rawText: '' }), 12000)
        ),
      ]);
    }
    return { filename: file.name, amount: null, rawText: '' };
  }

  private async parsePDF(file: File): Promise<ParsedStatement> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
      }

      return {
        filename: file.name,
        amount: this.extractAmount(fullText),
        rawText: fullText,
      };
    } catch (err) {
      console.error('[StatementParser] PDF parsing failed:', err);
      return { filename: file.name, amount: null, rawText: '' };
    }
  }

  private extractAmount(text: string): number | null {
    // Normalize: collapse whitespace
    const t = text.replace(/\s+/g, ' ');

    // Ordered by specificity for Argentine bank statements
    const patterns = [
      /TOTAL\s+A\s+PAGAR\s*[:\-]?\s*\$?\s*([\d.,]+)/i,
      /IMPORTE\s+A\s+PAGAR\s*[:\-]?\s*\$?\s*([\d.,]+)/i,
      /IMPORTE\s+TOTAL\s*[:\-]?\s*\$?\s*([\d.,]+)/i,
      /TOTAL\s+DEL\s+RESUMEN\s*[:\-]?\s*\$?\s*([\d.,]+)/i,
      /SALDO\s+AL\s+VENCIMIENTO\s*[:\-]?\s*\$?\s*([\d.,]+)/i,
      /SALDO\s+DEUDOR\s*[:\-]?\s*\$?\s*([\d.,]+)/i,
      /TOTAL\s+RESUMEN\s*[:\-]?\s*\$?\s*([\d.,]+)/i,
      // Santander: "DEBITAREMOS DE SU C.C.XXXXXXXX LA SUMA DE $ 2.173.445,98"
      /LA\s+SUMA\s+DE\s+\$\s*([\d.,]+)/i,
    ];

    for (const pattern of patterns) {
      // Collect all matches — some PDFs (e.g. Mercado Pago) have a garbled first
      // occurrence and a correct one later. Prefer the match that includes a comma
      // (complete decimal), otherwise take the last match found.
      const globalPattern = new RegExp(pattern.source, 'gi');
      const allMatches = [...t.matchAll(globalPattern)];
      if (allMatches.length === 0) continue;

      const withComma = allMatches.filter(m => m[1].includes(','));
      const best = withComma.length > 0
        ? withComma[withComma.length - 1]
        : allMatches[allMatches.length - 1];

      const amount = this.parseArgentineNumber(best[1]);
      if (amount !== null && amount > 0) return amount;
    }

    return null;
  }

  // Handles both "1.234.567,89" and "1234567.89" formats
  private parseArgentineNumber(raw: string): number | null {
    // Remove anything that isn't digit, dot, or comma
    const clean = raw.replace(/[^\d.,]/g, '');
    if (!clean) return null;

    const dots = (clean.match(/\./g) || []).length;
    const commas = (clean.match(/,/g) || []).length;

    let normalized: string;
    if (commas === 1 && dots >= 1) {
      // Argentine format: 1.234.567,89
      normalized = clean.replace(/\./g, '').replace(',', '.');
    } else if (dots === 1 && commas === 0) {
      // Plain decimal: 1234567.89
      normalized = clean;
    } else if (commas === 0 && dots === 0) {
      normalized = clean;
    } else {
      // Fallback: remove all separators except last comma as decimal
      normalized = clean.replace(/\./g, '').replace(',', '.');
    }

    const n = parseFloat(normalized);
    return isNaN(n) ? null : n;
  }
}
