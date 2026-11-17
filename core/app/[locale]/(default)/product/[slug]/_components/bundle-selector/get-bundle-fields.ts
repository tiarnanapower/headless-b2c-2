import { Field } from '@/vibes/soul/sections/product-detail/schema';
import { BundleConfig, bundleSlotName } from '~/lib/bundles';

import { BundleComponent } from './get-bundle-components';

/**
 * Extra product-form fields (one dropdown per bundle slot). The dropdown options are the
 * bundle's optional components from Bundle Buddy.
 */
export function getBundleFields(config: BundleConfig, components: BundleComponent[]): Field[] {
  const options = components
    .filter((component) => !component.mandatory)
    .map((component) => ({ label: component.label, value: component.key }));

  if (options.length === 0) return [];

  return Array.from({ length: config.slots }, (_, index) => ({
    type: 'select' as const,
    name: bundleSlotName(index + 1),
    label: `${config.slotLabel} ${index + 1}`,
    required: true,
    options,
  }));
}
