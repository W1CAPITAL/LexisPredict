import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reconnectDelay, createInboundDeduper, createEarlyReceiptBuffer,
} from './connection-lifecycle.mjs';

test('reconnects with exponential jitter and a bounded 60-second ceiling', () => {
  assert.equal(reconnectDelay(1,()=>0),2000);
  assert.equal(reconnectDelay(1,()=>1),3000);
  assert.equal(reconnectDelay(2,()=>0.5),5000);
  assert.equal(reconnectDelay(3,()=>0.5),10000);
  assert.ok(reconnectDelay(20,()=>1)<=60000);
  assert.ok(reconnectDelay(Number.NaN,()=>Number.NaN)>=2000);
});

test('deduplicates inbound events by provider ID and allows explicit recovery on failure', () => {
  let time=1000;
  const gate=createInboundDeduper({now:()=>time,ttlMs:100,maxEntries:3});
  assert.equal(gate.claim('5511999999999:wamid.123'),true);
  assert.equal(gate.claim('5511999999999:wamid.123'),false);
  gate.release('5511999999999:wamid.123');
  assert.equal(gate.claim('5511999999999:wamid.123'),true);
  time+=101;
  assert.equal(gate.claim('5511999999999:wamid.123'),true);
  assert.equal(gate.claim(''),false);
});

test('bounds inbound memory during a long-running worker', () => {
  const gate=createInboundDeduper({maxEntries:2});
  assert.equal(gate.claim('a'),true);
  assert.equal(gate.claim('b'),true);
  assert.equal(gate.claim('c'),true);
  assert.equal(gate.size(),2);
  assert.equal(gate.claim('a'),true); // Oldest key evicted.
});

test('retains the highest early delivery acknowledgement without declaring a send', () => {
  let time=1000;
  const receipts=createEarlyReceiptBuffer({now:()=>time,ttlMs:100,maxEntries:3});
  receipts.observe('message-1',2); // Accepted does not mean delivered.
  assert.equal(receipts.take('message-1'),0);
  receipts.observe('message-1',4);
  receipts.observe('message-1',3); // Out of order must not regress.
  assert.equal(receipts.take('message-1'),4);
  assert.equal(receipts.take('message-1'),0);
  receipts.observe('message-2',3);
  time+=101;
  assert.equal(receipts.take('message-2'),0);
});

test('bounds early receipt buffer and never stores message contents', () => {
  const receipts=createEarlyReceiptBuffer({maxEntries:2});
  receipts.observe('id-1',3);
  receipts.observe('id-2',4);
  receipts.observe('id-3',3);
  assert.equal(receipts.size(),2);
  assert.equal(receipts.take('id-1'),0);
  assert.equal(receipts.take('id-2'),4);
});
