import { getCartId } from '~/lib/cart';
import { addComplimentaryLineItems } from '~/lib/cart/add-complimentary-line-items';
import {
  BundleGroup,
  BundleGroupComponent,
  BundleRestLineItem,
  getBundleRestCart,
  readBundleGroups,
  removeLines,
  writeBundleGroups,
} from '~/lib/bundles-cart';

import { BundleComponent, getBundleComponents } from './get-bundle-components';

interface Params {
  productEntityId: number;
  quantity: number;
  /** The random id that was sent in the bundle line's hidden "Bundle" text. */
  instanceId: string;
  /** Component keys chosen in the dropdowns. */
  chosenKeys: string[];
}

/**
 * Called right after the bundle product is in the cart. Adds the mandatory and chosen components
 * as free lines and records which lines belong together. If anything fails the bundle and its
 * components are taken back out, so the cart never keeps free items without a bundle.
 */
export async function addBundleComponents({
  productEntityId,
  quantity,
  instanceId,
  chosenKeys,
}: Params) {
  const cartId = await getCartId();

  if (!cartId) throw new Error('We could not find your cart. Please try again.');

  const before = await getBundleRestCart(cartId);
  const bundleLine = before?.line_items.physical_items.find(
    (line) =>
      line.product_id === productEntityId &&
      line.options?.some((option) => String(option.value) === instanceId),
  );

  if (!before || !bundleLine) {
    throw new Error('We could not add the bundle to your cart. Please try again.');
  }

  try {
    // Read the components on the server rather than trusting what the browser sent.
    const components = await getBundleComponents(productEntityId);
    const optional = new Map(
      components.filter((component) => !component.mandatory).map((c) => [c.key, c]),
    );
    const units = new Map<string, { component: BundleComponent; units: number }>();

    const add = (component: BundleComponent) => {
      const existing = units.get(component.key);

      units.set(component.key, {
        component,
        units: (existing?.units ?? 0) + component.quantity * quantity,
      });
    };

    components.filter((component) => component.mandatory).forEach(add);
    chosenKeys.forEach((key) => {
      const component = optional.get(key);

      if (component) add(component);
    });

    if (units.size === 0) return;

    const after = await addComplimentaryLineItems(
      cartId,
      [...units.values()].map(({ component, units: count }) => ({
        productEntityId: component.productEntityId,
        variantEntityId: component.variantEntityId,
        quantity: count,
      })),
    );

    const claimed = new Set<string>([bundleLine.id]);
    const findLine = (component: BundleComponent): BundleRestLineItem | undefined => {
      const matches = after.line_items.physical_items.filter(
        (line) =>
          !claimed.has(line.id) &&
          line.product_id === component.productEntityId &&
          (!component.variantEntityId || line.variant_id === component.variantEntityId),
      );

      return matches.find((line) => line.list_price === 0) ?? matches[0];
    };

    const groupComponents: BundleGroupComponent[] = [];

    [...units.values()].forEach(({ component, units: count }) => {
      const line = findLine(component);

      if (!line) throw new Error('A bundle item could not be found in the cart.');

      claimed.add(line.id);
      groupComponents.push({
        lineId: line.id,
        perBundle: Math.max(1, Math.round(count / quantity)),
        label: component.label,
      });
    });

    const { groups, metafieldId } = await readBundleGroups(cartId);
    const group: BundleGroup = {
      instanceId,
      bundleLineId: bundleLine.id,
      components: groupComponents,
    };

    await writeBundleGroups(cartId, [...groups, group], metafieldId);
  } catch (error) {
    // Roll back: take out the bundle and any component lines that weren't in the cart before.
    try {
      const current = await getBundleRestCart(cartId);
      const existing = new Set(before.line_items.physical_items.map((line) => line.id));
      const added =
        current?.line_items.physical_items
          .filter((line) => !existing.has(line.id) || line.id === bundleLine.id)
          .map((line) => line.id) ?? [];

      await removeLines(cartId, added);
    } catch (rollbackError) {
      // eslint-disable-next-line no-console
      console.error('Rolling back the bundle failed', rollbackError);
    }

    throw error;
  }
}
