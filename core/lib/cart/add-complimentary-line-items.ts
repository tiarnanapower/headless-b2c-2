import { revalidateTag } from 'next/cache';

import { TAGS } from '~/client/tags';

interface ComplimentaryItem {
  productEntityId: number;
  variantEntityId?: number;
  quantity: number;
}

/**
 * Adds line items to an existing cart at a list price of 0, using the Management API.
 * The Storefront GraphQL API can't override prices, so this needs BIGCOMMERCE_ACCESS_TOKEN
 * with modify access to Carts.
 */
export async function addComplimentaryLineItems(cartId: string, items: ComplimentaryItem[]) {
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  const accessToken = process.env.BIGCOMMERCE_ACCESS_TOKEN;

  if (!storeHash || !accessToken) {
    throw new Error('Bundles need BIGCOMMERCE_STORE_HASH and BIGCOMMERCE_ACCESS_TOKEN to be set.');
  }

  const response = await fetch(
    `https://api.bigcommerce.com/stores/${storeHash}/v3/carts/${cartId}/items`,
    {
      method: 'POST',
      headers: {
        'X-Auth-Token': accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        line_items: items.map((item) => ({
          product_id: item.productEntityId,
          ...(item.variantEntityId ? { variant_id: item.variantEntityId } : {}),
          quantity: item.quantity,
          list_price: 0,
        })),
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error('Adding bundle items failed', response.status, await response.text());

    throw new Error('We could not add all of the bundle items to your cart. Please try again.');
  }

  revalidateTag(TAGS.cart, { expire: 0 });
}
