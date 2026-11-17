import { removeEdgesAndNodes } from '@bigcommerce/catalyst-client';
import { cache } from 'react';

import { client } from '~/client';
import { graphql } from '~/client/graphql';
import { revalidate } from '~/client/revalidate-target';
import { BUNDLE_OPTION_NAME, BundleConfig, getBundleConfig } from '~/lib/bundles';

const BundleProductQuery = graphql(`
  query BundleProductQuery($entityId: Int!) {
    site {
      product(entityId: $entityId) {
        entityId
        productOptions(first: 50) {
          edges {
            node {
              __typename
              entityId
              displayName
              ... on TextFieldOption {
                defaultText: defaultValue
              }
            }
          }
        }
      }
    }
  }
`);

export interface BundleInfo {
  config: BundleConfig;
  /** Entity id of the hidden "Bundle" text customisation. */
  textOptionEntityId: number;
  /** Its default text, still sent with the cart line so the line looks like it always did. */
  defaultText: string | null;
}

/**
 * Returns bundle settings when the product has a text customisation called "Bundle",
 * otherwise `null` (the product is a normal product).
 */
export const getBundleInfo = cache(async (productEntityId: number): Promise<BundleInfo | null> => {
  const { data } = await client.fetch({
    document: BundleProductQuery,
    variables: { entityId: productEntityId },
    fetchOptions: { next: { revalidate } },
  });

  if (!data.site.product) return null;

  const textOption = removeEdgesAndNodes(data.site.product.productOptions).find(
    (option) => option.__typename === 'TextFieldOption' && BUNDLE_OPTION_NAME.test(option.displayName),
  );

  if (!textOption || textOption.__typename !== 'TextFieldOption') return null;

  return {
    config: getBundleConfig(productEntityId),
    textOptionEntityId: textOption.entityId,
    defaultText: textOption.defaultText ?? null,
  };
});
