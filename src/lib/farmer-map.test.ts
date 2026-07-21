import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMapPoints } from './farmer-map.ts';

// Minimal Farmer stubs — only id/name/lat/lng/city are read by the resolver.
const farmer = (id: string, name: string, lat: number | null, lng: number | null, city = '') =>
  ({ id, name, lat, lng, city }) as any;

test('farmer with geocoded coords → point carries lat/lng/village/slug', () => {
  const farmers = [farmer('f1', 'Димка Четова', 43.87, 27.78, 'Крушари')];
  const slugs = new Map([['f1', 'dimka-chetova']]);
  const out = resolveMapPoints(farmers, slugs);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Димка Четова');
  assert.equal(out[0].village, 'Крушари');
  assert.equal(out[0].lat, 43.87);
  assert.equal(out[0].lng, 27.78);
  assert.equal(out[0].slug, 'dimka-chetova');
});

test('farmer without coords → no point emitted', () => {
  const farmers = [farmer('f1', 'Няма адрес', null, null)];
  const out = resolveMapPoints(farmers, new Map());
  assert.equal(out.length, 0);
});

test('farmer with only lat (no lng) → still excluded', () => {
  const farmers = [farmer('f1', 'Частичен адрес', 43.2, null)];
  const out = resolveMapPoints(farmers, new Map());
  assert.equal(out.length, 0);
});

test('farmer with coords but no slug entry → slug is null', () => {
  const farmers = [farmer('f1', 'Без слъг', 43.2, 27.9)];
  const out = resolveMapPoints(farmers, new Map());
  assert.equal(out[0].slug, null);
});

test('multiple geocoded farmers → one point each, order preserved', () => {
  const farmers = [
    farmer('f1', 'Първи', 43.1, 27.1, 'Варна'),
    farmer('f2', 'Втори', 43.2, 27.2, 'Русе'),
  ];
  const slugs = new Map([['f1', 'parvi'], ['f2', 'vtori']]);
  const out = resolveMapPoints(farmers, slugs);
  assert.equal(out.length, 2);
  assert.equal(out[0].slug, 'parvi');
  assert.equal(out[1].slug, 'vtori');
});
