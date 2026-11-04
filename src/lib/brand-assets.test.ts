import { describe,it,expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const load=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");
describe("LexisPredict W1 approved wine and silver brand",()=>{
 it("has the approved source WebP atlas without loading remote assets",()=>{
  const bytes=readFileSync(resolve(process.cwd(),"public/brand/w1-lexis-atlas.webp"));
  expect(bytes.toString("ascii",0,4)).toBe("RIFF");
  expect(bytes.toString("ascii",8,12)).toBe("WEBP");
  expect(bytes.length).toBeLessThan(50000);
 });
 it("reuses the same brand mark on login, vertical sidebar and dock",()=>{
  const login=load("src/app/login/page.tsx");
  const vertical=load("src/components/layout/sidebar-vertical.tsx");
  const dock=load("src/components/layout/sidebar-dock.tsx");
  expect(login).toContain("lexis-brand-lockup");
  expect(login).toContain("lexis-brand-symbol");
  expect(vertical).toContain("lexis-brand-symbol");
  expect(dock).toContain("lexis-brand-symbol");
  expect(vertical).not.toContain('src="/logo.png"');
  expect(dock).not.toContain('src="/logo.png"');
 });
 it("uses the metal-on-wine brand artwork through a local stylesheet and favicon",()=>{
  const css=load("src/app/globals.css");
  const layout=load("src/app/layout.tsx");
  expect(css).toContain('url("/brand/w1-lexis-atlas.webp")');
  expect(css).toContain(".lexis-brand-symbol");
  expect(css).toContain(".lexis-brand-lockup");
  expect(layout).toContain("/brand/lexis-favicon.svg");
 });
});
