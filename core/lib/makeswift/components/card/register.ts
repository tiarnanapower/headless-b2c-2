import { Checkbox, Color, Image, Link, Select, Style, TextInput } from '@makeswift/runtime/controls';

import { runtime } from '~/lib/makeswift/runtime';

import { MSCard } from './client';

runtime.registerComponent(MSCard, {
  type: 'primitive-card',
  label: 'Basic / Card',
  icon: 'layout',
  props: {
    className: Style(),
    title: TextInput({ label: 'Title', defaultValue: 'Card' }),
    imageSrc: Image({ label: 'Image' }),
    imageAlt: TextInput({ label: 'Image alt', defaultValue: 'Card image' }),
    imageOverlayText: TextInput({ label: 'Image overlay text', defaultValue: '' }),
    imageOverlayTextColor: Color({ label: 'Image overlay text color', defaultValue: '#ffffff' }),
    imageOverlayBackgroundColor: Color({
      label: 'Image overlay background color',
      defaultValue: 'rgba(0, 0, 0, 0.45)',
    }),
    imageOverlayTextSize: Select({
      label: 'Image overlay text size',
      options: [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' },
      ],
      defaultValue: 'medium',
    }),
    imageOverlayTextWeight: Select({
      label: 'Image overlay text weight',
      options: [
        { value: 'normal', label: 'Normal' },
        { value: 'medium', label: 'Medium' },
        { value: 'semibold', label: 'Semibold' },
        { value: 'bold', label: 'Bold' },
      ],
      defaultValue: 'medium',
    }),
    link: Link({ label: 'Link' }),
    aspectRatio: Select({
      label: 'Aspect ratio',
      options: [
        { value: '5:6', label: '5:6' },
        { value: '3:4', label: '3:4' },
        { value: '1:1', label: 'Square' },
      ],
      defaultValue: '5:6',
    }),
    textColorScheme: Select({
      label: 'Text color scheme',
      options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ],
      defaultValue: 'light',
    }),
    iconColorScheme: Select({
      label: 'Icon color scheme',
      options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ],
      defaultValue: 'light',
    }),
    textPosition: Select({
      label: 'Text position',
      options: [
        { value: 'inside', label: 'Inside' },
        { value: 'outside', label: 'Outside' },
      ],
      defaultValue: 'outside',
    }),
    textSize: Select({
      label: 'Text size',
      options: [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' },
        { value: 'x-large', label: 'X-Large' },
      ],
      defaultValue: 'small',
    }),
    showOverlay: Checkbox({ label: 'Show overlay', defaultValue: true }),
  },
});
