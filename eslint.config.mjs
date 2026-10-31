import { createEslintConfig } from '@repo/config/eslint';
import { radii, semanticColors, shadows, textSizeTokens, typeScale } from '@repo/ui/tokens';

export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['fixtures/**', '.claude/worktrees/**', '.agents/worktrees/**'],
  tokens: {
    colors: Object.keys(semanticColors),
    textSizes: [...Object.keys(typeScale), ...Object.keys(textSizeTokens)],
    shadows: Object.keys(shadows),
    radii: Object.keys(radii),
  },
});
