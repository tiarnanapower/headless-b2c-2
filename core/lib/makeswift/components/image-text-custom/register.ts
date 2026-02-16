import {
  Checkbox,
  Color,
  Image,
  Link,
  Number,
  Select,
  Style,
  TextInput,
} from '@makeswift/runtime/controls';

import { runtime } from '~/lib/makeswift/runtime';

import { MSImageTextCustom } from './client';

runtime.registerComponent(MSImageTextCustom, {
  type: 'imageTextCustom',
  label: 'Basic / Image Text Custom',
  icon: 'image',
  props: {
    className: Style(),
    imageSrc: Image({ label: 'Image' }),
    imageAlt: TextInput({ label: 'Image alt', defaultValue: 'Image' }),
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
    overlayText: TextInput({ label: 'Overlay text', defaultValue: '' }),
    overlayTextColor: Color({ label: 'Text color', defaultValue: '#ffffff' }),
    overlayTextBackgroundColor: Color({
      label: 'Text background color',
      defaultValue: 'rgba(0, 0, 0, 0.45)',
    }),
    overlayTextSize: Select({
      label: 'Text size',
      options: [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' },
      ],
      defaultValue: 'medium',
    }),
    overlayTextWeight: Select({
      label: 'Text weight',
      options: [
        { value: 'normal', label: 'Normal' },
        { value: 'medium', label: 'Medium' },
        { value: 'semibold', label: 'Semibold' },
        { value: 'bold', label: 'Bold' },
      ],
      defaultValue: 'medium',
    }),
    overlayTextAlign: Select({
      label: 'Text alignment',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ],
      defaultValue: 'left',
    }),
    showGlassEffect: Checkbox({ label: 'Use glass effect', defaultValue: true }),
    glassBlur: Number({ label: 'Glass blur', defaultValue: 12, suffix: 'px' }),
    glassBorderColor: Color({
      label: 'Glass border color',
      defaultValue: 'rgba(255, 255, 255, 0.35)',
    }),
    glassBackgroundColor: Color({
      label: 'Glass background color',
      defaultValue: 'rgba(255, 255, 255, 0.16)',
    }),
    glassShadow: Select({
      label: 'Glass shadow',
      options: [
        { value: 'none', label: 'None' },
        { value: 'soft', label: 'Soft' },
        { value: 'medium', label: 'Medium' },
        { value: 'strong', label: 'Strong' },
      ],
      defaultValue: 'soft',
    }),
    glassPadding: Number({ label: 'Glass padding', defaultValue: 12, suffix: 'px' }),
    glassRadius: Number({ label: 'Glass radius', defaultValue: 12, suffix: 'px' }),
  },
});
