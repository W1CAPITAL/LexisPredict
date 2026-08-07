"use client";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  Repeat, 
  Loader2, 
  CheckCircle2, 
  Shield, 
  Printer,
  Edit3,
  User,
  FileText,
  MapPin,
  Scale,
  Building2,
  Calendar,
  FileSignature,
  FileStack,
  Gavel
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function SubstabelecimentoSimplesPage() {
  const [loading, setLoading] = useState(false);
  const [banca, setBanca] = useState<any[]>([]);
  const [template, setTemplate] = useState<'padrao' | 'cpc272'>('padrao');
  
  // Advogado Cedente
  const [advLeavingId, setAdvLeavingId] = useState('');
  const [ufLeaving, setUfLeaving] = useState('SP');
  const [oabNumLeaving, setOabNumLeaving] = useState('');
  const [nameLeaving, setNameLeaving] = useState('');
  
  // Advogado Substabelecido
  const [advEnteringId, setAdvEnteringId] = useState('');
  const [ufEntering, setUfEntering] = useState('SP');
  const [oabNumEntering, setOabNumEntering] = useState('');
  const [nameEntering, setNameEntering] = useState('');

  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [parteNome, setParteNome] = useState('');
  const [tipoAcao, setTipoAcao] = useState('AÇÃO REVISIONAL DE CONTRATO BANCÁRIO');
  const [cidadeData, setCidadeData] = useState(`São Paulo, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`);

  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      const data = await listAdvogadosBanca();
      setBanca(data);
      if (data.length > 0) {
        const first = data[0];
        setAdvLeavingId(first.id);
        setNameLeaving(first.nome);
        const fUF = Object.keys(first.oabs || {})[0] || 'SP';
        setUfLeaving(fUF);
        setOabNumLeaving(first.oabs?.[fUF] || '');

        const second = data[1] || data[0];
        setAdvEnteringId(second.id);
        setNameEntering(second.nome);
        const sUF = Object.keys(second.oabs || {})[0] || 'SP';
        setUfEntering(sUF);
        setOabNumEntering(second.oabs?.[sUF] || '');
      }
    }
    load();
  }, []);

  const handleAdvLeavingChange = (id: string) => {
    setAdvLeavingId(id);
    const adv = banca.find(a => a.id === id);
    if (adv) {
      setNameLeaving(adv.nome);
      const uf = Object.keys(adv.oabs || {})[0] || ufLeaving;
      setUfLeaving(uf);
      setOabNumLeaving(adv.oabs?.[uf] || '');
    }
  };

  const handleAdvEnteringChange = (id: string) => {
    setAdvEnteringId(id);
    const adv = banca.find(a => a.id === id);
    if (adv) {
      setNameEntering(adv.nome);
      const uf = Object.keys(adv.oabs || {})[0] || ufEntering;
      setUfEntering(uf);
      setOabNumEntering(adv.oabs?.[uf] || '');
    }
  };

  const handleUfLeavingChange = (uf: string) => {
    setUfLeaving(uf);
    const adv = banca.find(a => a.id === advLeavingId);
    if (adv && adv.oabs?.[uf]) {
      setOabNumLeaving(adv.oabs[uf]);
    }
  };

  const handleUfEnteringChange = (uf: string) => {
    setUfEntering(uf);
    const adv = banca.find(a => a.id === advEnteringId);
    if (adv && adv.oabs?.[uf]) {
      setOabNumEntering(adv.oabs[uf]);
    }
  };

  const handleSeal = async () => {
    if (!nameLeaving || !nameEntering || !numeroProcesso || !parteNome || !oabNumLeaving || !oabNumEntering) {
      toast({ title: "Dados Incompletos", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        template,
        substabelecente: {
          nome: nameLeaving,
          oabCompleta: `OAB/${ufLeaving} sob o n.º ${oabNumLeaving}`,
          oabCurta: `OAB/${ufLeaving} Nº ${oabNumLeaving}`
        },
        substabelecido: {
          nome: nameEntering,
          oabCompleta: `OAB/${ufEntering} sob o n.º ${oabNumEntering}`,
          oabCurta: `OAB/${ufEntering} Nº ${oabNumEntering}`
        },
        numeroProcesso,
        parteNome: parteNome.toUpperCase(),
        tipoAcao,
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
          <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[10px]">Versão Authority v1.5</Badge>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-10 max-w-5xl mx-auto w-full pb-32">
          
          <Tabs value={template} onValueChange={(v: any) => setTemplate(v)} className="mb-10 w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-200 p-1 border-2 border-black rounded-none shadow-[6px_6px_0px_#000]">
              <TabsTrigger value="padrao" className="rounded-none font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white h-10">Modelo Padrão (Simples)</TabsTrigger>
              <TabsTrigger value="cpc272" className="rounded-none font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white h-10">Modelo CPC Art. 272 (Exclusão)</TabsTrigger>
            </TabsList>
          </Tabs>

          <Card className="bg-white border-2 border-black rounded-none shadow-[10px_10px_0px_#000]">
            <CardHeader className="bg-black text-white py-4">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3">
                <Edit3 size={16} /> Configuração de Gabinete
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-black/5 pb-2">
                  <Badge className="bg-black text-white rounded-none text-[8px] font-black uppercase">CEDENTE</Badge>
                  <Label className="uppercase text-[10px] font-black text-black/40">Advogado Substabelecente</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-[9px] font-black uppercase">Nome / Banca</Label>
                    <Select value={advLeavingId} onValueChange={handleAdvLeavingChange}>
                      <SelectTrigger className="border-2 border-black h-12 font-black uppercase text-xs rounded-none bg-[#f8f9fb]">
                        <SelectValue placeholder="NOME DO ADVOGADO" />
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
                      <SelectTrigger className="border-2 border-black h-12 font-black uppercase text-xs rounded-none bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-black rounded-none max-h-60 overflow-auto">
                        {UFS.map(uf => <SelectItem key={uf} value={uf} className="font-black uppercase text-[10px]">{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Número OAB</Label>
                    <Input value={oabNumLeaving} onChange={e => setOabNumLeaving(e.target.value)} className="border-2 border-black h-12 font-mono text-sm rounded-none bg-white" />
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t-2 border-black/5">
                <div className="flex items-center gap-2 border-b border-black/5 pb-2">
                  <Badge className="bg-primary text-black rounded-none text-[8px] font-black uppercase">SUBSTABELECIDO</Badge>
                  <Label className="uppercase text-[10px] font-black text-black/40">Advogado Substabelecido</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-[9px] font-black uppercase">Nome / Banca</Label>
                    <Select value={advEnteringId} onValueChange={handleAdvEnteringChange}>
                      <SelectTrigger className="border-2 border-black h-12 font-black uppercase text-xs rounded-none bg-[#f8f9fb]">
                        <SelectValue placeholder="NOME DO ADVOGADO" />
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
                      <SelectTrigger className="border-2 border-black h-12 font-black uppercase text-xs rounded-none bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-black rounded-none max-h-60 overflow-auto">
                        {UFS.map(uf => <SelectItem key={uf} value={uf} className="font-black uppercase text-[10px]">{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Número OAB</Label>
                    <Input value={oabNumEntering} onChange={e => setOabNumEntering(e.target.value)} className="border-2 border-black h-12 font-mono text-sm rounded-none bg-white" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t-2 border-black/5">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-black/40 flex items-center gap-2"><Building2 size={12}/> Processo (CNJ)</Label>
                  <Input placeholder="0000000-00.0000.0.00.0000" value={numeroProcesso} onChange={(e) => setNumeroProcesso(e.target.value)} className="border-2 border-black h-12 font-mono text-sm rounded-none bg-[#f8f9fb]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-black/40 flex items-center gap-2"><User size={12}/> Parte Representada</Label>
                  <Input placeholder="NOME DO CLIENTE" value={parteNome} onChange={(e) => setParteNome(e.target.value.toUpperCase())} className="border-2 border-black h-12 font-black uppercase text-xs rounded-none bg-[#f8f9fb]" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t-2 border-black/5">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-black/40 flex items-center gap-2"><Gavel size={12}/> Objeto / Tipo de Ação</Label>
                  <Input value={tipoAcao} onChange={(e) => setTipoAcao(e.target.value.toUpperCase())} className="border-2 border-black h-12 font-bold uppercase text-[10px] rounded-none bg-[#f8f9fb]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-black/40 flex items-center gap-2"><Calendar size={12}/> Local e Data</Label>
                  <Input value={cidadeData} onChange={(e) => setCidadeData(e.target.value)} className="border-2 border-black h-12 font-bold uppercase text-xs rounded-none bg-[#f8f9fb]" />
                </div>
              </div>

              <div className="pt-10 flex flex-col items-center gap-6">
                <Button onClick={handleSeal} disabled={loading} className="w-full h-16 bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-sm rounded-none border-2 border-black shadow-[8px_8px_0px_#00D1FF] hover:shadow-none transition-all">
                  {loading ? <Loader2 className="animate-spin mr-3" size={24} /> : <Printer className="mr-3" size={24} />}
                  Selar Substabelecimento {template === 'cpc272' ? 'Art. 272 CPC' : 'Padrão'}
                </Button>
                <div className="flex items-center gap-2 text-[9px] font-black uppercase text-black/40">
                  <Shield size={12} /> Autenticidade Forense Garantida
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-2 border-black border-dashed rounded-none overflow-hidden mt-10">
            <CardHeader className="bg-[#f8f9fb] border-b-2 border-black border-dashed py-2">
              <p className="text-[8px] font-black uppercase text-center tracking-widest flex items-center justify-center gap-2">
                <FileText size={10} /> Preview Dinâmico v1.2
              </p>
            </CardHeader>
            <CardContent className="p-10 text-black/80 font-serif text-[11pt] leading-relaxed text-justify space-y-4 bg-white">
              {template === 'padrao' ? (
                <>
                  <p className="text-center font-bold underline mb-8 uppercase">SUBSTABELECIMENTO SEM RESERVA DE PODERES</p>
                  <p>
                    Pelo presente instrumento, <span className="font-bold">Dr. {nameLeaving || '[Cedente]'}</span>, advogado regularmente inscrito na <span className="font-bold">OAB/{ufLeaving} sob o n.º {oabNumLeaving || '________'}</span>, substabelece, <span className="font-bold">SEM RESERVA DE PODERES</span>, ao <span className="font-bold">Dr. {nameEntering || '[Substabelecido]'}</span>, advogado inscrito na <span className="font-bold">OAB/{ufEntering} sob o n.º {oabNumEntering || '________'}</span>, todos os poderes que lhe foram conferidos nos autos do processo nº <span className="font-bold">{numeroProcesso || '____________________'}</span>, para que represente os interesses da parte <span className="font-bold">{parteNome || '____________________'}</span>.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-center font-bold uppercase underline">SUBSTABELECIMENTO</p>
                  <p className="text-center font-bold mb-8">(sem reserva de poderes)</p>
                  <p>
                    O <span className="font-bold">DR(A). {nameLeaving || '[CEDENTE]'}</span>, brasileiro(a), advogado(a), inscrito(a) na <span className="font-bold">OAB/{ufLeaving} sob o n.º {oabNumLeaving || '________'}</span>, <span className="font-bold">SUBSTABELECE SEM RESERVA DE PODERES</span> na pessoa do <span className="font-bold">DR(A). {nameEntering || '[SUBSTABELECIDO]'}</span>, inscrito(a) na <span className="font-bold">OAB/{ufEntering} sob o n.º {oabNumEntering || '________'}</span>, os poderes conferidos por <span className="font-bold">{parteNome || '[PARTE]'}</span>, <span className="font-bold">PARA A PROMOÇÃO DE {tipoAcao}</span>, processo de n.º <span className="font-bold">{numeroProcesso || '________'}</span>...
                  </p>
                </>
              )}
              <p className="text-center mt-12">{cidadeData}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}