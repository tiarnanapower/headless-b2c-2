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
  /**
   * Which variant option becomes the filter shown above the dropdowns (for example "MG", so the
   * shopper picks 10mg or 20mg once and every flavour dropdown only lists that strength).
   * Leave it out to detect it automatically, or set `false` to turn the filter off.
   */
  filterOption?: string | false;
  /** Label for the filter. Defaults to the option's own name (for example "MG"). */
  filterLabel?: string;
}

/** Name of the filter field in the product form. It is never sent to the cart as a product option. */
export const BUNDLE_FILTER_NAME = 'bundle-filter';

/** The text customisation that marks a product as a bundle (matched case-insensitively). */
export const BUNDLE_OPTION_NAME = /^\s*bundle\s*$/i;

/**
 * Optional second text customisation. Its default value is the number of dropdowns for this
 * bundle (for example 3). Missing, empty or invalid values fall back to the default.
 */
export const BUNDLE_OPTIONS_NAME = /^\s*bundle[_ ]options\s*$/i;

/** Upper limit on dropdowns, so a typo in BigCommerce can't create a huge form. */
export const MAX_BUNDLE_SLOTS = 10;

export function parseBundleSlots(text: string | null | undefined): number | undefined {
  const value = Number.parseInt((text ?? '').trim(), 10);

  if (!Number.isFinite(value) || value < 1) return undefined;

  return Math.min(value, MAX_BUNDLE_SLOTS);
}

/** Used for any bundle product that has no entry in `bundleOverrides`. */
export const defaultBundleConfig: BundleConfig = {
  slots: 2,
  slotLabel: 'Choose flavour',
};

/** Per-bundle settings, keyed by the bundle product's entity id. */
export const bundleOverrides: Record<number, Partial<BundleConfig>> = {
  // 1858: { slots: 3, slotLabel: 'Choose kit' },
};

/** Order of precedence for the number of dropdowns: Bundle_Options, then overrides, then default. */
export function getBundleConfig(productEntityId: number, slotsFromOption?: number): BundleConfig {
  return {
    ...defaultBundleConfig,
    ...bundleOverrides[productEntityId],
    ...(slotsFromOption ? { slots: slotsFromOption } : {}),
  };
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
