// Local oxlint plugin: naming of the declarations that the native `id-match` rule does not see
// (types, enum members, type parameters and function parameters). It replaces the parts of
// typescript-eslint's `naming-convention` that oxlint cannot load without type information.

const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
const UPPER_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
// camelCase or PascalCase, with optional leading underscores for unused parameters; `_` alone too.
const PARAMETER = /^_*(?:[a-z][a-z0-9]*)?$/i;

const FUNCTION_NODES = [
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
  'TSDeclareFunction'
];

function parameterIdentifier(param) {
  if (param.type === 'Identifier') return param;
  if (param.type === 'AssignmentPattern') return parameterIdentifier(param.left);
  if (param.type === 'RestElement') return parameterIdentifier(param.argument);
  if (param.type === 'TSParameterProperty') return parameterIdentifier(param.parameter);
  return null;
}

const namingConventionRule = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Enforce naming of types, enum members and parameters' },
    messages: {
      enumMember: 'Enum member "{{name}}": use UPPER_CASE or PascalCase.',
      parameter: 'Parameter "{{name}}": use camelCase or PascalCase (a leading _ marks it unused).',
      type: '{{kind}} "{{name}}": use PascalCase.'
    }
  },
  create(context) {
    const checkType = (kind) => (node) => {
      const name = node.id?.name ?? node.name?.name;
      if (name && !PASCAL_CASE.test(name)) {
        context.report({ node, messageId: 'type', data: { kind, name } });
      }
    };
    const checkParams = (node) => {
      for (const param of node.params) {
        const identifier = parameterIdentifier(param);
        // TypeScript's `this` parameter is a type annotation, not a name.
        if (!identifier || identifier.name === 'this' || PARAMETER.test(identifier.name)) continue;
        context.report({
          node: identifier,
          messageId: 'parameter',
          data: { name: identifier.name }
        });
      }
    };

    return {
      ...Object.fromEntries(FUNCTION_NODES.map((type) => [type, checkParams])),
      ClassDeclaration: checkType('Class'),
      TSEnumDeclaration: checkType('Enum'),
      TSEnumMember(node) {
        const name = node.id.type === 'Identifier' ? node.id.name : null;
        if (name && !UPPER_CASE.test(name) && !PASCAL_CASE.test(name)) {
          context.report({ node, messageId: 'enumMember', data: { name } });
        }
      },
      TSInterfaceDeclaration: checkType('Interface'),
      TSTypeAliasDeclaration: checkType('Type alias'),
      TSTypeParameter: checkType('Type parameter')
    };
  }
};

export default {
  meta: { name: 'naming' },
  rules: { 'naming-convention': namingConventionRule }
};
