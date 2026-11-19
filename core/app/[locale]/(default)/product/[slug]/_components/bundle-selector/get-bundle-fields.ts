import { Field } from '@/vibes/soul/sections/product-detail/schema';
import { BUNDLE_FILTER_NAME, BundleConfig, bundleSlotName } from '~/lib/bundles';

import type { BundleComponent } from './get-bundle-components';

interface Option {
  label: string;
  value: string;
}

/** A filter with more values than this is probably not a "strength"-style choice, so skip it. */
const MAX_FILTER_VALUES = 6;

const compare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/**
 * Picks the variant option to use as the filter above the dropdowns (for example "MG").
 *
 * - `config.filterOption` set: use that option (matched ignoring case), if it has 2 or more values.
 * - `config.filterOption === false`: no filter.
 * - otherwise: the option with the fewest values (2 to 6), as long as the variants have another
 *   option to choose from. A bundle whose variants only differ by flavour gets no filter.
 */
export function findFilterOption(
  config: Pick<BundleConfig, 'filterOption'>,
  components: BundleComponent[],
): string | undefined {
  if (config.filterOption === false) return undefined;

  const valuesByName = new Map<string, Set<string>>();

  components.forEach((component) => {
    component.variantOptions.forEach(({ name, value }) => {
      if (!name) return;

      valuesByName.set(name, (valuesByName.get(name) ?? new Set<string>()).add(value));
    });
  });

  if (config.filterOption) {
    const wanted = config.filterOption.trim().toLowerCase();
    const name = [...valuesByName.keys()].find((key) => key.toLowerCase() === wanted);

    return name && (valuesByName.get(name)?.size ?? 0) >= 2 ? name : undefined;
  }

  if (valuesByName.size < 2) return undefined;

  return [...valuesByName]
    .filter(([, values]) => values.size >= 2 && values.size <= MAX_FILTER_VALUES)
    .sort(([, a], [, b]) => a.size - b.size)[0]?.[0];
}

/** Label without the filter option, for example "IVG Nic Salt E-Liquid - Blue Raspberry". */
function labelWithout(component: BundleComponent, optionName: string) {
  const values = component.variantOptions
    .filter(({ name }) => name !== optionName)
    .map(({ value }) => value);

  return values.length > 0
    ? `${component.productName} - ${values.join(' / ')}`
    : component.productName;
}

/**
 * Extra product-form fields. The dropdown options are the bundle's optional components from Bundle
 * Buddy, one dropdown per slot. When the variants share an option such as MG, a required filter
 * dropdown (10mg, 20mg) comes first. The flavour dropdowns stay disabled until a value is chosen,
 * then only list the variants for it.
 */
export function getBundleFields(config: BundleConfig, components: BundleComponent[]): Field[] {
  const optional = components.filter((component) => !component.mandatory);

  if (optional.length === 0) return [];

  const allOptions: Option[] = optional.map((component) => ({
    label: component.label,
    value: component.key,
  }));

  const slots = (
    options: Option[],
    filteredBy?: Extract<Field, { type: 'select' }>['filteredBy'],
  ) =>
    Array.from({ length: config.slots }, (_, index) => ({
      type: 'select' as const,
      name: bundleSlotName(index + 1),
      label: `${config.slotLabel} ${index + 1}`,
      required: true,
      options,
      ...(filteredBy ? { filteredBy } : {}),
    }));

  const filterName = findFilterOption(config, optional);

  if (!filterName) return slots(allOptions);

  const filterValueOf = (component: BundleComponent) =>
    component.variantOptions.find(({ name }) => name === filterName)?.value;

  const filterValues = [
    ...new Set(optional.map(filterValueOf).filter((value): value is string => Boolean(value))),
  ].sort(compare);

  // Variants without the filter option (for example a plain product) are listed for every value.
  const optionsByValue = Object.fromEntries(
    filterValues.map((filterValue) => [
      filterValue,
      optional
        .filter((component) => {
          const value = filterValueOf(component);

          return !value || value === filterValue;
        })
        .map((component) => ({
          label: labelWithout(component, filterName),
          value: component.key,
        }))
        .sort((a, b) => compare(a.label, b.label)),
    ]),
  );

  const filterLabel = config.filterLabel ?? filterName;

  return [
    {
      type: 'select' as const,
      name: BUNDLE_FILTER_NAME,
      label: filterLabel,
      required: true,
      options: filterValues.map((value) => ({ label: value, value })),
    },
    ...slots([], {
      field: BUNDLE_FILTER_NAME,
      placeholder: `Choose ${filterLabel} first`,
      optionsByValue,
    }),
  ];
}
