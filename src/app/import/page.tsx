"use client";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */

import React, { useState, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Upload, 
  Database, 
  Zap, 
  Eye, 
  Loader2,
  Copyright,
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCcw,
  ArrowRight
} from 'lucide-react';
import { LegalCase, processarCaso } from '@/lib/case-logic';
import { mapCsvRowToCanonical, sanitizeDateCell, sanitizeProtocolo } from '@/lib/csv-import-engine';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { importCsvAction } from '@/app/actions/import-actions';
import { cn } from '@/lib/utils';
import { useAdmin } from '@/hooks/use-admin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Utilitário de Parsing Robusto para Preview
 */
function parseCsvRow(row: string, separator: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export default function ImportPage() {
  const [parsing, setParsing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<LegalCase[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [textInput, setTextInput] = useState('');
  const [rawCsvText, setRawCsvText] = useState('');
  const [stats, setStats] = useState({ total: 0, valid: 0, skipped: 0, critical: 0, tribunals: 0 });
  const [importResults, setImportResults] = useState<any>(null);

  const { isOperador } = useAdmin();
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith('.csv')) {
        toast({ title: "Formato Inválido", description: "Utilize apenas arquivos .csv", variant: "destructive" });
        return;
      }
      parseFile(selected);
    }
  };

  const parseFile = async (file: File) => {
    setParsing(true);
    setProgress(0);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        setRawCsvText(text);
        await processRawText(text);
      } catch (err) {
        toast({ title: "Falha no Parsing", variant: "destructive" });
        setParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleTextImport = async () => {
    if (!textInput.trim()) return;
    setParsing(true);
    setRawCsvText(textInput);
    await processRawText(textInput);
  };

  const processRawText = async (text: string) => {
    const firstLine = text.split('\n')[0] || '';
    const separator = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
    
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;
    for (const char of text) {
      if (char === '"') inQuotes = !inQuotes;
      if (char === '\n' && !inQuotes) {
        lines.push(currentLine.replace(/\r$/, ''));
        currentLine = '';
      } else {
        currentLine += char;
      }
    }
    if (currentLine) lines.push(currentLine.replace(/\r$/, ''));

    const filteredLines = lines.filter(l => l.trim().length > 0);
    
    if (filteredLines.length < 2) {
      toast({ title: "Entrada Inválida", description: "O arquivo deve conter ao menos cabeçalho e um registro.", variant: "destructive" });
      setParsing(false);
      return;
    }

    const parsedCases: LegalCase[] = [];
    const totalRows = filteredLines.length;
    const rawHeaders = parseCsvRow(filteredLines[0], separator);
    let valid = 0;
    let skipped = 0;

    const alertLimit = parseInt(localStorage.getItem('lexisPredict_urgency_alert') || '3');

    for (let i = 1; i < filteredLines.length; i++) {
      let rowData: any = {};
      const fields = parseCsvRow(filteredLines[i], separator);
      
      rawHeaders.forEach((h, index) => {
        rowData[h] = fields[index] || '';
      });

      const canonical = mapCsvRowToCanonical(rowData);
      const cleanProtocolo = sanitizeProtocolo(canonical.protocolo);

      if (cleanProtocolo && cleanProtocolo.length >= 8) {
        try {
          const processed = processarCaso({
            ...canonical,
            protocolo: cleanProtocolo,
            statusManual: 'Automatico'
          }, { alertLimit });
          
          parsedCases.push(processed);
          valid++;
        } catch (e) {
          skipped++;
        }
      } else {
        skipped++;
      }
      
      if (i % 50 === 0) {
        setProgress(Math.round((i / totalRows) * 100));
        await new Promise(r => setTimeout(r, 1));
      }
    }

    setPreview(parsedCases);
    setStats({
      total: totalRows - 1,
      valid,
      skipped,
      critical: parsedCases.filter(c => c.risco === 'Crítico').length,
      tribunals: new Set(parsedCases.map(c => c.tribunal)).size
    });
    setStep('preview');
    setParsing(false);
  };

  const commitToStorage = async () => {
    if (!isOperador) {
       toast({ title: "Acesso Negado", description: "Permissão insuficiente para alterar o repositório.", variant: "destructive" });
       return;
    }
    if (!rawCsvText) return;

    setSyncing(true);
    try {
      const result = await importCsvAction(rawCsvText);
      if (result.success) {
        setImportResults(result);
        setStep('result');
        toast({ title: "Sincronia Concluída", description: result.message });
      } else {
        toast({ title: "Falha na Gravação", description: result.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro de Infraestrutura", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = "CLIENTE,PROTOCOLO,STATUS,OBSERVACOES,RETORNO,PROXIMO_RETORNO,ADVOGADO,TELEFONE,ASSISTENTE,ESCRITORIO";
    const example = "JOÃO DA SILVA,0000000-00.0000.0.00.0000,EM ANDAMENTO,Exemplo de observação,01/07/2026,15/07/2026,NOME DO ADVOGADO,11999999999,NOME ASSISTENTE,JVA / GM";
    const csvContent = "\uFEFF" + headers + "\n" + example;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "lexispredict_modelo_importacao.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetImport = () => {
    setTextInput('');
    setRawCsvText('');
    setPreview([]);
    setStep('upload');
    setProgress(0);
    setSyncing(false);
    setImportResults(null);
  };

  return (
    <div className="flex h-screen bg-[#f3f2f2] font-sans text-black relative z-10">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b border-[#dddbda] bg-white flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <h1 className="font-black text-xl text-black uppercase hover:bg-black hover:text-white px-2 py-1 transition-all rounded-sm cursor-default">Ingestão SaaS Pro</h1>
            <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[10px]">Neural Mapping v2.0</Badge>
          </div>
          <div className="flex items-center gap-4">
             {step === 'preview' && (
               <Button onClick={resetImport} variant="ghost" disabled={syncing} className="font-black uppercase text-[10px] hover:bg-red-600 hover:text-white border-2 border-transparent hover:border-black rounded-none">Descartar</Button>
             )}
             {step !== 'result' && (
               <Button 
                 disabled={step === 'upload' || parsing || syncing} 
                 onClick={commitToStorage} 
                 className="bg-black text-white border-2 border-black hover:bg-white hover:text-black font-black px-8 transition-all uppercase text-[10px] rounded-none shadow-[4px_4px_0px_#000] hover:shadow-none"
                >
                 {syncing ? <><Loader2 className="animate-spin mr-2" /> Gravando...</> : "Confirmar & Sincronizar"}
               </Button>
             )}
             {step === 'result' && (
               <Button onClick={resetImport} className="bg-black text-white border-2 border-black font-black px-8 uppercase text-[10px] rounded-none">Nova Importação</Button>
             )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 max-w-6xl mx-auto w-full">
          {step === 'upload' ? (
            <Tabs defaultValue="text" className="space-y-8 animate-in fade-in duration-500">
               <div className="flex flex-col lg:flex-row justify-between gap-8 items-start">
                  <div className="space-y-4 max-w-2xl">
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Unidade de Migração</h2>
                    <p className="text-black/60 text-sm font-black uppercase leading-relaxed">
                      Carregue seu dump de banco ou cole o texto do CSV. O sistema detectará automaticamente o formato, mapeará as colunas de assessoria e corrigirá datas sujas.
                    </p>
                    <p className="text-[10px] font-bold uppercase text-primary">Use nomes de coluna padrão. Protocolo CNJ com pelo menos 8 caracteres.</p>
                  </div>
                  <Button onClick={handleDownloadTemplate} variant="outline" className="border-2 border-black rounded-none h-12 font-black uppercase text-[10px] tracking-widest shadow-[4px_4px_0px_#000] hover:shadow-none transition-all">
                    <Download size={16} className="mr-2" /> Baixar Modelo CSV
                  </Button>
               </div>

               <TabsList className="grid w-full grid-cols-2 bg-gray-200 rounded-none p-1 border-2 border-black shadow-[4px_4px_0px_#000]">
                  <TabsTrigger value="text" className="rounded-none font-black uppercase text-xs data-[state=active]:bg-black data-[state=active]:text-white">Texto de Gabinete / Dump</TabsTrigger>
                  <TabsTrigger value="csv" className="rounded-none font-black uppercase text-xs data-[state=active]:bg-black data-[state=active]:text-white">Planilha CSV</TabsTrigger>
               </TabsList>

               <TabsContent value="text" className="space-y-4">
                  <Textarea 
                    placeholder="COLE O CONTEÚDO AQUI (DUMP OU CSV)..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="min-h-[350px] border-2 border-black font-black uppercase text-[11px] rounded-none resize-none leading-relaxed bg-white shadow-inner"
                    disabled={parsing}
                  />
                  <Button 
                    onClick={handleTextImport} 
                    disabled={parsing || !textInput.trim()}
                    className="w-full h-14 bg-black text-white font-black uppercase text-xs rounded-none border-2 border-black hover:bg-white hover:text-black transition-all shadow-[6px_6px_0px_#22c55e]"
                  >
                    {parsing ? <><Zap className="animate-spin mr-2" /> Analisando Estruturas...</> : <><Database size={16} className="mr-2" /> Processar Texto de Gabinete</>}
                  </Button>
               </TabsContent>

               <TabsContent value="csv">
                  <label className={cn(
                    "group border-4 border-dashed border-black/10 rounded-none p-24 flex flex-col items-center justify-center transition-all bg-white hover:bg-black hover:border-white cursor-pointer relative overflow-hidden shadow-xl",
                    parsing && "pointer-events-none"
                  )}>
                    {parsing ? (
                      <div className="space-y-6 w-full max-w-md text-center">
                        <p className="font-black text-black group-hover:text-white uppercase text-sm animate-pulse">Lendo Fluxo Neural...</p>
                        <Progress value={progress} className="h-3 bg-gray-100 border-2 border-black [&>div]:bg-black group-hover:border-white group-hover:[&>div]:bg-white" />
                        <p className="text-[10px] font-black uppercase text-black/40 group-hover:text-white/40">{progress}% PROCESSADO</p>
                      </div>
                    ) : (
                      <>
                        <div className="p-8 bg-[#f3f2f2] rounded-none mb-6 group-hover:bg-white transition-all border-2 border-black shadow-[6px_6px_0px_#000]">
                          <Upload className="text-black w-16 h-16" />
                        </div>
                        <h3 className="text-black group-hover:text-white font-black text-xl mb-2 uppercase">Selecionar CSV</h3>
                        <p className="text-xs text-black/40 group-hover:text-white/40 font-black uppercase tracking-widest text-center">CORREÇÃO DE ENCODING E DATAS ATIVA</p>
                      </>
                    )}
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  </label>
               </TabsContent>
            </Tabs>
          ) : step === 'preview' ? (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <StatItem label="Total Linhas" value={stats.total} icon={<Database size={14}/>} />
                  <StatItem label="Processáveis" value={stats.valid} color="text-green-600" icon={<CheckCircle2 size={14}/>} />
                  <StatItem label="Ignorados" value={stats.skipped} color="text-red-600" icon={<AlertCircle size={14}/>} />
                  <StatItem label="Tribunais" value={stats.tribunals} />
               </div>

               <div className="bg-white border-2 border-black rounded-none shadow-[8px_8px_0px_#000] overflow-hidden">
                  <div className="bg-black text-white p-4 flex items-center justify-between">
                     <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Eye size={16} /> Preview de Higiene (Exibindo {preview.length} válidos)</h3>
                     <Badge variant="outline" className="text-white border-white font-black text-[9px] uppercase">Isolamento por Operador Ativo</Badge>
                  </div>
                  <div className="max-h-[500px] overflow-auto bg-[#fafafa]">
                    <Table>
                      <TableHeader className="bg-[#f8f9fb] border-b-2 border-black sticky top-0 z-20">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-black uppercase text-[10px] text-black">Cliente / Protocolo</TableHead>
                          <TableHead className="font-black uppercase text-[10px] text-black">Tribunal</TableHead>
                          <TableHead className="font-black uppercase text-[10px] text-black">Status / Prazo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.slice(0, 100).map((c, i) => (
                          <TableRow key={i} className="hover:bg-black group transition-colors cursor-default">
                            <TableCell>
                               <div className="flex flex-col">
                                  <span className="font-black text-xs uppercase group-hover:text-white transition-colors">{c.cliente}</span>
                                  <span className="text-[9px] font-mono text-black/40 group-hover:text-white/40">{c.protocolo}</span>
                               </div>
                            </TableCell>
                            <TableCell>
                               <Badge variant="outline" className="border-black border-2 font-black text-[8px] uppercase group-hover:bg-white group-hover:text-black transition-all">{c.tribunal}</Badge>
                            </TableCell>
                            <TableCell>
                               <div className="flex flex-col">
                                  <span className={cn("text-[9px] font-black uppercase", c.risco === 'Crítico' ? "text-red-600 group-hover:text-red-400" : "group-hover:text-white")}>{c.status}</span>
                                  <span className="text-[8px] font-bold text-black/40 group-hover:text-white/40">{c.proximoPrazo || 'S/ Prazo'}</span>
                               </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
               </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto py-10 animate-in zoom-in-95 duration-500">
               <Card className="border-2 border-black rounded-none shadow-[12px_12px_0px_#000]">
                  <CardHeader className="bg-black text-white py-6">
                    <CardTitle className="text-center font-black uppercase tracking-widest flex items-center justify-center gap-3">
                       <CheckCircle2 className="text-primary" /> Auditoria de Sincronia
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-10 space-y-10">
                     <div className="grid grid-cols-2 gap-8 text-center">
                        <div className="space-y-2">
                           <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Processos Importados</p>
                           <p className="text-5xl font-black text-emerald-600 tabular-nums">{importResults?.imported || 0}</p>
                        </div>
                        <div className="space-y-2">
                           <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Registros Ignorados</p>
                           <p className="text-5xl font-black text-red-600 tabular-nums">{importResults?.skipped || 0}</p>
                        </div>
                     </div>

                     {importResults?.skipReasons?.length > 0 && (
                        <div className="bg-[#f8f9fb] border-2 border-black p-6 space-y-4">
                           <h4 className="text-[9px] font-black uppercase tracking-[0.2em] border-b border-black/10 pb-2">Motivos de Descarte</h4>
                           <div className="grid gap-2">
                              {importResults.skipReasons.map((r: any) => (
                                <div key={r.reason} className="flex justify-between items-center text-[10px] font-black uppercase">
                                   <span>{r.reason.replace('_', ' ')}</span>
                                   <span className="text-red-600">{r.count} ocorrências</span>
                                </div>
                              ))}
                           </div>
                        </div>
                     )}

                     <div className="bg-emerald-50 border-2 border-emerald-200 p-6 flex items-start gap-4">
                        <RefreshCcw className="text-emerald-600 shrink-0 mt-1" size={18} />
                        <div>
                           <p className="text-[10px] font-black uppercase text-emerald-800 tracking-tight">Status do Repositório</p>
                           <p className="text-xs font-bold text-emerald-700/80 uppercase leading-relaxed mt-1">
                             A base de dados foi atualizada com sucesso. Protocolos duplicados foram mesclados preservando a integridade do histórico mais recente.
                           </p>
                        </div>
                     </div>

                     <Button onClick={resetImport} className="w-full h-14 bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[11px] tracking-widest rounded-none shadow-[6px_6px_0px_#00D1FF] transition-all">
                        Nova Operação de Ingestão <ArrowRight size={16} className="ml-2" />
                     </Button>
                  </CardContent>
               </Card>
            </div>
          )}
        </div>

        <footer className="h-10 border-t border-[#dddbda] bg-white flex items-center justify-center gap-6 text-[10px] text-black/60 font-black uppercase tracking-[0.2em] shrink-0">
          <div className="flex items-center gap-2">
            <Copyright size={10} /> 2026 W1 Capital.
          </div>
          <span className="uppercase">Relatório Consolidado • FUNDADOR DAVI ALVES FIGUEREDO</span>
        </footer>
      </main>
    </div>
  );
}

function StatItem({ label, value, color = "text-black", icon }: { label: string, value: string | number, color?: string, icon?: React.ReactNode }) {
  return (
    <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000]">
       <div className="flex items-center justify-between mb-1">
          <p className="text-[9px] font-black text-black/40 uppercase tracking-widest">{label}</p>
          {icon}
       </div>
       <p className={cn("text-2xl font-black uppercase", color)}>{value}</p>
    </div>
  );
}
