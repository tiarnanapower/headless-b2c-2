import Script from 'next/script';

import { getCustomerGroupId } from '~/client/queries/get-customer';

import { BundleAppTrigger } from './trigger';

interface Props {
  productId: number;
  productName: string;
}

/**
 * Loads the third-party bundle app script on the product page.
 *
 * The original snippet was written for Stencil and relied on Handlebars values
 * (e.g. {{product.id}}). Catalyst doesn't render Handlebars, so the equivalent
 * values are filled in here on the server instead.
 *
 * Disabled unless BUNDLE_APP_ENABLED=true so it is easy to switch off while testing.
 */
export async function BundleAppScript({ productId, productName }: Props) {
  if (process.env.BUNDLE_APP_ENABLED !== 'true') {
    return null;
  }

  const scriptSrc =
    process.env.BUNDLE_APP_SCRIPT_URL ||
    'https://bundling.arizonreports.cloud/bundle/v1/fe/dist/main.js';

  let customerGroupId = '';

  try {
    const { data } = await getCustomerGroupId();

    customerGroupId = String(data.customer?.customerGroupId ?? '');
  } catch {
    // Guest shoppers or a failed lookup: fall back to an empty customer group.
  }

  // Not a data-* attribute in the original snippet, so spread it to keep TypeScript happy.
  const extraAttributes = { cart_type: process.env.BUNDLE_APP_CART_TYPE ?? '' };

  return (
    <>
      <BundleAppTrigger />
      <Script
        {...extraAttributes}
        data-cat=""
        data-customer={customerGroupId}
        data-hidden_token={process.env.BIGCOMMERCE_STOREFRONT_TOKEN ?? ''}
        data-page="product"
        data-product-id={productId}
        data-product-name={productName}
        data-site={process.env.BIGCOMMERCE_STORE_HASH ?? ''}
        id="bundle"
        src={scriptSrc}
        strategy="afterInteractive"
      />
    </>
  );
}
