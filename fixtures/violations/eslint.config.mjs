import { createEslintConfig } from '@repo/config/eslint';
import { semanticColors, shadows, typeScale } from '@repo/ui/tokens';

export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  tokens: {
    colors: Object.keys(semanticColors),
    textSizes: Object.keys(typeScale),
    shadows: Object.keys(shadows),
  },
});
