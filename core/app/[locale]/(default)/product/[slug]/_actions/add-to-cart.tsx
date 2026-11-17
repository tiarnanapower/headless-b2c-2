'use server';

import { BigCommerceGQLError } from '@bigcommerce/catalyst-client';
import { SubmissionResult } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod';
import { getTranslations } from 'next-intl/server';
import { ReactNode } from 'react';

import { Field, schema } from '@/vibes/soul/sections/product-detail/schema';
import { graphql } from '~/client/graphql';
import { Link } from '~/components/link';
import { BUNDLE_SLOT_PREFIX, parseBundleSlotName } from '~/lib/bundles';
import { addToOrCreateCart, getCartId } from '~/lib/cart';
import { addComplimentaryLineItems } from '~/lib/cart/add-complimentary-line-items';
import { MissingCartError } from '~/lib/cart/error';

import { BundleComponent, getBundleComponents } from '../_components/bundle-selector/get-bundle-components';
import { getBundleInfo } from '../_components/bundle-selector/get-bundle-info';

type CartSelectedOptionsInput = ReturnType<typeof graphql.scalar<'CartSelectedOptionsInput'>>;

interface State {
  fields: Field[];
  lastResult: SubmissionResult | null;
  successMessage?: ReactNode;
}

export const addToCart = async (
  prevState: State,
  payload: FormData,
): Promise<{
  fields: Field[];
  lastResult: SubmissionResult | null;
  successMessage?: ReactNode;
}> => {
  const t = await getTranslations('Product.ProductDetails');

  const submission = parseWithZod(payload, { schema: schema(prevState.fields) });

  if (submission.status !== 'success') {
    return { lastResult: submission.reply(), fields: prevState.fields };
  }

  const productEntityId = Number(submission.value.id);
  const quantity = Number(submission.value.quantity);

  const bundleInfo = await getBundleInfo(productEntityId);

  const fieldOptions = prevState.fields.reduce<CartSelectedOptionsInput>((accum, field) => {
    // Bundle dropdowns aren't product options; they're handled after the bundle itself is added.
    if (field.name.startsWith(BUNDLE_SLOT_PREFIX)) return accum;

    const optionValueEntityId = submission.value[field.name];

    let multipleChoicesOptionInput;
    let checkboxOptionInput;
    let numberFieldOptionInput;
    let textFieldOptionInput;
    let multiLineTextFieldOptionInput;
    let dateFieldOptionInput;

    // Skip empty strings since option is empty
    if (!optionValueEntityId) return accum;

    switch (field.type) {
      case 'select':
      case 'radio-group':
      case 'swatch-radio-group':
      case 'card-radio-group':
      case 'button-radio-group':
        multipleChoicesOptionInput = {
          optionEntityId: Number(field.name),
          optionValueEntityId: Number(optionValueEntityId),
        };

        if (accum.multipleChoices) {
          return {
            ...accum,
            multipleChoices: [...accum.multipleChoices, multipleChoicesOptionInput],
          };
        }

        return { ...accum, multipleChoices: [multipleChoicesOptionInput] };

      case 'checkbox':
        checkboxOptionInput = {
          optionEntityId: Number(field.name),
          optionValueEntityId:
            optionValueEntityId === 'true'
              ? Number(field.checkedValue)
              : Number(field.uncheckedValue),
        };

        if (accum.checkboxes) {
          return { ...accum, checkboxes: [...accum.checkboxes, checkboxOptionInput] };
        }

        return { ...accum, checkboxes: [checkboxOptionInput] };

      case 'number':
        numberFieldOptionInput = {
          optionEntityId: Number(field.name),
          number: Number(optionValueEntityId),
        };

        if (accum.numberFields) {
          return { ...accum, numberFields: [...accum.numberFields, numberFieldOptionInput] };
        }

        return { ...accum, numberFields: [numberFieldOptionInput] };

      case 'text':
        textFieldOptionInput = {
          optionEntityId: Number(field.name),
          text: String(optionValueEntityId),
        };

        if (accum.textFields) {
          return {
            ...accum,
            textFields: [...accum.textFields, textFieldOptionInput],
          };
        }

        return { ...accum, textFields: [textFieldOptionInput] };

      case 'textarea':
        multiLineTextFieldOptionInput = {
          optionEntityId: Number(field.name),
          text: String(optionValueEntityId),
        };

        if (accum.multiLineTextFields) {
          return {
            ...accum,
            multiLineTextFields: [...accum.multiLineTextFields, multiLineTextFieldOptionInput],
          };
        }

        return { ...accum, multiLineTextFields: [multiLineTextFieldOptionInput] };

      case 'date':
        dateFieldOptionInput = {
          optionEntityId: Number(field.name),
          date: new Date(String(optionValueEntityId)).toISOString(),
        };

        if (accum.dateFields) {
          return {
            ...accum,
            dateFields: [...accum.dateFields, dateFieldOptionInput],
          };
        }

        return { ...accum, dateFields: [dateFieldOptionInput] };

      default:
        return { ...accum };
    }
  }, {});

  // The hidden "Bundle" text customisation isn't a form field, so send its default text ourselves.
  const selectedOptions: CartSelectedOptionsInput =
    bundleInfo?.defaultText
      ? {
          ...fieldOptions,
          textFields: [
            ...(fieldOptions.textFields ?? []),
            { optionEntityId: bundleInfo.textOptionEntityId, text: bundleInfo.defaultText },
          ],
        }
      : fieldOptions;

  try {
    await addToOrCreateCart({
      lineItems: [
        {
          productEntityId,
          selectedOptions,
          quantity,
        },
      ],
    });

    if (bundleInfo) {
      // Re-read the components on the server rather than trusting what the browser sent.
      const components = await getBundleComponents(productEntityId);
      const optional = new Map(
        components.filter((component) => !component.mandatory).map((c) => [c.key, c]),
      );
      const lines = new Map<string, { component: BundleComponent; quantity: number }>();

      const addLine = (component: BundleComponent, units: number) => {
        const existing = lines.get(component.key);

        lines.set(component.key, { component, quantity: (existing?.quantity ?? 0) + units });
      };

      // Mandatory components always come with the bundle.
      components
        .filter((component) => component.mandatory)
        .forEach((component) => addLine(component, component.quantity * quantity));

      prevState.fields.forEach((field) => {
        if (!parseBundleSlotName(field.name)) return;

        const component = optional.get(String(submission.value[field.name]));

        if (component) addLine(component, component.quantity * quantity);
      });

      const cartId = await getCartId();

      if (cartId && lines.size > 0) {
        await addComplimentaryLineItems(
          cartId,
          [...lines.values()].map(({ component, quantity: units }) => ({
            productEntityId: component.productEntityId,
            variantEntityId: component.variantEntityId,
            quantity: units,
          })),
        );
      }
    }

    return {
      lastResult: submission.reply(),
      fields: prevState.fields,
      successMessage: t.rich('successMessage', {
        cartItems: quantity,
        cartLink: (chunks) => (
          <Link className="underline" href="/cart" prefetch="viewport" prefetchKind="full">
            {chunks}
          </Link>
        ),
      }),
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);

    if (error instanceof BigCommerceGQLError) {
      return {
        lastResult: submission.reply({
          formErrors: error.errors.map(({ message }) => {
            if (message.includes('Not enough stock:')) {
              // This removes the item id from the message. It's very brittle, but it's the only
              // solution to do it until our API returns a better error message.
              return message.replace('Not enough stock: ', '').replace(/\(\w.+\)\s{1}/, '');
            }

            return message;
          }),
        }),
        fields: prevState.fields,
      };
    }

    if (error instanceof MissingCartError) {
      return {
        lastResult: submission.reply({ formErrors: [t('missingCart')] }),
        fields: prevState.fields,
      };
    }

    if (error instanceof Error) {
      return {
        lastResult: submission.reply({ formErrors: [error.message] }),
        fields: prevState.fields,
      };
    }

    return {
      lastResult: submission.reply({ formErrors: [t('unknownError')] }),
      fields: prevState.fields,
    };
  }
};
