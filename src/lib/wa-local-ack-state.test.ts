import {describe,expect,it} from 'vitest';
import {isWaAckState,isWaJobId,waAckDecision} from './wa-local-ack-state';

describe('WA.Auto receipt lifecycle',()=>{
  it('only accepts explicit statuses and real UUID job identifiers',()=>{
    for(const state of ['accepted','delivered','read','failed','uncertain'])expect(isWaAckState(state)).toBe(true);
    expect(isWaAckState('sent')).toBe(false);
    expect(isWaAckState('')).toBe(false);
    expect(isWaJobId('4b831617-4610-4f19-9e0e-64129d9640d0')).toBe(true);
    expect(isWaJobId('--------------------abcd------------')).toBe(false);
  });
  it('distinguishes accepted from delivered and allows fast read receipts',()=>{
    expect(waAckDecision('claimed','accepted')).toBe('advance');
    expect(waAckDecision('claimed','read')).toBe('reject');
    expect(waAckDecision('accepted','delivered')).toBe('advance');
    expect(waAckDecision('accepted','read')).toBe('advance');
    expect(waAckDecision('delivered','read')).toBe('advance');
    expect(waAckDecision('accepted','accepted')).toBe('same');
    expect(waAckDecision('read','read')).toBe('same');
  });
  it('does not turn a failure, uncertainty or read into another success state',()=>{
    expect(waAckDecision('claimed','uncertain')).toBe('advance');
    expect(waAckDecision('claimed','failed')).toBe('advance');
    expect(waAckDecision('uncertain','delivered')).toBe('reject');
    expect(waAckDecision('failed','accepted')).toBe('reject');
    expect(waAckDecision('delivered','accepted')).toBe('reject');
    expect(waAckDecision('read','delivered')).toBe('reject');
    expect(waAckDecision('claimed','anything')).toBe('reject');
  });
});
