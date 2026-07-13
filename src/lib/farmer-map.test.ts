import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMapPoints, FARMER_MAP_POINTS, type FarmerMapPoint } from './farmer-map.ts';

// Minimal Farmer stubs — only id + name are read by the matcher.
const farmer = (id: string, name: string) => ({ id, name }) as any;

test('exact name match attaches the slug', () => {
  const points: FarmerMapPoint[] = [{ name: 'Димка Четова', village: 'Крушари', lat: 43.87, lng: 27.78 }];
  const farmers = [farmer('f1', 'Димка Четова')];
  const slugs = new Map([['f1', 'dimka-chetova']]);
  const out = resolveMapPoints(points, farmers, slugs);
  assert.equal(out[0].slug, 'dimka-chetova');
});

test('match is case/whitespace-insensitive', () => {
  const points: FarmerMapPoint[] = [{ name: '  димка   четова ', village: 'Крушари', lat: 43.87, lng: 27.78 }];
  const farmers = [farmer('f1', 'Димка Четова')];
  const slugs = new Map([['f1', 'dimka-chetova']]);
  assert.equal(resolveMapPoints(points, farmers, slugs)[0].slug, 'dimka-chetova');
});

test('strips a leading "Ферма " prefix on either side', () => {
  const points: FarmerMapPoint[] = [{ name: 'Ферма Калата', village: 'Русе', lat: 43.849, lng: 25.954 }];
  const farmers = [farmer('f1', 'Калата')];
  const slugs = new Map([['f1', 'kalata']]);
  assert.equal(resolveMapPoints(points, farmers, slugs)[0].slug, 'kalata');
});

test('no matching farmer → slug is null', () => {
  const points: FarmerMapPoint[] = [{ name: 'BT juice', village: 'Варна', lat: 43.204, lng: 27.91 }];
  const out = resolveMapPoints(points, [], new Map());
  assert.equal(out[0].slug, null);
});

test('seed data has 13 points, all with finite coords and non-empty labels', () => {
  assert.equal(FARMER_MAP_POINTS.length, 13);
  for (const p of FARMER_MAP_POINTS) {
    assert.ok(p.name.trim().length > 0, `name empty: ${JSON.stringify(p)}`);
    assert.ok(p.village.trim().length > 0, `village empty: ${JSON.stringify(p)}`);
    assert.ok(Number.isFinite(p.lat) && p.lat > 42 && p.lat < 45, `lat off: ${JSON.stringify(p)}`);
    assert.ok(Number.isFinite(p.lng) && p.lng > 22 && p.lng < 29, `lng off: ${JSON.stringify(p)}`);
  }
});
