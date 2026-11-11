import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

describe('Swarm Rebuild nativo por rota',()=>{
 const source=readFileSync('src/components/system/swarm-native-transition.tsx','utf8');
 const layout=readFileSync('src/app/layout.tsx','utf8');
 const css=readFileSync('src/app/swarm-native-transition.css','utf8');
 it('monta no shell global e acompanha a primeira abertura de cada rota por aba',()=>{
  expect(layout).toContain('SwarmNativeTransition');
  expect(source).toContain('usePathname');
  expect(source).toContain('visited.current.has(pathname)');
  expect(source).toContain('new Set<string>()');
 });
 it('reexecuta após F5 sem persistir estado entre carregamentos',()=>{
  expect(source).not.toContain('localStorage');
  expect(source).not.toContain('sessionStorage');
  expect(source).toContain('useRef(new Set<string>())');
 });
 it('usa canvas leve, limita DPR e taxa de quadros, e respeita economia/redução de movimento',()=>{
  expect(source).toContain('Math.min(window.devicePixelRatio||1,1.25)');
  expect(source).toContain('now-lastFrame<30');
  expect(source).toContain('prefers-reduced-motion: reduce');
  expect(source).toContain('connection?.saveData===true');
  expect(css).toContain('pointer-events:none');
  expect(css).toContain('prefers-reduced-motion:reduce');
 });
});
