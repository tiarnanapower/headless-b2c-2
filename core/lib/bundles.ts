/**
 * Native "pick your components" bundles, driven by Bundle Buddy.
 *
 * A product becomes a bundle when it has a text customisation (modifier) called "Bundle". The
 * product keeps its own price and gets N dropdowns on the product page, the "Bundle" text field
 * is hidden, and the choices come from the bundle's components in Bundle Buddy: optional
 * components fill the dropdowns, mandatory components are added automatically. Every component
 * is added to the cart as a 0-price line item so stock is still decremented per product/variant.
 *
 * Manage the flavours in Bundle Buddy. Settings here only control the dropdowns themselves.
 */
export interface BundleConfig {
  /** How many dropdowns to show (e.g. "Choose flavour 1", "Choose flavour 2"). */
  slots: number;
  /** Label prefix for each dropdown; the slot number is appended. */
  slotLabel: string;
}

/** The text customisation that marks a product as a bundle (matched case-insensitively). */
export const BUNDLE_OPTION_NAME = /^\s*bundle\s*$/i;

/** Used for any bundle product that has no entry in `bundleOverrides`. */
export const defaultBundleConfig: BundleConfig = {
  slots: 2,
  slotLabel: 'Choose flavour',
};

/** Per-bundle settings, keyed by the bundle product's entity id. */
export const bundleOverrides: Record<number, Partial<BundleConfig>> = {
  // 1858: { slots: 3, slotLabel: 'Choose kit' },
};

export function getBundleConfig(productEntityId: number): BundleConfig {
  return { ...defaultBundleConfig, ...bundleOverrides[productEntityId] };
}

/** Bundle dropdown names look like `bundle-slot-<slotNumber>`. */
export const BUNDLE_SLOT_PREFIX = 'bundle-slot-';

export function bundleSlotName(slot: number) {
  return `${BUNDLE_SLOT_PREFIX}${slot}`;
}

export function parseBundleSlotName(name: string) {
  const match = /^bundle-slot-(\d+)$/.exec(name);

  if (!match) return null;

  return { slot: Number(match[1]) };
}
