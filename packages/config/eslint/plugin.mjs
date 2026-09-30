// eslint-disable-next-line no-control-regex -- naming the control range is how the rule defines ASCII
const NON_ASCII = /[^\x00-\x7F]/gu;

const noNonAscii = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow non-ASCII characters in source files. Copy belongs in a message catalogue.',
    },
    schema: [],
    messages: {
      nonAscii:
        'Non-ASCII character {{display}} (U+{{code}}) is not allowed in source. ' +
        'Source is English-only; user-facing copy belongs in a message catalogue. ' +
        'A non-English catalogue needs its exact path added to the ignores of the ' +
        'repo/english-only block in packages/config/eslint/base.mjs.',
    },
  },
  create(context) {
    return {
      Program() {
        const sourceCode = context.sourceCode;
        const text = sourceCode.getText();

        NON_ASCII.lastIndex = 0;
        let match = NON_ASCII.exec(text);
        while (match !== null) {
          const character = match[0];
          const codePoint = character.codePointAt(0) ?? 0;
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(match.index),
              end: sourceCode.getLocFromIndex(match.index + character.length),
            },
            messageId: 'nonAscii',
            data: {
              display: JSON.stringify(character),
              code: codePoint.toString(16).toUpperCase().padStart(4, '0'),
            },
          });
          match = NON_ASCII.exec(text);
        }
      },
    };
  },
};

const LETTER = /\p{L}/u;

const isBlank = (text) => text.trim() === '';

const MARKUP_ATTRIBUTES = new Set([
  'aria-current',
  'aria-hidden',
  'aria-labelledby',
  'className',
  'dateTime',
  'href',
  'htmlFor',
  'id',
  'inputMode',
  'key',
  'lang',
  'method',
  'pattern',
  'role',
  'tone',
  'type',
  'variant',
]);

const isMarkupAttribute = (name) => name.startsWith('data-') || MARKUP_ATTRIBUTES.has(name);

const attributeName = (name) =>
  name.type === 'JSXNamespacedName' ? `${name.namespace.name}:${name.name.name}` : name.name;

const unwrap = (node) =>
  node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression'
    ? unwrap(node.expression)
    : node;

function valueStrings(node) {
  const value = unwrap(node);
  switch (value.type) {
    case 'Literal':
      return typeof value.value === 'string' ? [{ node: value, text: value.value }] : [];
    case 'TemplateLiteral':
      return [{ node: value, text: value.quasis.map((quasi) => quasi.value.cooked ?? '').join('') }];
    case 'ConditionalExpression':
      return [...valueStrings(value.consequent), ...valueStrings(value.alternate)];
    case 'LogicalExpression':
      return [...valueStrings(value.left), ...valueStrings(value.right)];
    default:
      return [];
  }
}

function metadataStrings(node) {
  const value = unwrap(node);
  switch (value.type) {
    case 'ObjectExpression':
      return value.properties.flatMap((property) =>
        property.type === 'Property' ? metadataStrings(property.value) : [],
      );
    case 'ArrayExpression':
      return value.elements.flatMap((element) => (element === null ? [] : metadataStrings(element)));
    default:
      return valueStrings(value);
  }
}

const noInlineCopy = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow user-facing copy outside apps/web/messages/en.ts.',
    },
    schema: [],
    messages: {
      inlineCopy:
        'User-facing copy {{text}} is written inline. Move it to apps/web/messages/en.ts ' +
        'and import it from there.',
      inlineAttributeCopy:
        'User-facing copy {{text}} is written inline on `{{name}}`. Move it to ' +
        'apps/web/messages/en.ts and import it from there. If `{{name}}` carries no copy, ' +
        'add it to MARKUP_ATTRIBUTES in packages/config/eslint/plugin.mjs.',
    },
  },
  create(context) {
    const report = (node, text, messageId, name = '') => {
      context.report({ node, messageId, data: { text: JSON.stringify(text.trim()), name } });
    };
    const reportStrings = (found, messageId, name) => {
      for (const { node, text } of found) {
        if (!isBlank(text)) report(node, text, messageId, name);
      }
    };

    return {
      JSXText(node) {
        if (LETTER.test(node.value)) report(node, node.value, 'inlineCopy');
      },
      JSXAttribute(node) {
        const name = attributeName(node.name);
        if (node.value === null || isMarkupAttribute(name)) return;
        const value = node.value.type === 'JSXExpressionContainer' ? node.value.expression : node.value;
        reportStrings(valueStrings(value), 'inlineAttributeCopy', name);
      },
      ':matches(JSXElement, JSXFragment) > JSXExpressionContainer'(node) {
        reportStrings(valueStrings(node.expression), 'inlineCopy');
      },
      'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator'(node) {
        if (node.id.type !== 'Identifier' || node.id.name !== 'metadata' || node.init === null) return;
        reportStrings(metadataStrings(node.init), 'inlineCopy');
      },
    };
  },
};

