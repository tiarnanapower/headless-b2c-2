import { clsx } from 'clsx';

import { Image } from '~/components/image';
import { Link } from '~/components/link';

type TextSize = 'small' | 'medium' | 'large';
type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';
type TextAlign = 'left' | 'center' | 'right';
type AspectRatio = '5:6' | '3:4' | '1:1';
type GlassShadow = 'none' | 'soft' | 'medium' | 'strong';

export interface ImageTextCustomProps {
  className?: string;
  imageSrc?: string;
  imageAlt: string;
  linkHref?: string;
  aspectRatio?: AspectRatio;
  overlayText?: string;
  overlayTextColor?: string;
  overlayTextBackgroundColor?: string;
  overlayTextSize?: TextSize;
  overlayTextWeight?: TextWeight;
  overlayTextAlign?: TextAlign;
  showGlassEffect?: boolean;
  glassBlur?: number;
  glassBorderColor?: string;
  glassBackgroundColor?: string;
  glassShadow?: GlassShadow;
  glassPadding?: number;
  glassRadius?: number;
}

export function ImageTextCustom({
  className,
  imageSrc,
  imageAlt,
  linkHref = '',
  aspectRatio = '5:6',
  overlayText,
  overlayTextColor = '#ffffff',
  overlayTextBackgroundColor = 'rgba(0, 0, 0, 0.45)',
  overlayTextSize = 'medium',
  overlayTextWeight = 'medium',
  overlayTextAlign = 'left',
  showGlassEffect = true,
  glassBlur = 12,
  glassBorderColor = 'rgba(255, 255, 255, 0.35)',
  glassBackgroundColor = 'rgba(255, 255, 255, 0.16)',
  glassShadow = 'soft',
  glassPadding = 12,
  glassRadius = 12,
}: ImageTextCustomProps) {
  return (
    <article className={clsx('group relative w-full max-w-md @container', className)}>
      <div
        className={clsx('relative overflow-hidden rounded-xl', {
          'aspect-[5/6]': aspectRatio === '5:6',
          'aspect-[3/4]': aspectRatio === '3:4',
          'aspect-square': aspectRatio === '1:1',
        })}
      >
        {imageSrc != null && imageSrc !== '' ? (
          <Image
            alt={imageAlt}
            className="h-full w-full object-cover"
            fill
            sizes="(min-width: 42rem) 25vw, (min-width: 32rem) 33vw, (min-width: 28rem) 50vw, 100vw"
            src={imageSrc}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-contrast-100 text-sm text-contrast-500">
            No image selected
          </div>
        )}

        {overlayText != null && overlayText !== '' && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 @xs:p-5">
            <div
              style={{
                backgroundColor: showGlassEffect ? glassBackgroundColor : overlayTextBackgroundColor,
                border: showGlassEffect ? `1px solid ${glassBorderColor}` : undefined,
                borderRadius: `${glassRadius}px`,
                boxShadow: {
                  none: 'none',
                  soft: '0 8px 24px rgba(0, 0, 0, 0.18)',
                  medium: '0 10px 28px rgba(0, 0, 0, 0.24)',
                  strong: '0 14px 36px rgba(0, 0, 0, 0.32)',
                }[glassShadow],
                padding: `${glassPadding}px`,
                backdropFilter: showGlassEffect ? `blur(${glassBlur}px)` : undefined,
                WebkitBackdropFilter: showGlassEffect ? `blur(${glassBlur}px)` : undefined,
              }}
            >
              <p
                className={clsx(
                  'line-clamp-3 leading-tight',
                  {
                    small: 'text-sm',
                    medium: 'text-base',
                    large: 'text-lg',
                  }[overlayTextSize],
                  {
                    normal: 'font-normal',
                    medium: 'font-medium',
                    semibold: 'font-semibold',
                    bold: 'font-bold',
                  }[overlayTextWeight],
                  {
                    left: 'text-left',
                    center: 'text-center',
                    right: 'text-right',
                  }[overlayTextAlign],
                )}
                style={{ color: overlayTextColor }}
              >
                {overlayText}
              </p>
            </div>
          </div>
        )}
      </div>

      <Link
        className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
        href={linkHref}
      >
        <span className="sr-only">Open image card</span>
      </Link>
    </article>
  );
}
