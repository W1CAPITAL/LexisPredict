/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Repeat, 
  Loader2, 
  CheckCircle2, 
  Shield, 
  Gavel, 
  FileText, 
  ArrowRight,
  Printer,
  Edit3,
  Building2,
  User,
  Zap,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { listAdvogadosBanca } from '@/lib/server-db';
import { generateSubstabelecimentoSimplesPDFAction } from '@/app/actions/document-actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

export default function SubstabelecimentoSimplesPage() {
  const [loading, setLoading] = useState(false);
  const [banca, setBanca] = useState<any[]>([]);
  const [advLeavingId, setAdvLeavingId] = useState('');
  const [advEnteringId, setAdvEnteringId] = useState('');
  const [selectedState, setSelectedState] = useState('SP');
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [parteNome, setParteNome] = useState('');
  const [cidadeData, setCidadeData] = useState(`São Paulo, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`);

  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      const data = await listAdvogadosBanca();
      setBanca(data);
      if (data.length > 0) {
        setAdvLeavingId(data[0].id);
        // Tenta achar o Diego se existir na banca
        const diego = data.find(a => a.nome.toUpperCase().includes('DIEGO'));
        if (diego) setAdvEnteringId(diego.id);
        else setAdvEnteringId(data[0].id);
        
        // Define estado inicial baseado no primeiro advogado
        const firstUF = Object.keys(data[0].oabs || {})[0] || 'SP';
        setSelectedState(firstUF);
      }
    }
    load();
  }, []);

  const advLeaving = banca.find(a => a.id === advLeavingId);
  const advEntering = banca.find(a => a.id === advEnteringId);

  const oabLeaving = advLeaving?.oabs?.[selectedState] || "___.___";
  const oabEntering = advEntering?.oabs?.[selectedState] || "___.___";

  const handleSeal = async () => {
    if (!advLeaving || !advEntering || !numeroProcesso || !parteNome) {
      toast({ title: "Dados Incompletos", description: "Preencha todos os campos para selar o documento.", variant: "destructive" });
      return;
    }

    if (oabLeaving === "___.___" || oabEntering === "___.___") {
      toast({ 
        title: "OAB não localizada", 
        description: `Um dos advogados selecionados não possui OAB cadastrada para o estado ${selectedState}.`, 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        substabelecente: {
          nome: advLeaving.nome,
          oabCompleta: `OAB/${selectedState} sob o n.º ${oabLeaving}`,
          oabCurta: `OAB/${selectedState} Nº ${oabLeaving}`
        },
        substabelecido: {
          nome: advEntering.nome,
          oabCompleta: `OAB/${selectedState} sob o n.º ${oabEntering}`,
          oabCurta: `OAB/${selectedState} Nº ${oabEntering}`
        },
        numeroProcesso,
        parteNome: parteNome.toUpperCase(),
        cidadeData
      };

      const res = await generateSubstabelecimentoSimplesPDFAction(payload);
      if (res.success && res.base64) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${res.base64}`;
        link.download = `Substabelecimento_Simples_${parteNome.replace(/\s/g, '_')}.pdf`;
        link.click();
        toast({ title: "Documento Selado" });
      } else {
        toast({ title: "Erro na Selagem", description: res.error, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f3f2f2] font-sans text-black relative z-10 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 border-b border-[#dddbda] bg-white flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-sm bg-black flex items-center justify-center">
              <Repeat size={20} className="text-white" />
            </div>
            <h1 className="font-black text-xl text-black uppercase tracking-tighter">Subst. Sem Reserva</h1>
          </div>
          <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[10px]">Padrão Executivo</Badge>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-10 max-w-5xl mx-auto w-full pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-10">
            <Card className="bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000]">
              <CardHeader className="bg-black text-white py-4">
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3">
                  <Edit3 size={16} /> Configuração do Instrumento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <Label className="uppercase text-[10px] font-black flex items-center gap-2 text-black/40"><User size={12}/> Advogado Substabelecente</Label>
                    <Select value={advLeavingId} onValueChange={setAdvLeavingId}>
                      <SelectTrigger className="w-full border-2 border-black h-14 font-black uppercase text-xs rounded-none bg-[#f8f9fb]">
                        <SelectValue placeholder="SELECIONE..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-black rounded-none">
                        {banca.map((adv) => (
                          <SelectItem key={adv.id} value={adv.id} className="font-black uppercase text-[10px]">{adv.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4">
                    <Label className="uppercase text-[10px] font-black flex items-center gap-2 text-black/40"><ArrowRight size={12}/> Advogado Substabelecido</Label>
                    <Select value={advEnteringId} onValueChange={setAdvEnteringId}>
                      <SelectTrigger className="w-full border-2 border-black h-14 font-black uppercase text-xs rounded-none bg-[#f8f9fb]">
                        <SelectValue placeholder="SELECIONE..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-black rounded-none">
                        {banca.map((adv) => (
                          <SelectItem key={adv.id} value={adv.id} className="font-black uppercase text-[10px]">{adv.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4">
                    <Label className="uppercase text-[10px] font-black flex items-center gap-2 text-black/40"><MapPin size={12}/> Estado (OAB)</Label>
                    <Select value={selectedState} onValueChange={setSelectedState}>
                      <SelectTrigger className="w-full border-2 border-black h-14 font-black uppercase text-xs rounded-none bg-[#f8f9fb]">
                        <SelectValue placeholder="UF..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-black rounded-none">
                        {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                          <SelectItem key={uf} value={uf} className="font-black uppercase text-[10px]">{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t-2 border-black/5">
                   <div className="space-y-4">
                      <Label className="uppercase text-[10px] font-black text-black/40">Número do Processo (CNJ)</Label>
                      <Input 
                        placeholder="0000000-00.0000.0.00.0000" 
                        value={numeroProcesso} 
                        onChange={(e) => setNumeroProcesso(e.target.value)} 
                        className="border-2 border-black h-14 font-mono text-sm rounded-none bg-[#f8f9fb]"
                      />
                   </div>
                   <div className="space-y-4">
                      <Label className="uppercase text-[10px] font-black text-black/40">Nome da Parte Representada</Label>
                      <Input 
                        placeholder="NOME COMPLETO DO CLIENTE" 
                        value={parteNome} 
                        onChange={(e) => setParteNome(e.target.value.toUpperCase())} 
                        className="border-2 border-black h-14 font-black uppercase text-xs rounded-none bg-[#f8f9fb]"
                      />
                   </div>
                </div>

                <div className="space-y-4 pt-6 border-t-2 border-black/5">
                   <Label className="uppercase text-[10px] font-black text-black/40">Local e Data por Extenso</Label>
                   <Input 
                     value={cidadeData} 
                     onChange={(e) => setCidadeData(e.target.value)} 
                     className="border-2 border-black h-14 font-bold uppercase text-xs rounded-none bg-[#f8f9fb]"
                   />
                </div>

                <div className="pt-10 flex flex-col items-center gap-6">
                   <Button onClick={handleSeal} disabled={loading} className="w-full h-16 bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-sm rounded-none border-2 border-black shadow-[8px_8px_0px_#00D1FF] hover:shadow-none transition-all">
                      {loading ? <Loader2 className="animate-spin mr-3" size={24} /> : <Printer className="mr-3" size={24} />}
                      Selar Substabelecimento "Padrão Bonfim"
                   </Button>
                   <div className="flex items-center gap-2 text-[9px] font-black uppercase text-black/40">
                      <Shield size={12} /> Autenticidade e Fé Pública • Authority System
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#f8f9fb] border-2 border-black border-dashed rounded-none overflow-hidden">
               <CardHeader className="bg-white border-b-2 border-black border-dashed py-2">
                 <p className="text-[8px] font-black uppercase text-center tracking-widest">Preview Forense • UF Selecionada: {selectedState}</p>
               </CardHeader>
               <CardContent className="p-10 text-black/60 font-serif text-[11pt] leading-relaxed italic text-center space-y-4">
                  <p>
                    "Pelo presente instrumento, <span className="font-bold">Dr. {advLeaving?.nome || '[Cedente]'}</span>, advogado regularmente inscrito na <span className={cn("font-bold", oabLeaving === "___.___" && "text-red-600 underline")}>OAB/{selectedState} sob o n.º {oabLeaving}</span>, substabelece, SEM RESERVA DE PODERES, ao <span className="font-bold">Dr. {advEntering?.nome || '[Cessionário]'}</span>, advogado inscrito na <span className={cn("font-bold", oabEntering === "___.___" && "text-red-600 underline")}>OAB/{selectedState} sob o n.º {oabEntering}</span>, todos os poderes que lhe foram conferidos nos autos do processo nº {numeroProcesso || '[Processo]'}, para que represente os interesses da parte {parteNome || '[Parte]'}."
                  </p>
                  { (oabLeaving === "___.___" || oabEntering === "___.___") && (
                    <p className="text-[9px] font-black uppercase text-red-600 not-italic">⚠ Atenção: Verifique o cadastro de OAB dos advogados para o estado {selectedState} em Configurações.</p>
                  )}
               </CardContent>
            </Card>
          </div>
        </div>

        <footer className="h-10 border-t border-[#dddbda] bg-white flex items-center justify-center gap-6 text-[10px] text-black/60 font-black uppercase tracking-[0.2em] shrink-0 hover:bg-black hover:text-white transition-all cursor-default">
          <div className="flex items-center gap-2"><Zap size={10} className="text-primary" /> 2026 W1 Capital.</div>
          <span>Draft Simples • AUTHORITY SERIES</span>
        </footer>
      </main>
    </div>
  );
}
