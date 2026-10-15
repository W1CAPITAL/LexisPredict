/** Preferências visuais por usuário. Nunca alterar cargo/permissão reais. */
import {applyPresetById,AUTHORITY_PRESETS,applyGlobalTheme,saveCustomTheme,getPresetColors,getContrastRatio} from '@/lib/theme';
import {saveUiPrefs,loadUiPrefs} from '@/lib/ui-prefs';
import {saveNavLayout} from '@/lib/nav-layout';
import {applyWallpaperUrl,resetWallpaper} from '@/lib/visual-hardware';

export const EXPERIENCE_VERSION=3;
export const EXPERIENCE_KEY='lexis_user_experience_v3';

export type ExperiencePreferences={
 theme:'minimal-steel'|'paper-legal'|'night-ops'|'graphite'|'esmeralda'|'violeta'|'ocean'|'sheetspredict-dark';
 mode:'light'|'dark'|'system';
 primary:string; textColor:string; mutedTextColor:string;
 font:'Inter'|'Roboto'|'Poppins'|'Georgia'|'Arial';
 wallpaper:string; avatarUrl:string;
 sidebarPosition:'left'|'right'|'top'|'bottom';
 sidebarBehavior:'fixed'|'floating'|'toggle';
 sidebarCompact:boolean;
 cornerRadius:number;
 cardStyle:'solid'|'outlined'|'glass'|'elevated';
 kpiStyle:'normal'|'compact'|'gradient';
 buttonStyle:'rounded'|'pill'|'square';
 glass:boolean;blur:number;density:'compact'|'comfortable'|'wide';
 notifications:'all'|'important'|'silent';
 favoriteTab:string;dashboardPhrase:string;
};
export const EXPERIENCE_DEFAULT:ExperiencePreferences={
 theme:'minimal-steel',mode:'light',primary:'#2563EB',
 textColor:'',mutedTextColor:'',font:'Inter',wallpaper:'',avatarUrl:'',
 sidebarPosition:'left',sidebarBehavior:'fixed',sidebarCompact:false,
 cornerRadius:12,cardStyle:'solid',kpiStyle:'normal',buttonStyle:'rounded',
 glass:false,blur:12,density:'comfortable',notifications:'important',
 favoriteTab:'/',dashboardPhrase:'',
};

