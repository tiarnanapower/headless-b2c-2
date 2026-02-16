import { ImageTextCustom, ImageTextCustomProps } from '@/vibes/soul/primitives/image-text-custom';

type MSImageTextCustomProps = Omit<ImageTextCustomProps, 'linkHref'> & {
  link?: { href?: string; target?: string };
};

export function MSImageTextCustom({ link, ...props }: MSImageTextCustomProps) {
  return <ImageTextCustom {...props} linkHref={link?.href ?? ''} />;
}
