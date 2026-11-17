'use client';

import { useEffect } from 'react';

/**
 * The bundle app was built for Stencil, where it opens its popup from the theme's
 * `#form-action-addToCart` button. Catalyst's button has no such id, so open the popup
 * ourselves when the shopper clicks "Add to cart" on a product the app has built a popup for.
 * Products without a bundle popup keep the normal add-to-cart behaviour.
 */
export function BundleAppTrigger() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const popup = document.querySelector<HTMLElement>('.popup_bundle');

      if (!popup || !(event.target instanceof Element)) {
        return;
      }

      const button = event.target.closest<HTMLButtonElement>('button[type="submit"]');

      if (!button || button.closest('.popup_bundle')) {
        return;
      }

      if (!/add to cart/i.test(button.textContent ?? '')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      popup.style.display = 'block';
    };

    // Capture phase so we run before the product form submits.
    document.addEventListener('click', onClick, true);

    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
