"use client";
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Upload, 
  Loader2, 
  Copy, 
  Download, 
  FileText, 
  Zap, 
  ScanText, 
  Copyright,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { cn } from '@/lib/utils';

export default function OCRToolPage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Configuração dinâmica do Worker para evitar erros de compilação/build no Next.js
    // Versões 4.x do pdfjs-dist utilizam módulos ESM (.mjs)
    const version = pdfjsLib.version;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setExtractedText('');
    setProgress(0);
    setStatus('Iniciando Motores de Visão...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      let fullText = '';

      // Tesseract.js Worker para português
      const worker = await createWorker('por', 1);

      for (let i = 1; i <= totalPages; i++) {
        setStatus(`Processando Página ${i} de ${totalPages}...`);
        const page = await pdf.getPage(i);
        
        // Escala 2.0 para equilíbrio entre performance e precisão de OCR
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context!, viewport }).promise;
        const imageData = canvas.toDataURL('image/png');

        const { data: { text } } = await worker.recognize(imageData);
        fullText += `\n--- PÁGINA ${i} ---\n${text}\n`;
        
        setProgress(Math.round((i / totalPages) * 100));
      }

      await worker.terminate();
      setExtractedText(fullText.toUpperCase());
      toast({ title: "Transcrição Concluída", description: `${totalPages} páginas processadas.` });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Falha no OCR", description: "Não foi possível transcrever este arquivo.", variant: "destructive" });
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const copyToClipboard = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    toast({ title: "Copiado", description: "Texto pronto para o gabinete." });
  };

  const downloadTxt = () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Transcricao_LP_${new Date().getTime()}.txt`;
    link.click();
  };

  return (
    <div className="flex h-screen bg-[#f3f2f2] font-sans text-black relative z-10 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 border-b border-[#dddbda] bg-white flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-4">
             <div className="icon-3d-wrapper shrink-0">
               <div className="icon-3d-block black w-10 h-10 rounded-sm bg-black flex items-center justify-center">
                 <ScanText size={20} className="text-white" />
               </div>
             </div>
             <h1 className="font-black text-xl uppercase tracking-tighter">Motor de OCR Soberano</h1>
          </div>
          <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[10px]">Visão Neural Local</Badge>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-8 pb-20">
           <section className="bg-white border-2 border-black rounded-none p-8 lg:p-10 shadow-[10px_10px_0px_#000] space-y-6">
              <div className="space-y-2">
                 <h2 className="text-2xl font-black uppercase tracking-tight">Transcrição de Digitalizados</h2>
                 <p className="text-black/60 font-black uppercase text-[10px] tracking-widest leading-relaxed">
                   Converta scans de contratos e procurações em texto editável para triagem neural instantânea.
                 </p>
              </div>

              <div onClick={() => !loading && fileInputRef.current?.click()} className={cn(
                "border-2 border-dashed border-black/20 p-12 lg:p-20 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-black group transition-all rounded-none",
                loading && "pointer-events-none opacity-50"
              )}>
                 {loading ? (
                   <div className="space-y-8 w-full max-w-sm">
                      <div className="relative">
                        <Loader2 className="animate-spin text-black group-hover:text-white mx-auto" size={48} />
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black group-hover:text-white">{progress}%</div>
                      </div>
                      <div className="space-y-3">
                         <p className="font-black uppercase text-[10px] animate-pulse group-hover:text-white">{status}</p>
                         <Progress value={progress} className="h-2 bg-gray-100 border border-black rounded-none [&>div]:bg-black group-hover:border-white group-hover:[&>div]:bg-white" />
                      </div>
                   </div>
                 ) : (
                   <>
                      <Upload size={48} className="text-black/20 group-hover:text-white mb-6" />
                      <h3 className="font-black uppercase text-lg group-hover:text-white">Selecionar PDF / Scan</h3>
                      <p className="text-[10px] font-black uppercase text-black/40 group-hover:text-white/40 tracking-[0.2em] mt-2">Privacidade Total • Processamento Local</p>
                   </>
                 )}
                 <input type="file" accept=".pdf,image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              </div>
           </section>

           {extractedText && (
             <Card className="bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000] animate-in slide-in-from-bottom-4 duration-500">
               <CardHeader className="bg-black text-white p-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <FileText size={14} /> Texto Extraído
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-8 text-[9px] font-black uppercase hover:bg-white hover:text-black rounded-none border border-white/20">
                      <Copy size={12} className="mr-2" /> Copiar Tudo
                    </Button>
                    <Button variant="ghost" size="sm" onClick={downloadTxt} className="h-8 text-[9px] font-black uppercase hover:bg-white hover:text-black rounded-none border border-white/20">
                      <Download size={12} className="mr-2" /> Salvar .TXT
                    </Button>
                  </div>
               </CardHeader>
               <CardContent className="p-0 border-t-2 border-black">
                  <ScrollArea className="h-[400px] bg-[#fafafa]">
                     <pre className="p-8 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-black/80 font-bold uppercase">
                       {extractedText}
                     </pre>
                  </ScrollArea>
               </CardContent>
             </Card>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
              <div className="bg-white border-2 border-black p-6 rounded-none space-y-4 shadow-[4px_4px_0px_#00D1FF]">
                 <div className="flex items-center gap-3 text-black">
                    <Zap size={20} />
                    <h4 className="font-black uppercase text-xs">Instrução Técnica</h4>
                 </div>
                 <p className="text-[10px] font-bold uppercase text-black/60 leading-relaxed tracking-wider">
                   Para máxima fidelidade, utilize PDFs com resolução de 300 DPI. O reconhecimento é otimizado para o idioma português.
                 </p>
              </div>
              <div className="bg-white border-2 border-black p-6 rounded-none space-y-4 shadow-[4px_4px_0px_#22c55e]">
                 <div className="flex items-center gap-3 text-black">
                    <BookOpen size={20} />
                    <h4 className="font-black uppercase text-xs">Aviso de Sigilo</h4>
                 </div>
                 <p className="text-[10px] font-bold uppercase text-black/60 leading-relaxed tracking-wider">
                   Nenhum dado sai do seu computador durante a transcrição visual. A tecnologia Tesseract.js opera integralmente na memória local.
                 </p>
              </div>
           </div>
        </div>

        <footer className="h-10 border-t border-[#dddbda] bg-white flex items-center justify-center gap-6 text-[10px] text-black/60 font-black uppercase tracking-[0.2em] shrink-0 hover:bg-black hover:text-white transition-all cursor-default">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span className="uppercase font-black">Transcrição Soberana • DAVI ALVES FIGUEREDO</span>
        </footer>
      </main>
    </div>
  );
}
