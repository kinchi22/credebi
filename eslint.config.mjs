import { createEslintConfig } from '@repo/config/eslint';
import { semanticColors, typeScale } from '@repo/ui/tokens';

export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['fixtures/**'],
  tokens: { colors: Object.keys(semanticColors), textSizes: Object.keys(typeScale) },
});
