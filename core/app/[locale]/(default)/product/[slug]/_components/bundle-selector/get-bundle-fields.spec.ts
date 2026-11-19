import { describe, expect, it } from 'vitest';

import { defaultBundleConfig } from '~/lib/bundles';

import type { BundleComponent } from './get-bundle-components';
import { findFilterOption, getBundleFields } from './get-bundle-fields';

const variant = (
  id: number,
  flavour: string,
  mg: string,
  extra: Partial<BundleComponent> = {},
): BundleComponent => ({
  key: `1860:${id}`,
  productEntityId: 1860,
  variantEntityId: id,
  label: `IVG Nic Salt E-Liquid - ${flavour} / ${mg}`,
  productName: 'IVG Nic Salt E-Liquid',
  variantOptions: [
    { name: 'Flavour', value: flavour },
    { name: 'MG', value: mg },
  ],
  mandatory: false,
  quantity: 1,
  ...extra,
});

const plain: BundleComponent = {
  key: '1900:0',
  productEntityId: 1900,
  label: 'Vaporjoy Nic Salt E-Liquid 10ml - Banana',
  productName: 'Vaporjoy Nic Salt E-Liquid 10ml - Banana',
  variantOptions: [],
  mandatory: false,
  quantity: 1,
};

const components = [
  variant(1, 'Cherry', '20mg'),
  variant(2, 'Cherry', '10mg'),
  variant(3, 'Cola Frost', '10mg'),
  variant(4, 'Cola Frost', '20mg'),
  variant(5, 'Lemon Blast', '10mg'),
  plain,
];

describe('findFilterOption', () => {
  it('picks the option with the fewest values (MG, not Flavour)', () => {
    expect(findFilterOption({}, components)).toBe('MG');
  });

  it('honours a configured option name regardless of case, and can be turned off', () => {
    expect(findFilterOption({ filterOption: 'mg' }, components)).toBe('MG');
    expect(findFilterOption({ filterOption: 'Colour' }, components)).toBeUndefined();
    expect(findFilterOption({ filterOption: false }, components)).toBeUndefined();
  });

  it('has no filter when variants only differ by one option', () => {
    const flavoursOnly = components.map((c) => ({
      ...c,
      variantOptions: c.variantOptions.filter((o) => o.name === 'Flavour'),
    }));

    expect(findFilterOption({}, flavoursOnly)).toBeUndefined();
  });
});

describe('getBundleFields', () => {
  it('puts the strength buttons first, then one filtered dropdown per slot', () => {
    const fields = getBundleFields({ ...defaultBundleConfig, slots: 3 }, components);

    expect(fields.map((f) => f.name)).toEqual([
      'bundle-filter',
      'bundle-slot-1',
      'bundle-slot-2',
      'bundle-slot-3',
    ]);
    expect(fields[0]).toMatchObject({
      type: 'button-radio-group',
      label: 'MG',
      defaultValue: '10mg',
      options: [
        { label: '10mg', value: '10mg' },
        { label: '20mg', value: '20mg' },
      ],
    });
  });

  it('lists only the chosen strength, without the strength in the label, and keeps plain products', () => {
    const slot = getBundleFields(defaultBundleConfig, components)[1];

    if (slot?.type !== 'select' || !slot.filteredBy) throw new Error('expected a filtered select');

    expect(slot.filteredBy.optionsByValue['10mg']).toEqual([
      { label: 'IVG Nic Salt E-Liquid - Cherry', value: '1860:2' },
      { label: 'IVG Nic Salt E-Liquid - Cola Frost', value: '1860:3' },
      { label: 'IVG Nic Salt E-Liquid - Lemon Blast', value: '1860:5' },
      { label: 'Vaporjoy Nic Salt E-Liquid 10ml - Banana', value: '1900:0' },
    ]);
    expect(slot.filteredBy.optionsByValue['20mg']?.map((o) => o.value)).toEqual([
      '1860:1',
      '1860:4',
      '1900:0',
    ]);
    // The unfiltered options of the field match the default (first) strength.
    expect(slot.options).toEqual(slot.filteredBy.optionsByValue['10mg']);
  });

  it('returns plain dropdowns with full labels when there is no filter', () => {
    const fields = getBundleFields({ ...defaultBundleConfig, filterOption: false }, components);

    expect(fields.map((f) => f.name)).toEqual(['bundle-slot-1', 'bundle-slot-2']);
    expect(fields[0]).toMatchObject({ type: 'select' });
    expect(fields[0]).not.toHaveProperty('filteredBy');
    expect(fields[0]).toHaveProperty('options.length', 6);
  });

  it('returns nothing when there are no optional components', () => {
    expect(getBundleFields(defaultBundleConfig, components.map((c) => ({ ...c, mandatory: true })))).toEqual([]);
  });
});
