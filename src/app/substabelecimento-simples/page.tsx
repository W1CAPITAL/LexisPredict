
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
  ArrowRight,
  Printer,
  Edit3,
  User,
  Zap,
  MapPin,
  FileText
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

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function SubstabelecimentoSimplesPage() {
  const [loading, setLoading] = useState(false);
  const [banca, setBanca] = useState<any[]>([]);
  
  // Estados Independentes conforme PROMPT
  const [advLeavingId, setAdvLeavingId] = useState('');
  const [ufLeaving, setUfLeaving] = useState('SP');
  const [oabNumLeaving, setOabNumLeaving] = useState('');
  
  const [advEnteringId, setAdvEnteringId] = useState('');
  const [ufEntering, setUfEntering] = useState('SP');
  const [oabNumEntering, setOabNumEntering] = useState('');

  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [parteNome, setParteNome] = useState('');
  const [cidadeData, setCidadeData] = useState(`São Paulo, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`);

  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      const data = await listAdvogadosBanca();
      setBanca(data);
      if (data.length > 0) {
        // Cedente Default
        const first = data[0];
        setAdvLeavingId(first.id);
        const firstUF = Object.keys(first.oabs || {})[0] || 'SP';
        setUfLeaving(firstUF);
        setOabNumLeaving(first.oabs?.[firstUF] || '');

        // Substabelecido Default (Tenta achar Diego ou pega o segundo)
        const diego = data.find(a => a.nome.toUpperCase().includes('DIEGO'));
        const second = diego || (data[1] || data[0]);
        setAdvEnteringId(second.id);
        const secUF = Object.keys(second.oabs || {})[0] || 'SP';
        setUfEntering(secUF);
        setOabNumEntering(second.oabs?.[secUF] || '');
      }
    }
    load();
  }, []);

  // Sincronia Automática de OAB ao trocar Advogado ou UF (Cedente)
  const handleAdvLeavingChange = (id: string) => {
    setAdvLeavingId(id);
    const adv = banca.find(a => a.id === id);
    if (adv) {
      const uf = Object.keys(adv.oabs || {})[0] || ufLeaving;
      setUfLeaving(uf);
      setOabNumLeaving(adv.oabs?.[uf] || '');
    }
  };

  const handleUfLeavingChange = (uf: string) => {
    setUfLeaving(uf);
    const adv = banca.find(a => a.id === advLeavingId);
    if (adv && adv.oabs?.[uf]) {
      setOabNumLeaving(adv.oabs[uf]);
    }
  };

  // Sincronia Automática de OAB ao trocar Advogado ou UF (Substabelecido)
  const handleAdvEnteringChange = (id: string) => {
    setAdvEnteringId(id);
    const adv = banca.find(a => a.id === id);
    if (adv) {
      const uf = Object.keys(adv.oabs || {})[0] || ufEntering;
      setUfEntering(uf);
      setOabNumEntering(adv.oabs?.[uf] || '');
    }
  };

  const handleUfEnteringChange = (uf: string) => {
    setUfEntering(uf);
    const adv = banca.find(a => a.id === advEnteringId);
    if (adv && adv.oabs?.[uf]) {
      setOabNumEntering(adv.oabs[uf]);
    }
  };

  const advLeaving = banca.find(a => a.id === advLeavingId);
  const advEntering = banca.find(a => a.id === advEnteringId);

  const handleSeal = async () => {
    if (!advLeaving || !advEntering || !numeroProcesso || !parteNome || !oabNumLeaving || !oabNumEntering) {
      toast({ title: "Dados Incompletos", description: "Verifique nomes, OABs e dados do processo.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        substabelecente: {
          nome: advLeaving.nome,
          oabCompleta: `OAB/${ufLeaving} sob o n.º ${oabNumLeaving}`,
          oabCurta: `OAB/${ufLeaving} Nº ${oabNumLeaving}`
        },
        substabelecido: {
          nome: advEntering.nome,
          oabCompleta: `OAB/${ufEntering} sob o n.º ${oabNumEntering}`,
          oabCurta: `OAB/${ufEntering} Nº ${oabNumEntering}`
        },
        numeroProcesso,
        parteNome: parteNome.toUpperCase(),
        cidadeData
      };

      const res = await generateSubstabelecimentoSimplesPDFAction(payload);
      if (res.success && res.base64) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${res.base64}`;
        link.download = `Subst_Simples_${parteNome.replace(/\s/g, '_')}.pdf`;
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
          <Card className="bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000]">
            <CardHeader className="bg-black text-white py-4">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3">
                <Edit3 size={16} /> Configuração do Instrumento
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              
              {/* ADVOGADO SUBSTABELECENTE (CEDENTE) */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-black/5 pb-2">
                  <Badge className="bg-black text-white rounded-none text-[8px] font-black uppercase">CEDENTE</Badge>
                  <Label className="uppercase text-[10px] font-black text-black/40">Advogado Substabelecente</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-[9px] font-black uppercase">Nome do Advogado</Label>
                    <Select value={advLeavingId} onValueChange={handleAdvLeavingChange}>
                      <SelectTrigger className="border-2 border-black h-12 font-black uppercase text-xs rounded-none bg-[#f8f9fb]">
                        <SelectValue placeholder="SELECIONE..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-black rounded-none">
                        {banca.map((adv) => (
                          <SelectItem key={adv.id} value={adv.id} className="font-black uppercase text-[10px]">{adv.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Estado OAB</Label>
                    <Select value={ufLeaving} onValueChange={handleUfLeavingChange}>
                      <SelectTrigger className="border-2 border-black h-12 font-black uppercase text-xs rounded-none bg-[#f8f9fb]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-black rounded-none">
                        {UFS.map(uf => <SelectItem key={uf} value={uf} className="font-black uppercase text-[10px]">{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Número OAB</Label>
                    <Input value={oabNumLeaving} onChange={e => setOabNumLeaving(e.target.value)} className="border-2 border-black h-12 font-mono text-sm rounded-none bg-white" placeholder="000.000" />
                  </div>
                </div>
              </div>

              {/* ADVOGADO SUBSTABELECIDO (QUEM RECEBE) */}
              <div className="space-y-6 pt-6 border-t-2 border-black/5">
                <div className="flex items-center gap-2 border-b border-black/5 pb-2">
                  <Badge className="bg-primary text-black rounded-none text-[8px] font-black uppercase">SUBSTABELECIDO</Badge>
                  <Label className="uppercase text-[10px] font-black text-black/40">Advogado que Recebe os Poderes</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-[9px] font-black uppercase">Nome do Advogado</Label>
                    <Select value={advEnteringId} onValueChange={handleAdvEnteringChange}>
                      <SelectTrigger className="border-2 border-black h-12 font-black uppercase text-xs rounded-none bg-[#f8f9fb]">
                        <SelectValue placeholder="SELECIONE..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-black rounded-none">
                        {banca.map((adv) => (
                          <SelectItem key={adv.id} value={adv.id} className="font-black uppercase text-[10px]">{adv.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Estado OAB</Label>
                    <Select value={ufEntering} onValueChange={handleUfEnteringChange}>
                      <SelectTrigger className="border-2 border-black h-12 font-black uppercase text-xs rounded-none bg-[#f8f9fb]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-black rounded-none">
                        {UFS.map(uf => <SelectItem key={uf} value={uf} className="font-black uppercase text-[10px]">{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Número OAB</Label>
                    <Input value={oabNumEntering} onChange={e => setOabNumEntering(e.target.value)} className="border-2 border-black h-12 font-mono text-sm rounded-none bg-white" placeholder="000.000" />
                  </div>
                </div>
              </div>

              {/* DADOS DO PROCESSO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t-2 border-black/5">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-black/40">Número do Processo (CNJ)</Label>
                  <Input placeholder="0000000-00.0000.0.00.0000" value={numeroProcesso} onChange={(e) => setNumeroProcesso(e.target.value)} className="border-2 border-black h-12 font-mono text-sm rounded-none bg-[#f8f9fb]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-black/40">Parte Representada (Cliente)</Label>
                  <Input placeholder="NOME COMPLETO DO CLIENTE" value={parteNome} onChange={(e) => setParteNome(e.target.value.toUpperCase())} className="border-2 border-black h-12 font-black uppercase text-xs rounded-none bg-[#f8f9fb]" />
                </div>
              </div>

              <div className="space-y-2 pt-6 border-t-2 border-black/5">
                <Label className="text-[9px] font-black uppercase text-black/40">Local e Data por Extenso</Label>
                <Input value={cidadeData} onChange={(e) => setCidadeData(e.target.value)} className="border-2 border-black h-12 font-bold uppercase text-xs rounded-none bg-[#f8f9fb]" />
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

          {/* PREVIEW DINÂMICO */}
          <Card className="bg-[#f8f9fb] border-2 border-black border-dashed rounded-none overflow-hidden mt-10">
            <CardHeader className="bg-white border-b-2 border-black border-dashed py-2">
              <p className="text-[8px] font-black uppercase text-center tracking-widest flex items-center justify-center gap-2">
                <FileText size={10} /> Preview Forense v1.0
              </p>
            </CardHeader>
            <CardContent className="p-10 text-black/80 font-serif text-[11pt] leading-relaxed text-justify space-y-4">
              <p className="text-center font-bold underline mb-8">SUBSTABELECIMENTO SEM RESERVA DE PODERES</p>
              <p>
                Pelo presente instrumento, <span className="font-bold">Dr. {advLeaving?.nome || '[Cedente]'}</span>, advogado regularmente inscrito na <span className="font-bold">OAB/{ufLeaving} sob o n.º {oabNumLeaving || '________'}</span>, substabelece, <span className="font-bold">SEM RESERVA DE PODERES</span>, ao <span className="font-bold">Dr. {advEntering?.nome || '[Cessionário]'}</span>, advogado inscrito na <span className="font-bold">OAB/{ufEntering} sob o n.º {oabNumEntering || '________'}</span>, todos os poderes que lhe foram conferidos nos autos do processo nº <span className="font-bold">{numeroProcesso || '____________________'}</span>, para que represente os interesses da parte <span className="font-bold">{parteNome || '____________________'}</span>.
              </p>
              <p className="text-center mt-12">{cidadeData}</p>
            </CardContent>
          </Card>
        </div>

        <footer className="h-10 border-t border-[#dddbda] bg-white flex items-center justify-center gap-6 text-[10px] text-black/60 font-black uppercase tracking-[0.2em] shrink-0">
          <div className="flex items-center gap-2"><Zap size={10} className="text-primary" /> 2026 W1 Capital.</div>
          <span>Authority Series • Draft Dynamic v1.0</span>
        </footer>
      </main>
    </div>
  );
}
