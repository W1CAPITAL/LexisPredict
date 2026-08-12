"use client";
/**
 * Motor OCR: tenta endpoint externo (LEXIS_OCR_*) → fallback Tesseract local.
 * NER jurídico determinístico sobre o texto.
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
import { ocrViaAdapterAction, legalNerFromTextAction } from "@/app/actions/ocr-adapter-actions";
import type { LegalNerResult } from "@/lib/legal-ner";
import { cn } from "@/lib/utils";

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

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

  const runLocalTesseract = async (file: File) => {
    setStatus("OCR local (Tesseract)…");
    setProgress(5);
    const worker = await createWorker("por");
    let fullText = "";

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const data = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const totalPages = pdf.numPages;
      for (let i = 1; i <= totalPages; i++) {
        setStatus(`Página ${i}/${totalPages}`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const {
          data: { text },
        } = await worker.recognize(canvas);
        fullText += text + "\n\n";
        setProgress(Math.round((i / totalPages) * 100));
      }
    } else {
      setStatus("Imagem…");
      const {
        data: { text },
      } = await worker.recognize(file);
      fullText = text;
      setProgress(100);
    }
    await worker.terminate();
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setExtractedText("");
    setNer(null);
    setEngineUsed("");
    setProgress(0);

    try {
      // 1) Tenta OCR externo (server)
      setStatus("Tentando OCR externo…");
      const b64 = await fileToBase64(file);
      const ext = await ocrViaAdapterAction({
        base64: b64,
        filename: file.name,
        mimeType: file.type,
      });

      if (ext.success && ext.text) {
        setExtractedText(ext.text);
        setEngineUsed(ext.engine);
        setProgress(100);
        if (ext.ner) setNer(ext.ner);
        else await runNer(ext.text);
        toast({
          title: "OCR externo",
          description: `${ext.latencyMs}ms · ${ext.engine}`,
        });
        return;
      }

      // 2) Fallback local
      setStatus(ext.error || "Fallback local…");
      const local = await runLocalTesseract(file);
      const text = local.toUpperCase();
      setExtractedText(text);
      setEngineUsed("tesseract-local");
      await runNer(text);
      toast({ title: "OCR local concluído", description: "Tesseract (soberano)" });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Falha no OCR",
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
    const blob = new Blob([extractedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Transcricao_LP_${Date.now()}.txt`;
    link.click();
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
              <Badge variant="outline" className="text-[10px] font-bold uppercase">
                {engineUsed}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-[10px] font-bold uppercase">
              Externo → Local
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
                <h3 className="font-black uppercase text-sm">PDF / imagem</h3>
                <p className="text-[10px] text-muted-foreground uppercase mt-1">
                  Tenta OCR externo · fallback Tesseract local
                </p>
              </>
            )}
            <input
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
          </div>

          {ner ? (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Scale className="h-3.5 w-3.5" /> NER jurídico
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <p className="text-xs font-semibold">{ner.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(ner.byKind.cnj || []).map((v) => (
                    <Badge key={v} variant="default" className="text-[10px] font-mono">
                      CNJ {v}
                    </Badge>
                  ))}
                  {(ner.byKind.banco || []).map((v) => (
                    <Badge key={v} variant="secondary" className="text-[10px]">
                      {v}
                    </Badge>
                  ))}
                  {(ner.byKind.cpf || []).slice(0, 4).map((v) => (
                    <Badge key={v} variant="outline" className="text-[10px]">
                      CPF {v}
                    </Badge>
                  ))}
                  {(ner.byKind.cnpj || []).slice(0, 4).map((v) => (
                    <Badge key={v} variant="outline" className="text-[10px]">
                      CNPJ {v}
                    </Badge>
                  ))}
                  {(ner.byKind.oab || []).slice(0, 6).map((v) => (
                    <Badge key={`o${v}`} variant="outline" className="text-[10px]">
                      OAB {v}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {extractedText ? (
            <Card>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" /> Texto
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={copyToClipboard}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={downloadTxt}>
                    <Download className="h-3 w-3 mr-1" /> TXT
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 border-t border-border">
                <ScrollArea className="h-[360px]">
                  <pre className="p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {extractedText}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}
