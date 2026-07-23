import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMapPoints, matchFarmers } from './farmer-map.ts';

// Minimal Farmer stubs — only id/name/lat/lng/city are read by the resolver.
const farmer = (id: string, name: string, lat: number | null, lng: number | null, city = '') =>
  ({ id, name, lat, lng, city }) as any;

test('farmer with geocoded coords → point carries id/lat/lng/village/slug', () => {
  const farmers = [farmer('f1', 'Димка Четова', 43.87, 27.78, 'Крушари')];
  const slugs = new Map([['f1', 'dimka-chetova']]);
  const out = resolveMapPoints(farmers, slugs);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'f1');
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
  assert.equal(out[0].id, 'f1');
  assert.equal(out[0].slug, 'parvi');
  assert.equal(out[1].id, 'f2');
  assert.equal(out[1].slug, 'vtori');
});

// --- matchFarmers -----------------------------------------------------------

const f = (id: string, name: string, role: string | null = null, bio: string | null = null) =>
  ({ id, name, role, bio });
const p = (farmerId: string | null, name: string, catId: string) => ({ farmerId, name, catId });

test('matchFarmers: empty filter → every farmer matches', () => {
  const farmers = [f('f1', 'Иван'), f('f2', 'Мария')];
  const out = matchFarmers(farmers, [], {});
  assert.equal(out.length, 2);
});

test('matchFarmers: q matches the farmer\'s own name (bg locale, case-insensitive)', () => {
  const farmers = [f('f1', 'Димка Четова'), f('f2', 'Мария Петрова')];
  const out = matchFarmers(farmers, [], { q: 'ДИМКА' });
  assert.deepEqual(out.map((x) => x.id), ['f1']);
});

test('matchFarmers: q matches role or bio when name doesn\'t', () => {
  const farmers = [
    f('f1', 'Иван Иванов', 'Пчелар', null),
    f('f2', 'Петър Петров', null, 'Отглежда домати от 20 години'),
    f('f3', 'Друг', null, null),
  ];
  const out = matchFarmers(farmers, [], { q: 'пчелар' });
  assert.deepEqual(out.map((x) => x.id), ['f1']);
  const out2 = matchFarmers(farmers, [], { q: 'домати' });
  assert.deepEqual(out2.map((x) => x.id), ['f2']);
});

test('matchFarmers: q matches any product name of that farmer', () => {
  const farmers = [f('f1', 'Иван'), f('f2', 'Мария')];
  const products = [p('f1', 'Ягоди', 'fruit'), p('f2', 'Домати', 'veg')];
  const out = matchFarmers(farmers, products, { q: 'ягоди' });
  assert.deepEqual(out.map((x) => x.id), ['f1']);
});

test('matchFarmers: q with no match anywhere → empty result', () => {
  const farmers = [f('f1', 'Иван')];
  const products = [p('f1', 'Ягоди', 'fruit')];
  const out = matchFarmers(farmers, products, { q: 'кайсии' });
  assert.equal(out.length, 0);
});

test('matchFarmers: empty cats set → no category restriction', () => {
  const farmers = [f('f1', 'Иван')];
  const products = [p('f1', 'Ягоди', 'fruit')];
  const out = matchFarmers(farmers, products, { cats: new Set() });
  assert.equal(out.length, 1);
});

test('matchFarmers: cats matches when ANY of the farmer\'s products is in the set (OR)', () => {
  const farmers = [f('f1', 'Иван'), f('f2', 'Мария')];
  const products = [
    p('f1', 'Ягоди', 'fruit'),
    p('f1', 'Мед', 'honey'),
    p('f2', 'Домати', 'veg'),
  ];
  const out = matchFarmers(farmers, products, { cats: new Set(['honey']) });
  assert.deepEqual(out.map((x) => x.id), ['f1']);
});

test('matchFarmers: cats excludes a farmer with no product in the set', () => {
  const farmers = [f('f1', 'Иван'), f('f2', 'Мария')];
  const products = [p('f1', 'Ягоди', 'fruit'), p('f2', 'Домати', 'veg')];
  const out = matchFarmers(farmers, products, { cats: new Set(['veg']) });
  assert.deepEqual(out.map((x) => x.id), ['f2']);
});

test('matchFarmers: q and cats compose with AND', () => {
  const farmers = [f('f1', 'Иван'), f('f2', 'Мария')];
  const products = [
    p('f1', 'Ягоди', 'fruit'),
    p('f2', 'Ягодов конфитюр', 'jam'),
  ];
  const out = matchFarmers(farmers, products, { q: 'ягод', cats: new Set(['fruit']) });
  assert.deepEqual(out.map((x) => x.id), ['f1']);
});

test('matchFarmers: products with no farmerId are ignored (never crash, never match)', () => {
  const farmers = [f('f1', 'Иван')];
  const products = [p(null, 'Кошница', 'bundle')];
  const out = matchFarmers(farmers, products, { cats: new Set(['bundle']) });
  assert.equal(out.length, 0);
});
