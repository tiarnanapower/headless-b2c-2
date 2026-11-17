import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getBundleConfig, parseBundleSlots } from './bundles';
import { isBundleComponentLine, reconcileBundles, writeBundleGroups } from './bundles-cart';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

interface Line {
  id: string;
  product_id: number;
  variant_id: number;
  quantity: number;
  list_price: number;
}

// A tiny in-memory stand-in for the BigCommerce cart REST API.
let lines: Line[];
let metafield: { id: number; value: string } | null;
let cartExists: boolean;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

beforeEach(() => {
  process.env.BIGCOMMERCE_STORE_HASH = 'abc';
  process.env.BIGCOMMERCE_ACCESS_TOKEN = 'token';
  lines = [];
  metafield = null;
  cartExists = true;

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname.replace('/stores/abc/v3', '');
      const method = init.method ?? 'GET';
      const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

      if (!cartExists) return Promise.resolve(json({}, 404));

      if (path === '/carts/c1' && method === 'GET') {
        return Promise.resolve(json({ data: { id: 'c1', line_items: { physical_items: lines } } }));
      }

      if (path === '/carts/c1/metafields' && method === 'GET') {
        return Promise.resolve(json({ data: metafield ? [metafield] : [] }));
      }

      if (path === '/carts/c1/metafields' && method === 'POST') {
        metafield = { id: 1, value: String(body.value) };

        return Promise.resolve(json({ data: metafield }));
      }

      if (path === '/carts/c1/metafields/1' && method === 'PUT') {
        metafield = { id: 1, value: String(body.value) };

        return Promise.resolve(json({ data: metafield }));
      }

      if (path === '/carts/c1/metafields/1' && method === 'DELETE') {
        metafield = null;

        return Promise.resolve(new Response(null, { status: 204 }));
      }

      const item = /^\/carts\/c1\/items\/(.+)$/.exec(path);

      if (item && method === 'DELETE') {
        lines = lines.filter((line) => line.id !== item[1]);
        // BigCommerce deletes the cart when its last line is removed.
        if (lines.length === 0) cartExists = false;

        return Promise.resolve(new Response(null, { status: 204 }));
      }

      if (item && method === 'PUT') {
        const lineItem = body.line_item as { quantity: number; list_price: number };

        lines = lines.map((line) =>
          line.id === item[1]
            ? { ...line, quantity: lineItem.quantity, list_price: lineItem.list_price }
            : line,
        );

        return Promise.resolve(json({ data: {} }));
      }

      return Promise.resolve(json({}, 500));
    }),
  );
});

const bundle = (quantity = 1): Line => ({
  id: 'bundle',
  product_id: 1,
  variant_id: 10,
  quantity,
  list_price: 50,
});
const free = (id: string, quantity: number): Line => ({
  id,
  product_id: Number(id.replace(/\D/g, '')) || 2,
  variant_id: 20,
  quantity,
  list_price: 0,
});

describe('bundle slots', () => {
  it('uses Bundle_Options, then overrides, then the default of 2', () => {
    expect(parseBundleSlots('3')).toBe(3);
    expect(parseBundleSlots(' 4 ')).toBe(4);
    expect(parseBundleSlots('99')).toBe(10);
    expect(parseBundleSlots('0')).toBeUndefined();
    expect(parseBundleSlots('abc')).toBeUndefined();
    expect(parseBundleSlots('')).toBeUndefined();
    expect(parseBundleSlots(null)).toBeUndefined();

    expect(getBundleConfig(123).slots).toBe(2);
    expect(getBundleConfig(123, 5).slots).toBe(5);
    expect(getBundleConfig(123, undefined).slots).toBe(2);
  });
});

describe('reconcileBundles', () => {
  const group = {
    instanceId: 'x',
    bundleLineId: 'bundle',
    components: [
      { lineId: 'm1', perBundle: 1, label: 'Mandatory' },
      { lineId: 'f1', perBundle: 2, label: 'Flavour' },
    ],
  };

  it('does nothing when there are no bundle records', async () => {
    lines = [bundle()];

    expect(await reconcileBundles('c1')).toEqual([]);
    expect(lines).toHaveLength(1);
  });

  it('leaves a healthy bundle alone', async () => {
    lines = [bundle(), free('m1', 1), free('f1', 2)];
    await writeBundleGroups('c1', [group]);

    const kept = await reconcileBundles('c1');

    expect(kept).toHaveLength(1);
    expect(lines.map((l) => [l.id, l.quantity])).toEqual([
      ['bundle', 1],
      ['m1', 1],
      ['f1', 2],
    ]);
  });

  it('removes the components when the bundle line is gone', async () => {
    lines = [free('m1', 1), free('f1', 2), { ...bundle(), id: 'other', product_id: 9 }];
    await writeBundleGroups('c1', [group]);

    const kept = await reconcileBundles('c1');

    expect(kept).toEqual([]);
    expect(lines.map((l) => l.id)).toEqual(['other']);
    expect(metafield).toBeNull();
  });

  it('scales the components when the bundle quantity changes, keeping them free', async () => {
    lines = [bundle(3), free('m1', 1), free('f1', 2)];
    await writeBundleGroups('c1', [group]);

    await reconcileBundles('c1');

    expect(lines.map((l) => [l.id, l.quantity, l.list_price])).toEqual([
      ['bundle', 3, 50],
      ['m1', 3, 0],
      ['f1', 6, 0],
    ]);
  });

  it('adds up two bundles that share a component line, and handles one being removed', async () => {
    const second = {
      instanceId: 'y',
      bundleLineId: 'bundle2',
      components: [{ lineId: 'f1', perBundle: 1, label: 'Flavour' }],
    };

    lines = [bundle(1), { ...bundle(2), id: 'bundle2' }, free('f1', 4)];
    await writeBundleGroups('c1', [{ ...group, components: [group.components[1]!] }, second]);

    await reconcileBundles('c1');
    expect(lines.find((l) => l.id === 'f1')?.quantity).toBe(4); // 2*1 + 1*2

    lines = lines.filter((l) => l.id !== 'bundle2');
    await reconcileBundles('c1');
    expect(lines.find((l) => l.id === 'f1')?.quantity).toBe(2);
  });

  it('copes with the cart being deleted when the last line goes', async () => {
    lines = [free('m1', 1), free('f1', 2)];
    await writeBundleGroups('c1', [group]);

    await expect(reconcileBundles('c1')).resolves.toEqual([]);
    expect(cartExists).toBe(false);
  });
});

describe('isBundleComponentLine', () => {
  it('is true only for lines recorded as components', async () => {
    lines = [bundle(), free('m1', 1)];
    await writeBundleGroups('c1', [
      {
        instanceId: 'x',
        bundleLineId: 'bundle',
        components: [{ lineId: 'm1', perBundle: 1, label: 'M' }],
      },
    ]);

    expect(await isBundleComponentLine('c1', 'm1')).toBe(true);
    expect(await isBundleComponentLine('c1', 'bundle')).toBe(false);
    expect(await isBundleComponentLine('c1', 'nope')).toBe(false);
  });

  it('is false when the cart has no record', async () => {
    expect(await isBundleComponentLine('c1', 'm1')).toBe(false);
  });
});
