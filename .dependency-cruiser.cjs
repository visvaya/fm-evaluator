module.exports = {
  forbidden: [
    {
      comment: 'Circular dependencies are forbidden',
      from: {},
      name: 'no-circular',
      severity: 'error',
      to: { circular: true }
    },
    {
      comment: 'Computing layer must not depend on the UI layer',
      from: { path: '^src/computing/' },
      name: 'computing-no-ui',
      severity: 'warn',
      to: { path: '^src/ui/' }
    },
    {
      comment: 'Config modules must remain free of project-specific dependencies',
      from: { path: '^src/config/' },
      name: 'config-no-project',
      severity: 'warn',
      to: { path: '^src/(ui|computing|storage|processing)/' }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    enhancedResolveOptions: {
      conditionNames: ['import', 'require', 'node', 'default'],
      exportsFields: ['exports']
    },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true
  }
};
