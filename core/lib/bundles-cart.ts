import { revalidateTag } from 'next/cache';

import { TAGS } from '~/client/tags';

/**
 * Server-side bookkeeping that ties a bundle's free component lines to the bundle line.
 *
 * When a bundle is added, one JSON record is stored on the cart (a cart metafield) saying which
 * cart lines are the bundle and which lines are its components. The cart page hides component
 * lines, the cart actions refuse to change them directly, and `reconcileBundles` keeps the
 * components in step with the bundle: remove the bundle and its components go; change the
 * bundle's quantity and its components scale.
 */

const NAMESPACE = 'catalyst_bundles';
const KEY = 'groups';

export interface BundleRestLineItem {
  id: string;
  product_id: number;
  variant_id: number;
  quantity: number;
  list_price: number;
  options?: Array<{ name: string; value: string }>;
}

export interface BundleRestCart {
  id: string;
  line_items: { physical_items: BundleRestLineItem[] };
}

export interface BundleGroupComponent {
  /** Cart line id of the component. */
  lineId: string;
  /** Units of this component per single bundle. */
  perBundle: number;
  label: string;
}

export interface BundleGroup {
  /** Random id stored in the bundle line's hidden "Bundle" text so each bundle is its own line. */
  instanceId: string;
  /** Cart line id of the bundle product. */
  bundleLineId: string;
  components: BundleGroupComponent[];
}

export async function bundleApi(path: string, init: RequestInit = {}) {
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  const accessToken = process.env.BIGCOMMERCE_ACCESS_TOKEN;

  if (!storeHash || !accessToken) {
    throw new Error('Bundles need BIGCOMMERCE_STORE_HASH and BIGCOMMERCE_ACCESS_TOKEN to be set.');
  }

  return fetch(`https://api.bigcommerce.com/stores/${storeHash}/v3${path}`, {
    ...init,
    headers: {
      'X-Auth-Token': accessToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  });
}

export async function getBundleRestCart(cartId: string): Promise<BundleRestCart | null> {
  const response = await bundleApi(`/carts/${cartId}?include=line_items.physical_items.options`);

  if (response.status === 404) return null;

  if (!response.ok) throw new Error(`Could not read the cart (${response.status}).`);

  const json = (await response.json()) as { data: BundleRestCart };

  return json.data;
}

export async function readBundleGroups(
  cartId: string,
): Promise<{ groups: BundleGroup[]; metafieldId?: number }> {
  const response = await bundleApi(`/carts/${cartId}/metafields?namespace=${NAMESPACE}&key=${KEY}`);

  if (response.status === 404) return { groups: [] };

  if (!response.ok) throw new Error(`Could not read bundle records (${response.status}).`);

  const json = (await response.json()) as { data: Array<{ id: number; value: string }> };
  const metafield = json.data[0];

  if (!metafield) return { groups: [] };

  try {
    const parsed: unknown = JSON.parse(metafield.value);

    return {
      groups: Array.isArray(parsed) ? (parsed as BundleGroup[]) : [],
      metafieldId: metafield.id,
    };
  } catch {
    return { groups: [], metafieldId: metafield.id };
  }
}

export async function writeBundleGroups(
  cartId: string,
  groups: BundleGroup[],
  metafieldId?: number,
) {
  if (groups.length === 0) {
    if (metafieldId)
      await bundleApi(`/carts/${cartId}/metafields/${metafieldId}`, { method: 'DELETE' });

    return;
  }

  const value = JSON.stringify(groups);

  const response = metafieldId
    ? await bundleApi(`/carts/${cartId}/metafields/${metafieldId}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      })
    : await bundleApi(`/carts/${cartId}/metafields`, {
        method: 'POST',
        body: JSON.stringify({
          permission_set: 'app_only',
          namespace: NAMESPACE,
          key: KEY,
          value,
        }),
      });

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error('Saving bundle record failed', response.status, await response.text());

    throw new Error('We could not save the bundle in your cart. Please try again.');
  }
}

async function deleteLine(cartId: string, lineId: string) {
  const response = await bundleApi(`/carts/${cartId}/items/${lineId}`, { method: 'DELETE' });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not remove a bundle item (${response.status}).`);
  }
}

async function setLineQuantity(cartId: string, line: BundleRestLineItem, quantity: number) {
  const response = await bundleApi(`/carts/${cartId}/items/${line.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      line_item: {
        product_id: line.product_id,
        ...(line.variant_id ? { variant_id: line.variant_id } : {}),
        quantity,
        list_price: 0,
      },
    }),
  });

  if (!response.ok) throw new Error(`Could not update a bundle item (${response.status}).`);
}

/** True when this cart line is a free component of a bundle (so it can't be changed directly). */
export async function isBundleComponentLine(cartId: string, lineId: string) {
  const { groups } = await readBundleGroups(cartId);

  return groups.some((group) => group.components.some((component) => component.lineId === lineId));
}

/**
 * Brings component lines back in step with their bundle lines:
 * - a bundle line that is gone releases its components (they are removed),
 * - a bundle line with a different quantity scales its components to match.
 *
 * Returns the bundle records that are still valid afterwards.
 */
export async function reconcileBundles(cartId: string): Promise<BundleGroup[]> {
  const { groups, metafieldId } = await readBundleGroups(cartId);

  if (groups.length === 0) return [];

  const cart = await getBundleRestCart(cartId);

  if (!cart) return [];

  const lines = new Map(cart.line_items.physical_items.map((line) => [line.id, line]));
  const kept: BundleGroup[] = [];
  const expected = new Map<string, number>();

  groups.forEach((group) => {
    const bundleLine = lines.get(group.bundleLineId);

    if (!bundleLine) return;

    kept.push(group);

    group.components.forEach((component) => {
      expected.set(
        component.lineId,
        (expected.get(component.lineId) ?? 0) + component.perBundle * bundleLine.quantity,
      );
    });
  });

  const tracked = new Set(groups.flatMap((group) => group.components.map((c) => c.lineId)));
  let changed = kept.length !== groups.length;

  for (const lineId of tracked) {
    const line = lines.get(lineId);

    if (!line) continue;

    const wanted = expected.get(lineId) ?? 0;

    if (wanted === 0) {
      // eslint-disable-next-line no-await-in-loop
      await deleteLine(cartId, lineId);
      changed = true;
    } else if (line.quantity !== wanted) {
      // eslint-disable-next-line no-await-in-loop
      await setLineQuantity(cartId, line, wanted);
      changed = true;
    }
  }

  if (changed) {
    await writeBundleGroups(cartId, kept, metafieldId);
    revalidateTag(TAGS.cart, { expire: 0 });
  }

  return kept;
}

/** Removes lines that were just added when something goes wrong part-way through adding a bundle. */
export async function removeLines(cartId: string, lineIds: string[]) {
  for (const lineId of lineIds) {
    // eslint-disable-next-line no-await-in-loop
    await deleteLine(cartId, lineId);
  }

  revalidateTag(TAGS.cart, { expire: 0 });
}
