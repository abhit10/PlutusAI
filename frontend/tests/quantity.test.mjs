import test from 'node:test';
import assert from 'node:assert/strict';
import { decimalUnits, decimalString, cryptoStops, SCALE } from '../src/lib/quantity.ts';
test('decimal quantities round trip without floating point truncation', () => {
 for (const value of ['0.000000000001','0.12345678','999999999999999999.123456789012','10001']) assert.equal(decimalString(decimalUnits(value)),value);
 assert.equal(decimalUnits('1e-8'),10000n);
 for (const value of ['NaN','Infinity','-1','0.0000000000001','1e999']) assert.equal(decimalUnits(value),null);
});
test('crypto range uses exact configured steps and dense low quantities', () => {
 for (const value of ['0.00000001','0.000000000001','0.00025','2']) {
  const step=decimalUnits(value), points=cryptoStops(step);
  assert.equal(points[0],step);
  assert.equal(points[1],step*2n);
  assert.equal(points.at(-1),(10000n*SCALE/step)*step);
  assert.ok(points.length<2000);
  points.forEach((point,i)=>{assert.equal(point%step,0n);if(i)assert.ok(point>points[i-1]);});
 }
 assert.deepEqual(cryptoStops(0n),[]);
 assert.deepEqual(cryptoStops(20000n*SCALE),[20000n*SCALE]);
});
