"use client";

/**
 * OCR 100% interno — pipeline inspirado no Unlimited-OCR (Baidu):
 * multi-página, raster HD, realce de documento, anti-repetição n-gram.
 * Reconhecimento: Tesseract local no browser (sem OCR.space / sem LLM).
 */

import React, { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Upload,
  Loader2,
  Copy,
  Download,
  FileText,
  ScanText,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import { legalNerFromTextAction } from "@/app/actions/ocr-adapter-actions";
import type { LegalNerResult } from "@/lib/legal-ner";
import {
  cleanDocumentText,
  enhanceCanvasForOcr,
  INTERNAL_OCR_ENGINE_LABEL,
} from "@/lib/ocr/internal-pipeline";
import { cn } from "@/lib/utils";

export default function OCRToolPage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [engineUsed, setEngineUsed] = useState("");
  const [ner, setNer] = useState<LegalNerResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const version = pdfjsLib.version;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  }, []);

  const runNer = async (text: string) => {
    const r = await legalNerFromTextAction(text);
    if (r.success) setNer(r.ner);
  };

  /** Rasteriza página PDF em canvas HD (estilo multi-page Unlimited-OCR). */
  async function pdfPageToCanvas(
    pdf: pdfjsLib.PDFDocumentProxy,
    pageNum: number,
    scale = 2
  ): Promise<HTMLCanvasElement> {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    return enhanceCanvasForOcr(canvas);
  }

  async function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Falha ao carregar imagem"));
        el.src = url;
      });
      const canvas = document.createElement("canvas");
      // escala mínima para textos miúdos (gundam-like densify)
      const maxSide = Math.max(img.width, img.height);
      const scale = maxSide < 1200 ? 2 : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return enhanceCanvasForOcr(canvas);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const runInternalOcr = async (file: File) => {
    setStatus("Motor interno · inicializando…");
    setProgress(3);
    // worker local — requer CSP worker-src blob: (middleware)
    const worker = await createWorker("por", 1, {
      logger: (m: any) => {
        if (m?.status === "recognizing text" && typeof m.progress === "number") {
          setProgress(Math.min(95, Math.round(m.progress * 100)));
        }
      },
    } as any);

    let pagesText: string[] = [];
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const data = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const totalPages = pdf.numPages;
        for (let i = 1; i <= totalPages; i++) {
          setStatus(`Página ${i}/${totalPages} (pipeline multi-page)`);
          setProgress(Math.round((i / totalPages) * 90));
          const canvas = await pdfPageToCanvas(pdf, i, 2);
          const result = await worker.recognize(canvas);
          const pageText = String(result?.data?.text || "").trim();
          if (pageText) {
            pagesText.push(`--- Página ${i} ---\n${pageText}`);
          }
        }
      } else {
        setStatus("Imagem · realce + reconhecimento…");
        setProgress(20);
        const canvas = await imageFileToCanvas(file);
        setProgress(50);
        const result = await worker.recognize(canvas);
        pagesText.push(String(result?.data?.text || "").trim());
      }
    } finally {
      try {
        await worker.terminate();
      } catch {
        /* ignore */
      }
    }

    const raw = pagesText.filter(Boolean).join("\n\n");
    const text = cleanDocumentText(raw);
    if (!text) {
      throw new Error(
        "Nenhum texto reconhecido. Use PDF/imagem legível (scan nítido). CSP deve permitir worker-src blob:."
      );
    }
    return text;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setExtractedText("");
    setNer(null);
    setEngineUsed("");
    setProgress(0);

    try {
      const text = await runInternalOcr(file);
      setExtractedText(text);
      setEngineUsed(INTERNAL_OCR_ENGINE_LABEL);
      setProgress(100);
      setStatus("Concluído");
      await runNer(text);
      toast({
        title: "OCR interno ok",
        description: `${text.length} caracteres · ${INTERNAL_OCR_ENGINE_LABEL}`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Falha no OCR interno",
        description: err?.message || "Não foi possível transcrever.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    toast({ title: "Copiado" });
  };

  const downloadTxt = () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Transcricao_LP_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-14 border-b border-border bg-card/60 backdrop-blur flex items-center justify-between px-4 sm:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <ScanText className="h-5 w-5" />
            <h1 className="font-black text-lg uppercase tracking-tight">OCR</h1>
          </div>
          <div className="flex items-center gap-2">
            {engineUsed ? (
              <Badge variant="outline" className="text-[10px] font-bold uppercase max-w-[240px] truncate">
                {engineUsed}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-[10px] font-bold uppercase">
              Somente interno
            </Badge>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-4 pb-16">
          <div
            className={cn(
              "border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-card/40",
              loading && "pointer-events-none opacity-80"
            )}
            onClick={() => !loading && fileInputRef.current?.click()}
          >
            {loading ? (
              <div className="space-y-4 w-full max-w-sm text-center">
                <Loader2 className="animate-spin mx-auto h-10 w-10" />
                <p className="text-[10px] font-black uppercase animate-pulse">{status}</p>
                <Progress value={progress} className="h-2" />
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-black uppercase text-sm tracking-wide">PDF / Imagem</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase mt-2 text-center max-w-md">
                  Motor interno · multi-página · realce de documento · anti-repetição
                  (técnicas Unlimited-OCR + Tesseract local)
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {extractedText ? (
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Transcrição
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={copyToClipboard}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadTxt}>
                    <Download className="h-3.5 w-3.5 mr-1" /> TXT
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[320px] rounded-md border p-3">
                  <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                    {extractedText}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : null}

          {ner ? (
            <Card className="border-border">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <Scale className="h-4 w-4" /> NER jurídico (local)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <pre className="whitespace-pre-wrap font-mono bg-muted/40 p-3 rounded-md overflow-auto max-h-48">
                  {JSON.stringify(ner, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}
