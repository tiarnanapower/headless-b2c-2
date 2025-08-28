'use client';

import { Banner } from '@/vibes/soul/primitives/banner';
import clsx from 'clsx';

type MSBannerProps = {
  className?: string;
  bannerText?: string;
  id?: string;
  textSize: 'small' | 'medium' | 'large' | 'x-large';
};

export function MSBanner({ className, bannerText, id = 'bannerTest', textSize }: MSBannerProps) {
  return (
    <>
      <Banner
        id={id}
        className={clsx(
          'group font-[family-name:var(--card-font-family,var(--font-family-body))] @container',
          {
            'text-sm': textSize === 'small',
            'text-base': textSize === 'medium',
            'text-lg': textSize === 'large',
            'text-xl': textSize === 'x-large',
          },
          className,
        )}
      >
        <span
          className={clsx('font-medium', {
            'text-sm': textSize === 'small',
            'text-base': textSize === 'medium',
            'text-lg': textSize === 'large',
            'text-xl': textSize === 'x-large',
          })}
        >
          {bannerText}
        </span>
      </Banner>
    </>
  );
}
