import { type Rule, RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import { repoPlugin } from '@repo/config/eslint';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const { rules } = repoPlugin as { readonly rules: Readonly<Record<string, Rule.RuleModule>> };
const rule = rules['no-raw-color'];
if (rule === undefined) throw new Error('repo/no-raw-color is not in the repository plugin');

const tokens = {
  colors: ['surface', 'text', 'text-on-dark', 'danger'],
  textSizes: ['h1', 'body'],
  shadows: ['lift'],
};

const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
});

const valid = (code: string): RuleTester.ValidTestCase => ({ code, options: [tokens] });

const invalid = (code: string, errors: readonly string[]): RuleTester.InvalidTestCase => ({
  code,
  options: [tokens],
  errors: errors.map((messageId) => ({ messageId })),
});

tester.run('repo/no-raw-color', rule, {
  valid: [
    valid('<a href="#add" />'),
    valid('<section id="#feed" />'),
    valid('const target = "#cafe";'),
    valid('const label = "Entry #1234";'),
    valid('const heading = "Entries #1234 to #5678";'),
    valid('const classes = "bg-surface text-text hover:text-danger text-h1 border-2 bg-transparent";'),
    valid('const classes = "text-2xl text-left border-dashed ring-offset-2 shadow-sm outline-none";'),
    valid('const classes = "bg-linear-to-r bg-clip-text fill-none divide-y border-x text-current";'),
    valid('const classes = "shadow-lift wide:shadow-lift";'),
    valid('const fill = "text-on-dark";'),
    valid('const copy = "Up to-date entries";'),
  ],
  invalid: [
    invalid('const brand = "#2FD0A2";', ['rawColor']),
    invalid('<span style={{ color: "#fff" }} />', ['rawColor']),
    invalid('<circle fill="#abc" />', ['rawColor']),
    invalid('const classes = "bg-[#fff]";', ['rawColor']),
    invalid('const css = "border: 1px solid #abc";', ['rawColor']),
    invalid('const shade = "rgb(0 0 0 / 0.5)";', ['rawColor']),
    invalid('const shade = "oklch(0.7 0.1 160)";', ['rawColor']),
    invalid('const shade = "color-mix(in srgb, red, blue)";', ['rawColor']),
    invalid('const classes = "text-red-700";', ['nonTokenClass']),
    invalid('const classes = "hover:bg-white/50";', ['nonTokenClass']),
    invalid('const classes = "bg-mint";', ['nonTokenClass']),
    invalid('const classes = "text-foo";', ['nonTokenClass']),
    invalid('const classes = "shadow-foo";', ['nonTokenClass']),
    invalid('const classes = "text-lift";', ['nonTokenClass']),
    invalid('const classes = "!border-ink";', ['nonTokenClass']),
    invalid('const classes = `p-2 ${"x"} ring-emerald-500`;', ['nonTokenClass']),
  ],
});
