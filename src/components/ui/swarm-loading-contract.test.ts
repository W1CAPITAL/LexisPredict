import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

const read=(p:string)=>readFileSync(p,'utf8');

describe('lightweight swarm-style loading across the LexisPredict shell',()=>{
 it('uses one standalone shared visual indicator for route and partial loading fallbacks',()=>{
  expect(read('src/components/ui/page-loader.tsx')).toContain('SwarmLoadingIndicator');
  expect(read('src/components/ui/page-loading.tsx')).toContain('SwarmLoadingIndicator');
  expect(read('src/components/ops/page-skeleton.tsx')).toContain('SwarmLoadingIndicator');
  expect(read('src/app/layout.tsx')).toContain("swarm-loading.css");
 });
 it('never copies the unlicensed Chrome extension or sweeps live DOM',()=>{
  const source=read('src/components/ui/swarm-loading-indicator.tsx');
  expect(source).not.toMatch(/requestAnimationFrame|MutationObserver|document\.querySelectorAll|AudioContext|fetch\(/);
  expect(source).toMatch(/aria-hidden/);
  expect((source.match(/MousePointer2/g)||[]).length).toBeLessThan(5);
 });

 it('keeps decorative swarm cursors static unless the optional rebuild is enabled',()=>{
  const css=read('src/app/swarm-loading.css');
  expect(css).toContain('html:not([data-lexis-swarm-rebuild="enabled"]) .lx-mini-swarm-actor');
  expect(css).toMatch(/animation:none!important/);
  const route=read('src/components/layout/swarm-route-loading.tsx');
  expect(route).toContain('data-lexis-swarm-rebuild');
  expect(route).toContain('preferences.enabled ? "enabled" : "disabled"');
 });
 it('disables the animation under reduced motion, hides extra actors on small screens and needs no JS polling',()=>{
  const css=read('src/app/swarm-loading.css');
  expect(css).toMatch(/prefers-reduced-motion/);
  expect(css).toMatch(/max-width:\s*640px/);
  expect(css).toMatch(/@keyframes/);
  expect(css).not.toMatch(/requestAnimationFrame|setInterval|@import|backdrop-filter/);
 });
});
