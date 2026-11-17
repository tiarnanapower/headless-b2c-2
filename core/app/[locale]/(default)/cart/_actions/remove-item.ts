'use server';

import { revalidateTag } from 'next/cache';
import { getTranslations } from 'next-intl/server';

import { getSessionCustomerAccessToken } from '~/auth';
import { client } from '~/client';
import { graphql, VariablesOf } from '~/client/graphql';
import { TAGS } from '~/client/tags';
import { clearCartId, getCartId } from '~/lib/cart';
import { getBundleRestCart, isBundleComponentLine, reconcileBundles } from '~/lib/bundles-cart';

const DeleteCartLineItemMutation = graphql(`
  mutation DeleteCartLineItemMutation($input: DeleteCartLineItemInput!) {
    cart {
      deleteCartLineItem(input: $input) {
        cart {
          entityId
        }
      }
    }
  }
`);

type Variables = VariablesOf<typeof DeleteCartLineItemMutation>;
type DeleteCartLineItemInput = Variables['input'];

export async function removeItem({
  lineItemEntityId,
}: Omit<DeleteCartLineItemInput, 'cartEntityId'>) {
  const t = await getTranslations('Cart.Errors');

  const customerAccessToken = await getSessionCustomerAccessToken();

  const cartId = await getCartId();

  if (!cartId) {
    throw new Error(t('cartNotFound'));
  }

  if (!lineItemEntityId) {
    throw new Error(t('lineItemNotFound'));
  }

  // Free bundle items can't be removed on their own; removing the bundle removes them.
  if (await isBundleComponentLine(cartId, lineItemEntityId)) {
    throw new Error('Items that come with a bundle can only be removed by removing the bundle.');
  }

  const response = await client.fetch({
    document: DeleteCartLineItemMutation,
    variables: {
      input: {
        cartEntityId: cartId,
        lineItemEntityId,
      },
    },
    customerAccessToken,
    fetchOptions: { cache: 'no-store' },
  });

  const cart = response.data.cart.deleteCartLineItem?.cart;

  // If we remove the last item in a cart the cart is deleted
  // so we need to remove the cartId cookie
  // TODO: We need to figure out if it actually failed.
  if (!cart) {
    await clearCartId();
  } else {
    // If that was a bundle, remove the free items that came with it.
    await reconcileBundles(cartId);

    if (!(await getBundleRestCart(cartId))) {
      await clearCartId();
    }
  }

  revalidateTag(TAGS.cart, { expire: 0 });

  return cart;
}
