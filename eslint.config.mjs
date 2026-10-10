import { createEslintConfig } from '@repo/config/eslint';
import { radii, semanticColors, shadows, typeScale } from '@repo/ui/tokens';

export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['fixtures/**'],
  tokens: {
    colors: Object.keys(semanticColors),
    textSizes: Object.keys(typeScale),
    shadows: Object.keys(shadows),
    radii: Object.keys(radii),
  },
});
