/**
 * CodeSpirit 代码沙箱执行模块
 * 支持 JavaScript 和 Python（Pyodide）
 */

import type { CodeExecutionResult } from '@/types';

// Pyodide 实例
let pyodideInstance: any = null;
let pyodideLoading: Promise<any> | null = null;

/**
 * 加载 Pyodide
 */
export async function loadPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoading) return pyodideLoading;

  pyodideLoading = new Promise(async (resolve, reject) => {
    try {
      // 动态导入 pyodide
      const { loadPyodide: load } = await import('pyodide');
      pyodideInstance = await load({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
        stdout: (text: string) => console.log('[Python]', text),
        stderr: (text: string) => console.error('[Python]', text)
      });
      resolve(pyodideInstance);
    } catch (error) {
      reject(error);
    }
  });

  return pyodideLoading;
}

/**
 * 执行 JavaScript 代码
 */
export async function executeJavaScript(
  code: string,
  timeout: number = 5000
): Promise<CodeExecutionResult> {
  const startTime = performance.now();
  let output = '';
  let error: string | undefined;

  // 捕获 console 输出
  const originalLog = console.log;
  const originalError = console.error;
  const logs: string[] = [];

  console.log = (...args) => {
    logs.push(args.map(a => String(a)).join(' '));
  };
  console.error = (...args) => {
    logs.push(args.map(a => String(a)).join(' '));
  };

  try {
    // 使用 Function 构造器创建沙箱
    const sandbox = new Function('console', `
      "use strict";
      ${code}
    `);

    // 设置超时
    const timeoutId = setTimeout(() => {
      throw new Error('代码执行超时');
    }, timeout);

    sandbox({
      log: (...args: any[]) => logs.push(args.map(a => String(a)).join(' ')),
      error: (...args: any[]) => logs.push(args.map(a => String(a)).join(' '))
    });

    clearTimeout(timeoutId);
    output = logs.join('\n');
  } catch (e: any) {
    error = e.message || String(e);
    output = logs.join('\n');
  } finally {
    // 恢复 console
    console.log = originalLog;
    console.error = originalError;
  }

  return {
    success: !error,
    output: output || (error ? '' : '代码执行成功（无输出）'),
    error,
    executionTime: Math.round(performance.now() - startTime)
  };
}

/**
 * 执行 Python 代码
 */
export async function executePython(
  code: string,
  timeout: number = 10000
): Promise<CodeExecutionResult> {
  const startTime = performance.now();

  try {
    const pyodide = await loadPyodide();

    // 重定向输出
    let output = '';
    pyodide.setStdout({ batched: (text: string) => { output += text + '\n'; } });
    pyodide.setStderr({ batched: (text: string) => { output += 'Error: ' + text + '\n'; } });

    // 执行代码
    await pyodide.runPythonAsync(code);

    return {
      success: true,
      output: output || '代码执行成功（无输出）',
      executionTime: Math.round(performance.now() - startTime)
    };
  } catch (e: any) {
    return {
      success: false,
      output: '',
      error: e.message || String(e),
      executionTime: Math.round(performance.now() - startTime)
    };
  }
}

/**
 * 执行 HTML/CSS/JS 代码（返回可渲染的 HTML）
 */
export function executeHTML(code: string): CodeExecutionResult {
  const startTime = performance.now();

  try {
    // 创建安全的沙箱 HTML
    const sandboxedHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: system-ui, sans-serif; 
              padding: 16px;
              margin: 0;
            }
          </style>
        </head>
        <body>
          ${code}
        </body>
      </html>
    `;

    return {
      success: true,
      output: sandboxedHTML,
      executionTime: Math.round(performance.now() - startTime)
    };
  } catch (e: any) {
    return {
      success: false,
      output: '',
      error: e.message || String(e),
      executionTime: Math.round(performance.now() - startTime)
    };
  }
}

/**
 * 通用代码执行入口
 */
export async function executeCode(
  code: string,
  language: string,
  testCases?: Array<{ input: string; expected: string }>
): Promise<CodeExecutionResult & { testResults?: Array<{ passed: boolean; input: string; expected: string; actual: string }> }> {
  let result: CodeExecutionResult;

  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
      result = await executeJavaScript(code);
      break;
    case 'python':
    case 'py':
      result = await executePython(code);
      break;
    case 'html':
      result = executeHTML(code);
      break;
    default:
      result = {
        success: false,
        output: '',
        error: `暂不支持 ${language} 语言`,
        executionTime: 0
      };
  }

  // 运行测试用例
  if (testCases && testCases.length > 0 && result.success) {
    const testResults = await runTestCases(code, language, testCases);
    return { ...result, testResults };
  }

  return result;
}

/**
 * 运行测试用例
 */
async function runTestCases(
  code: string,
  language: string,
  testCases: Array<{ input: string; expected: string }>
): Promise<Array<{ passed: boolean; input: string; expected: string; actual: string }>> {
  const results: Array<{ passed: boolean; input: string; expected: string; actual: string }> = [];

  for (const testCase of testCases) {
    let testCode: string;

    if (language === 'python') {
      testCode = `${code}\n\nprint(${testCase.input})`;
    } else {
      testCode = `${code}\n\nconsole.log(${testCase.input})`;
    }

    const result = language === 'python' 
      ? await executePython(testCode)
      : await executeJavaScript(testCode);

    const actual = result.output.trim();
    const passed = actual === testCase.expected.trim();

    results.push({
      passed,
      input: testCase.input,
      expected: testCase.expected,
      actual
    });
  }

  return results;
}

/**
 * 检查代码语法
 */
export function checkSyntax(code: string, language: string): { valid: boolean; error?: string } {
  if (language === 'javascript' || language === 'js') {
    try {
      // 使用 Function 构造器检查语法
      new Function(code);
      return { valid: true };
    } catch (e: any) {
      return { valid: false, error: e.message };
    }
  }

  // Python 语法检查需要在 Pyodide 中执行
  return { valid: true };
}

/**
 * 格式化代码（简单实现）
 */
export function formatCode(code: string, language: string): string {
  // 简单的格式化：统一缩进
  const lines = code.split('\n');
  let indent = 0;
  const formatted: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // 减少缩进的情况
    if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
      indent = Math.max(0, indent - 1);
    }

    formatted.push('  '.repeat(indent) + trimmed);

    // 增加缩进的情况
    if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
      indent++;
    }
  }

  return formatted.join('\n');
}
