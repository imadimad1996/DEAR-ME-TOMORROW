export const Easing = {
  linear: (t: number): number => t,
  easeOutQuad: (t: number): number => 1 - (1 - t) * (1 - t),
  easeInOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};
