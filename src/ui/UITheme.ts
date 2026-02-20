import * as PIXI from 'pixi.js';

export const UITheme = {
  colors: {
    gold: 0xf4c542,
    deepTeal: 0x0f4c5c,
    cream: 0xf6f1e9,
    cyanGlow: 0x00e0ff,
    coral: 0xff6f61,
    panel: 0x1b2b3c,
  },
  text: {
    title: new PIXI.TextStyle({
      fontFamily: 'Georgia, serif',
      fontSize: 58,
      fill: 0xf6f1e9,
      fontWeight: '700',
      dropShadow: true,
      dropShadowDistance: 2,
      dropShadowBlur: 8,
      dropShadowColor: 0x0f4c5c,
    }),
    body: new PIXI.TextStyle({
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: 28,
      fill: 0xf6f1e9,
    }),
    small: new PIXI.TextStyle({
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: 22,
      fill: 0xf6f1e9,
    }),
  },
};
