import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

// 使用解析后的注释检查，避免把字符串中的 URL 误判为代码注释。
const chineseComments = {
  meta: { type: 'suggestion', schema: [], messages: { chinese: '说明注释须包含中文。', line: 'JS/TS 说明注释请使用中文 // xxx 格式。' } },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          // 工具指令和许可证遵循其原始语法，不限制生成文件。
          if (/^\s*(eslint-|@ts-|istanbul |c8 |@license|!)/u.test(comment.value) || comment.type === 'Shebang') continue;
          if (comment.type !== 'Line') context.report({ loc: comment.loc, messageId: 'line' });
          else if (!/\p{Script=Han}/u.test(comment.value)) context.report({ loc: comment.loc, messageId: 'chinese' });
        }
      },
    };
  },
};

export default tseslint.config(
  { ignores: ['node_modules/**', '.next/**', '.preview-build/**', 'next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    plugins: { project: { rules: { 'chinese-comments': chineseComments } }, 'react-hooks': reactHooks },
    rules: {
      'project/chinese-comments': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);