const RAW_COLOUR = /(?<![\w&])#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab)\(/giu;

const COLOUR_UTILITY =
  /^(?:text|bg|border(?:-[xytrblse])?|outline|ring|ring-offset|inset-ring|divide|fill|stroke|from|via|to|decoration|placeholder|caret|accent|shadow|inset-shadow|drop-shadow|text-shadow)-(?:(?:slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)(?:\/\S+)?$/u;

const utilityOf = (className) => (className.split(':').at(-1) ?? '').replace(/^[!-]+|!$/gu, '');

const paletteClasses = (text) =>
  text.split(/\s+/u).filter((className) => COLOUR_UTILITY.test(utilityOf(className)));

const noRawColor = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow colour literals and Tailwind palette classes outside the token source.',
    },
    schema: [],
    messages: {
      rawColour:
        'Colour literal {{text}} is written outside the token source. Use a semantic token ' +
        'from packages/ui/src/tokens.ts, as a utility such as `text-danger`, or add the ' +
        'colour there and to docs/DESIGN.md.',
      paletteClass:
        'Class {{text}} names a colour outside the token set. Use a semantic token such as ' +
        '`bg-surface` or `text-text-muted`; docs/DESIGN.md lists them.',
    },
  },
  create(context) {
    const check = (node, text) => {
      for (const match of text.matchAll(RAW_COLOUR)) {
        context.report({ node, messageId: 'rawColour', data: { text: JSON.stringify(match[0]) } });
      }
      for (const className of paletteClasses(text)) {
        context.report({ node, messageId: 'paletteClass', data: { text: JSON.stringify(className) } });
      }
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

const DIRECTIVE = /^(?:eslint-disable-next-line|eslint-disable-line|eslint-disable|eslint-enable|@ts-expect-error)(?=\s|$)/;
const DIRECTIVE_REASON = /\s--\s*\S/;

const noComments = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow comments other than tool directives that state a reason. ADR-0025.',
    },
    schema: [],
    messages: {
      comment:
        'Code carries no comments (ADR-0025). Delete it if an ADR, the architecture document, ' +
        'a test name or an identifier already says it; state a rule as a test or a test name; ' +
        'put an architectural reason in its ADR or docs/ARCHITECTURE.md; otherwise choose a ' +
        'better name, or drop it.',
      directiveWithoutReason:
        'A directive states its reason after ` -- `, as in ' +
        '`eslint-disable-next-line <rule> -- <reason>` (ADR-0025).',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type === 'Shebang') continue;
          const text = comment.value.trim();
          if (!DIRECTIVE.test(text)) {
            context.report({ loc: comment.loc, messageId: 'comment' });
          } else if (!DIRECTIVE_REASON.test(text)) {
            context.report({ loc: comment.loc, messageId: 'directiveWithoutReason' });
          }
        }
      },
    };
  },
};

export const repoPlugin = {
  meta: { name: 'eslint-plugin-repo', version: '0.0.0' },
  rules: {
    'no-comments': noComments,
    'no-inline-copy': noInlineCopy,
    'no-non-ascii': noNonAscii,
    'no-raw-color': noRawColor,
  },
};

export default repoPlugin;