export function cleanExperiencePrefs(raw:unknown):ExperiencePreferences{
 const d=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 const select=<T extends string>(key:keyof ExperiencePreferences,allowed:readonly T[],fallback:T):T=>
  allowed.includes(d[key] as T)?d[key] as T:fallback;
 const hex=(key:keyof ExperiencePreferences,fallback:string)=>typeof d[key]==='string'&&/^#[0-9a-fA-F]{6}$/.test(d[key] as string)?d[key] as string:fallback;
 const str=(key:keyof ExperiencePreferences,limit:number)=>typeof d[key]==='string'?(d[key] as string).trim().slice(0,limit):'';
 const number=(key:keyof ExperiencePreferences,min:number,max:number,fallback:number)=>
  typeof d[key]==='number'&&Number.isFinite(d[key])?Math.min(max,Math.max(min,d[key] as number)):fallback;
 const url=(key:keyof ExperiencePreferences)=>{
  const s=str(key,1500);
  // Image CSS cannot accept javascript:, data:, or untrusted CSS expressions.
  if(s&&/^https:\/\//i.test(s)){try{const u=new URL(s);return u.username||u.password?'':u.href}catch{return ''}}
  return '';
 };
 return {
  theme:select('theme',['minimal-steel','paper-legal','night-ops','graphite','esmeralda','violeta','ocean','sheetspredict-dark'],EXPERIENCE_DEFAULT.theme),
  mode:select('mode',['light','dark','system'],EXPERIENCE_DEFAULT.mode),
  primary:hex('primary',EXPERIENCE_DEFAULT.primary),
  textColor:hex('textColor',''),mutedTextColor:hex('mutedTextColor',''),
  font:select('font',['Inter','Roboto','Poppins','Georgia','Arial'],EXPERIENCE_DEFAULT.font),
  wallpaper:url('wallpaper'),avatarUrl:url('avatarUrl'),
  sidebarPosition:select('sidebarPosition',['left','right','top','bottom'],EXPERIENCE_DEFAULT.sidebarPosition),
  sidebarBehavior:select('sidebarBehavior',['fixed','floating','toggle'],EXPERIENCE_DEFAULT.sidebarBehavior),
  sidebarCompact:d.sidebarCompact===true,
  cornerRadius:number('cornerRadius',0,32,12),
  cardStyle:select('cardStyle',['solid','outlined','glass','elevated'],EXPERIENCE_DEFAULT.cardStyle),
  kpiStyle:select('kpiStyle',['normal','compact','gradient'],EXPERIENCE_DEFAULT.kpiStyle),
  buttonStyle:select('buttonStyle',['rounded','pill','square'],EXPERIENCE_DEFAULT.buttonStyle),
  glass:d.glass===true,blur:number('blur',0,28,12),
  density:select('density',['compact','comfortable','wide'],EXPERIENCE_DEFAULT.density),
  notifications:select('notifications',['all','important','silent'],EXPERIENCE_DEFAULT.notifications),
  favoriteTab:select('favoriteTab',['/','/cases','/processos','/tarefas','/whatsapp','/report','/agenda','/dossies','/crm'],EXPERIENCE_DEFAULT.favoriteTab),
  dashboardPhrase:str('dashboardPhrase',150),
 };
}

export function loadExperiencePrefs():ExperiencePreferences{
 if(typeof window==='undefined')return {...EXPERIENCE_DEFAULT};
 try{return cleanExperiencePrefs(JSON.parse(localStorage.getItem(EXPERIENCE_KEY)||'{}'))}
 catch{return {...EXPERIENCE_DEFAULT}}
}
export function applyExperiencePrefs(input:ExperiencePreferences){
 if(typeof window==='undefined')return;
 const p=cleanExperiencePrefs(input),root=document.documentElement;
 localStorage.setItem(EXPERIENCE_KEY,JSON.stringify(p));
 localStorage.setItem('lexis_theme_mode',p.mode);
 const dark=p.mode==='dark'||(p.mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
 root.classList.toggle('dark',dark);
 root.classList.toggle('light',!dark);
 root.style.colorScheme=dark?'dark':'light';
 localStorage.setItem('lexis_dark_mode',String(dark));
 // Preset first; explicit user colors after. Avoid white-on-white.
 applyPresetById(p.theme,dark?'dark':'light');
 const preset=AUTHORITY_PRESETS.find(x=>x.id===p.theme);
 if(preset){
  const base=getPresetColors(preset,dark?'dark':'light');
  const safe={...base,primary:p.primary,
   foreground:p.textColor||base.foreground,
   fontMuted:p.mutedTextColor||base.fontMuted};
  // Do not persist over preset identity; applyGlobalTheme retains HSL tokens.
  applyGlobalTheme(safe,p.cornerRadius,undefined,undefined,undefined,dark?'dark':'light');
  localStorage.setItem('lexisPredict_theme_preset',p.theme);
 }
 root.dataset.lexisExperience='1';
 root.dataset.lexisSidebarPosition=p.sidebarPosition;
 root.dataset.lexisSidebarBehavior=p.sidebarBehavior;
 root.dataset.lexisCardStyle=p.cardStyle;
 root.dataset.lexisKpiStyle=p.kpiStyle;
 root.dataset.lexisButtonStyle=p.buttonStyle;
 root.dataset.lexisNotifications=p.notifications;
 root.style.setProperty('--radius',p.cornerRadius+'px');
 root.style.setProperty('--experience-font',p.font==='Georgia'?'Georgia,serif':p.font+',sans-serif');
 root.style.setProperty('--experience-blur',p.blur+'px');
 saveNavLayout(p.sidebarPosition==='top'||p.sidebarPosition==='bottom'?'dock':'vertical');
 localStorage.setItem('lexis-sidebar-compact-v2',p.sidebarCompact?'1':'0');
 saveUiPrefs({...loadUiPrefs(),density:p.density,glassSidebar:p.glass,
  glassCards:p.glass||p.cardStyle==='glass',glassDialogs:p.glass,
  glassTabs:p.glass});
 if(p.wallpaper)applyWallpaperUrl(p.wallpaper);else resetWallpaper();
 window.dispatchEvent(new CustomEvent('lexis-experience-updated',{detail:p}));
}
