/** Sources and workflows for the existing AI Lab; status is architectural, not live availability. */
export type CreativeToolStatus =
  | 'gateway' | 'existing-editor' | 'external-private' | 'installable-private'
  | 'unverified' | 'manual-external';

export type CreativeTool = {
  id:string;
  name:string;
  purpose:string;
  status:CreativeToolStatus;
  url:string;
  requirements:string[];
  description:string;
  warning?:string;
};

export const CREATIVE_LAB_TOOLS:readonly CreativeTool[]=[
  {id:'open-higgsfield',name:'Open-Higgsfield',purpose:'Gerador de cenas',
   status:'gateway',url:'/ai-lab/higgsfield',
   requirements:['Instância privada','Cloudflare Access','Créditos e provedor configurado'],
   description:'Interface e integração existentes. A disponibilidade real é verificada dentro do gerador.'},
  {id:'genjutsu-sirio',name:'Genjustsu · Sirio',purpose:'Transferência de movimento',
   status:'external-private',url:'https://github.com/sirioberati/Genjustsu-Open-Source-Workflow',
   requirements:['Worker privado','Revisão das máscaras e clipe completo'],
   description:'Exportação autorizada de MP4 para edição no W1 Reel Studio.'},
  {id:'genjutsu-abdullayev',name:'Open Genjutsu · Abdullayev',purpose:'Movimento por provedores',
   status:'external-private',url:'https://github.com/abdullayevziyodulla/open-genjutsu',
   requirements:['Worker privado','Provedor compatível','Revisão integral'],
   description:'Fluxo de geração ou transferência com conferência do resultado inteiro.'},
  {id:'genjutsu-anil',name:'Open Genjutsu · Anil',purpose:'Referência de movimento',
   status:'external-private',url:'https://github.com/Anil-matcha/open-genjutsu',
   requirements:['Worker privado','MuAPI/provedor compatível','Revisão integral'],
   description:'Exporta MP4 de movimento aprovado para montagem final.'},
  {id:'voicestudio',name:'VoiceStudio',purpose:'Narração natural',
   status:'external-private',url:'https://github.com/debpalash/VoiceStudio',
   requirements:['Instância localhost separada','Voz brasileira aprovada'],
   description:'O editor W1 já suporta importação WAV; serviço AGPL permanece separado.'},
  {id:'reel-studio',name:'W1 Reel Studio',purpose:'Editor autoral de Reels',
   status:'existing-editor',url:'https://github.com/W1CAPITAL/SITE/tree/main/scripts/reel-studio',
   requirements:['Node.js 22','FFmpeg','Clipes licenciados e narração revisada'],
   description:'Editor W1 para MP4 vertical com legendas, mixagem e gravações reais.'},
  {id:'hypit',name:'Hypit',purpose:'Composição de vídeo e legendas',
   status:'installable-private',url:'https://github.com/hypit-ai/hypit',
   requirements:['Node.js >=22.15','pnpm','Worker privado de uma organização'],
   description:'Instalador privado versionado no repositório SITE. Não executa no frontend.',
   warning:'Licença Apache 2.0 modificada: redistribuição comercial e SaaS multiusuário requerem licença comercial.'},
  {id:'youtube-shorts',name:'AI YouTube Shorts Generator',purpose:'Cortes de vídeos próprios',
   status:'installable-private',url:'https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator',
   requirements:['Python >=3.10','venv','MuAPI ou FFmpeg/Whisper e provedor LLM'],
   description:'Instalador privado versionado; a operação pode consumir créditos ou exigir processamento local.'},
  {id:'motionsmith-mcp',name:'MotionSmith · MCP informado',purpose:'Integração remota em avaliação',
   status:'unverified',url:'https://motionsmith.miftahul.com/api/mcp',
   requirements:['Autenticidade da origem','Documentação MCP','Autenticação e consentimento'],
   description:'Endereço registrado, mas ainda não conectado, autenticado ou validado.'},
  {id:'motionsmith-unreal',name:'MotionSmith Pro V2',purpose:'Animação 3D',
   status:'manual-external',url:'https://github.com/webportalim/MotionSmith-AI-Pro-Text-to-Motion-for-Sequencer',
   requirements:['Windows 64-bit','Unreal Engine 5.8','NVIDIA CUDA GPU','Plugin via Fab'],
   description:'Ferramenta para Unreal Sequencer, não um pacote web. O repositório contém documentação, não o plugin.'}
];

export const toolById=(id:string)=>CREATIVE_LAB_TOOLS.find(tool=>tool.id===id);
