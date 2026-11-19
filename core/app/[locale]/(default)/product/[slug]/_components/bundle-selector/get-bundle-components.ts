import { cache } from 'react';
import { z } from 'zod';

import { client } from '~/client';
import { graphql } from '~/client/graphql';

export interface VariantOption {
  name: string;
  value: string;
}

export interface BundleComponent {
  /** `<productId>:<variantId or 0>`; also the value of the matching dropdown option. */
  key: string;
  productEntityId: number;
  variantEntityId?: number;
  /** Full label, for example "IVG Nic Salt E-Liquid - Blue Raspberry / 10mg". */
  label: string;
  productName: string;
  /** The variant's options, for example [{ name: 'Flavour', value: 'Blue Raspberry' }, { name: 'MG', value: '10mg' }]. */
  variantOptions: VariantOption[];
  mandatory: boolean;
  /** Units added per bundle (Bundle Buddy's minimum quantity). */
  quantity: number;
}

const VisibleProductsQuery = graphql(`
  query BundleVisibleProductsQuery($entityIds: [Int!]!) {
    site {
      products(entityIds: $entityIds, first: 50) {
        edges {
          node {
            entityId
          }
        }
      }
    }
  }
`);

/**
 * Bundle Buddy describes a variant as "Flavour : Blue Raspberry;;MG : 10mg" (the order of the options
 * varies, and some responses use " / " instead of ";;"). Keep the option values only, in a fixed order
 * (by option name), so the label reads "Blue Raspberry / 10mg" and no value is lost.
 */
export function parseVariantOptions(optionDetails: string | null | undefined): VariantOption[] {
  return (optionDetails ?? '')
    .replace(/^\s*\(|\)\s*$/g, '')
    .split(/\s*;;\s*|\s+\/\s+(?=[^:/;]+:)/)
    .map((part) => {
      const colon = part.indexOf(':');

      return colon < 0
        ? { name: '', value: part.trim() }
        : { name: part.slice(0, colon).trim(), value: part.slice(colon + 1).trim() };
    })
    .filter(({ value }) => value !== '')
    .sort((x, y) => x.name.localeCompare(y.name));
}

export function variantOptionValues(optionDetails: string | null | undefined): string | undefined {
  const values = parseVariantOptions(optionDetails).map(({ value }) => value);

  return values.length > 0 ? values.join(' / ') : undefined;
}

const detailSchema = z
  .object({
    product_id: z.number(),
    product_name: z.string(),
    is_mandatory: z.boolean().optional(),
    is_main_product: z.boolean().optional(),
    min_qty: z.number().nullable().optional(),
    is_variant: z.union([z.string(), z.boolean()]).optional(),
    destination_variant_id: z.union([z.string(), z.number()]).nullable().optional(),
    option_details: z.string().nullable().optional(),
  })
  .passthrough();

const responseSchema = z
  .object({ '0': z.object({ product_details: z.string() }).passthrough() })
  .passthrough();

/**
 * Components of a bundle, read from Bundle Buddy. Only products that are visible to this
 * storefront's channel are returned, because only those can be added to the cart.
 */
export const getBundleComponents = cache(
  async (bundleProductId: number): Promise<BundleComponent[]> => {
    const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
    const apiUrl =
      process.env.BUNDLE_APP_API_URL || 'https://bundling.arizonreports.cloud/bundle/v1/be';

    if (!storeHash) return [];

    const response = await fetch(
      `${apiUrl}/product-cart-validation?destination_product_id=${bundleProductId}&store=${storeHash}&store_hash=${storeHash}`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) return [];

    // The API pads its JSON with whitespace, so start at the first brace.
    const text = await response.text();
    const start = text.indexOf('{');

    if (start < 0) return [];

    const parsed = responseSchema.safeParse(JSON.parse(text.slice(start)));

    if (!parsed.success) return [];

    const details = z.array(detailSchema).safeParse(JSON.parse(parsed.data['0'].product_details));

    if (!details.success) return [];

    const components = details.data
      .filter((detail) => !detail.is_main_product && detail.product_id !== bundleProductId)
      .map<BundleComponent>((detail) => {
        const variantEntityId = Number(detail.destination_variant_id) || undefined;
        const isVariant = String(detail.is_variant) === 'true' && variantEntityId;
        const optionValue = variantOptionValues(detail.option_details);
        const variantOptions = isVariant ? parseVariantOptions(detail.option_details) : [];

        return {
          key: `${detail.product_id}:${isVariant ? variantEntityId : 0}`,
          productEntityId: detail.product_id,
          variantEntityId: isVariant ? variantEntityId : undefined,
          productName: detail.product_name,
          variantOptions,
          label:
            isVariant && optionValue
              ? `${detail.product_name} - ${optionValue}`
              : detail.product_name,
          mandatory: Boolean(detail.is_mandatory),
          quantity: detail.min_qty ?? 1,
        };
      });

    if (components.length === 0) return [];

    const { data } = await client.fetch({
      document: VisibleProductsQuery,
      variables: { entityIds: [...new Set(components.map((c) => c.productEntityId))] },
      fetchOptions: { next: { revalidate: 60 } },
    });

    const visibleIds = new Set((data.site.products.edges ?? []).map((edge) => edge.node.entityId));
    const hidden = components.filter((c) => !visibleIds.has(c.productEntityId));

    if (hidden.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `Bundle ${bundleProductId}: skipping components that aren't visible on this channel:`,
        [...new Set(hidden.map((c) => `${c.productEntityId} (${c.label})`))].join(', '),
      );
    }

    return components.filter((c) => visibleIds.has(c.productEntityId));
  },
);
