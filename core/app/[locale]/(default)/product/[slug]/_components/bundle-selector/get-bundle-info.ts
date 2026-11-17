import { removeEdgesAndNodes } from '@bigcommerce/catalyst-client';
import { cache } from 'react';

import { client } from '~/client';
import { graphql } from '~/client/graphql';
import { revalidate } from '~/client/revalidate-target';
import {
  BUNDLE_OPTION_NAME,
  BUNDLE_OPTIONS_NAME,
  BundleConfig,
  getBundleConfig,
  parseBundleSlots,
} from '~/lib/bundles';

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

export interface HiddenTextOption {
  entityId: number;
  /** Default text set in BigCommerce, if any. */
  defaultText: string | null;
}

export interface BundleInfo {
  config: BundleConfig;
  /** The "Bundle" text customisation that marks the product as a bundle. */
  bundleOption: HiddenTextOption;
  /** The optional "Bundle_Options" text customisation (number of dropdowns). */
  optionsOption: HiddenTextOption | null;
  /** Entity ids of customisations to hide from shoppers. */
  hiddenOptionEntityIds: number[];
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

  const textOptions = removeEdgesAndNodes(data.site.product.productOptions).flatMap((option) =>
    option.__typename === 'TextFieldOption'
      ? [
          {
            name: option.displayName,
            entityId: option.entityId,
            defaultText: option.defaultText ?? null,
          },
        ]
      : [],
  );

  const bundle = textOptions.find((option) => BUNDLE_OPTION_NAME.test(option.name));

  if (!bundle) return null;

  const options = textOptions.find((option) => BUNDLE_OPTIONS_NAME.test(option.name));

  return {
    config: getBundleConfig(productEntityId, parseBundleSlots(options?.defaultText)),
    bundleOption: { entityId: bundle.entityId, defaultText: bundle.defaultText },
    optionsOption: options
      ? { entityId: options.entityId, defaultText: options.defaultText }
      : null,
    hiddenOptionEntityIds: [bundle.entityId, ...(options ? [options.entityId] : [])],
  };
});
