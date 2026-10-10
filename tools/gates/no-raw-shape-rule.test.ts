import { type Rule, RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import { repoPlugin } from '@repo/config/eslint';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const { rules } = repoPlugin as { readonly rules: Readonly<Record<string, Rule.RuleModule>> };
const rule = rules['no-raw-shape'];
if (rule === undefined) throw new Error('repo/no-raw-shape is not in the repository plugin');

const tokens = { radii: ['control', 'panel'] };

const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
});

const valid = (code: string): RuleTester.ValidTestCase => ({ code, options: [tokens] });

const invalid = (code: string, errors: readonly string[]): RuleTester.InvalidTestCase => ({
  code,
  options: [tokens],
  errors: errors.map((messageId) => ({ messageId })),
});

tester.run('repo/no-raw-shape', rule, {
  valid: [
    valid('const classes = "rounded-control wide:rounded-panel rounded-t-panel rounded-bl-control";'),
    valid('const classes = "rounded-full rounded-none before:rounded-control";'),
    valid('const classes = "shadow-lift wide:shadow-lift shadow-none";'),
    valid('const classes = "shadow-accent shadow-accent/25 inset-shadow-sm drop-shadow-md";'),
    valid('const copy = "Rounded corners cast a shadow";'),
    valid('const name = "declares each shadow in the colour of its tint";'),
    valid('const name = "keeps every corner rounded";'),
    valid('const classes = "ring-3 border-2 p-2";'),
  ],
  invalid: [
    invalid('const classes = "rounded";', ['nonTokenRadius']),
    invalid('const classes = "p-2 rounded-t";', ['nonTokenRadius']),
    invalid('const classes = "rounded-md";', ['nonTokenRadius']),
    invalid('const classes = "wide:rounded-bl-lg";', ['nonTokenRadius']),
    invalid('const classes = "rounded-[3px]";', ['nonTokenRadius']),
    invalid('const classes = "rounded-card";', ['nonTokenRadius']),
    invalid('const classes = "shadow";', ['nonTokenShadow']),
    invalid('const classes = "flex shadow p-2";', ['nonTokenShadow']),
    invalid('const classes = "wide:rounded border";', ['nonTokenRadius']),
    invalid('const classes = "shadow-sm";', ['nonTokenShadow']),
    invalid('const classes = "hover:shadow-2xl";', ['nonTokenShadow']),
    invalid('const classes = "shadow-inner";', ['nonTokenShadow']),
    invalid('const classes = "shadow-[0_1px_2px_black]";', ['nonTokenShadow']),
    invalid('const classes = `p-2 ${"x"} rounded-sm shadow-xs`;', ['nonTokenRadius', 'nonTokenShadow']),
  ],
});
