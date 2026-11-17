import { revalidateTag } from 'next/cache';

import { TAGS } from '~/client/tags';

import { BundleRestCart, bundleApi } from '../bundles-cart';

interface ComplimentaryItem {
  productEntityId: number;
  variantEntityId?: number;
  quantity: number;
}

/**
 * Adds line items to an existing cart at a list price of 0, using the Management API, and returns
 * the updated cart. The Storefront GraphQL API can't override prices, so this needs
 * BIGCOMMERCE_ACCESS_TOKEN with modify access to Carts.
 */
export async function addComplimentaryLineItems(
  cartId: string,
  items: ComplimentaryItem[],
): Promise<BundleRestCart> {
  const response = await bundleApi(
    `/carts/${cartId}/items?include=line_items.physical_items.options`,
    {
      method: 'POST',
      body: JSON.stringify({
        line_items: items.map((item) => ({
          product_id: item.productEntityId,
          ...(item.variantEntityId ? { variant_id: item.variantEntityId } : {}),
          quantity: item.quantity,
          list_price: 0,
        })),
      }),
    },
  );

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error('Adding bundle items failed', response.status, await response.text());

    throw new Error('We could not add all of the bundle items to your cart. Please try again.');
  }

  revalidateTag(TAGS.cart, { expire: 0 });

  const json = (await response.json()) as { data: BundleRestCart };

  return json.data;
}
