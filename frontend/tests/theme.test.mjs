import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../public/theme.js', import.meta.url), 'utf8');
for (const [saved, systemDark, expected] of [[null,true,'dark'],[null,false,'light'],['light',true,'light'],['dark',false,'dark'],['invalid',true,'dark']]) {
  test(`theme bootstrap: saved=${saved}, systemDark=${systemDark}`, () => {
    const root = {dataset:{},style:{}};
    runInNewContext(source,{document:{documentElement:root},localStorage:{getItem:()=>saved},window:{matchMedia:()=>({matches:systemDark})}});
    assert.equal(root.dataset.theme,expected);
    assert.equal(root.style.colorScheme,expected);
  });
}
test('theme bootstrap works when storage is blocked', () => {
  const root = {dataset:{},style:{}};
  runInNewContext(source,{document:{documentElement:root},localStorage:{getItem:()=>{throw new Error('blocked')}},window:{matchMedia:()=>({matches:true})}});
  assert.equal(root.dataset.theme,'dark');
});
