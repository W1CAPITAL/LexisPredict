import {describe,expect,it} from 'vitest';
import {CREATIVE_LAB_TOOLS,toolById} from './creative-tools';

describe('W1 Creative Lab catalog',()=>{
 it('retains existing engines and registers newly requested options',()=>{
  const ids=['open-higgsfield','genjutsu-sirio','genjutsu-abdullayev','genjutsu-anil',
   'voicestudio','reel-studio','hypit','youtube-shorts','motionsmith-mcp','motionsmith-unreal'];
  expect(ids.every(id=>Boolean(toolById(id)))).toBe(true);
  expect(new Set(CREATIVE_LAB_TOOLS.map(x=>x.id)).size).toBe(CREATIVE_LAB_TOOLS.length);
 });
 it('never presents external software or unverified MCP as active',()=>{
  for(const id of ['hypit','youtube-shorts','motionsmith-mcp','motionsmith-unreal'])
   expect(toolById(id)?.status).not.toBe('online');
  expect(toolById('motionsmith-mcp')?.status).toBe('unverified');
  expect(toolById('motionsmith-unreal')?.requirements).toContain('Unreal Engine 5.8');
 });
 it('preserves a direct link to existing W1 Projects and production sources',()=>{
  expect(toolById('reel-studio')?.url).toContain('W1CAPITAL/SITE/tree/main/scripts/reel-studio');
  expect(toolById('hypit')?.warning).toMatch(/multiusu|licença comercial/);
 });
});
