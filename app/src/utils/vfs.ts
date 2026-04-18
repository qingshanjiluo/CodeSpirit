/**
 * 虚拟文件系统 (Virtual File System)
 * 用于在浏览器端管理多文件项目结构
 */

import type { VFSNode, VirtualProject } from '@/types';

/**
 * 生成唯一ID
 */
function generateId(): string {
  return 'vfs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * 从文件名推断语言
 */
export function inferLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    cpp: 'cpp',
    c: 'c',
    java: 'java',
    go: 'go',
    rs: 'rust',
  };
  return map[ext || ''] || 'plaintext';
}

/**
 * 创建默认项目（单文件）
 */
export function createDefaultProject(language: string): VirtualProject {
  const mainFile: VFSNode = {
    id: generateId(),
    name: language === 'html' ? 'index.html' : language === 'python' ? 'main.py' : 'main.js',
    type: 'file',
    content: '',
    language,
    parentId: null,
  };

  const root: VFSNode = {
    id: generateId(),
    name: 'project',
    type: 'directory',
    children: [mainFile],
    parentId: null,
  };

  return {
    id: generateId(),
    name: '未命名项目',
    root,
    activeFileId: mainFile.id,
    entryFileId: mainFile.id,
  };
}

/**
 * 在指定目录下创建文件
 */
export function createFile(
  project: VirtualProject,
  parentId: string,
  filename: string,
  content = ''
): VirtualProject {
  const newFile: VFSNode = {
    id: generateId(),
    name: filename,
    type: 'file',
    content,
    language: inferLanguageFromFilename(filename),
    parentId,
  };

  return {
    ...project,
    root: addNode(project.root, parentId, newFile),
    activeFileId: newFile.id,
  };
}

/**
 * 在指定目录下创建文件夹
 */
export function createDirectory(
  project: VirtualProject,
  parentId: string,
  dirname: string
): VirtualProject {
  const newDir: VFSNode = {
    id: generateId(),
    name: dirname,
    type: 'directory',
    children: [],
    parentId,
  };

  return {
    ...project,
    root: addNode(project.root, parentId, newDir),
  };
}

/**
 * 递归添加节点到指定父目录
 */
function addNode(root: VFSNode, parentId: string, node: VFSNode): VFSNode {
  if (root.id === parentId && root.type === 'directory') {
    return {
      ...root,
      children: [...(root.children || []), node],
    };
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map((child) => addNode(child, parentId, node)),
    };
  }
  return root;
}

/**
 * 删除节点
 */
export function deleteNode(project: VirtualProject, nodeId: string): VirtualProject {
  return {
    ...project,
    root: removeNode(project.root, nodeId),
    activeFileId: project.activeFileId === nodeId ? undefined : project.activeFileId,
  };
}

/**
 * 递归删除节点
 */
function removeNode(root: VFSNode, nodeId: string): VFSNode {
  if (root.children) {
    return {
      ...root,
      children: root.children.filter((child) => child.id !== nodeId).map((child) => removeNode(child, nodeId)),
    };
  }
  return root;
}

/**
 * 更新文件内容
 */
export function updateFileContent(
  project: VirtualProject,
  fileId: string,
  content: string
): VirtualProject {
  return {
    ...project,
    root: updateNodeContent(project.root, fileId, content),
  };
}

/**
 * 递归更新节点内容
 */
function updateNodeContent(root: VFSNode, fileId: string, content: string): VFSNode {
  if (root.id === fileId) {
    return { ...root, content };
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map((child) => updateNodeContent(child, fileId, content)),
    };
  }
  return root;
}

/**
 * 查找节点
 */
export function findNode(root: VFSNode, nodeId: string): VFSNode | null {
  if (root.id === nodeId) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 查找所有文件（扁平化）
 */
export function flattenFiles(root: VFSNode): VFSNode[] {
  const files: VFSNode[] = [];
  if (root.type === 'file') {
    files.push(root);
  }
  if (root.children) {
    for (const child of root.children) {
      files.push(...flattenFiles(child));
    }
  }
  return files;
}

/**
 * 重命名节点
 */
export function renameNode(
  project: VirtualProject,
  nodeId: string,
  newName: string
): VirtualProject {
  return {
    ...project,
    root: renameNodeRecursive(project.root, nodeId, newName),
  };
}

function renameNodeRecursive(root: VFSNode, nodeId: string, newName: string): VFSNode {
  if (root.id === nodeId) {
    const updates: Partial<VFSNode> = { name: newName };
    if (root.type === 'file') {
      updates.language = inferLanguageFromFilename(newName);
    }
    return { ...root, ...updates };
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map((child) => renameNodeRecursive(child, nodeId, newName)),
    };
  }
  return root;
}

/**
 * 获取文件路径（如 project/src/main.js）
 */
export function getFilePath(root: VFSNode, nodeId: string): string {
  const path: string[] = [];
  function dfs(node: VFSNode, targetId: string): boolean {
    if (node.id === targetId) {
      path.push(node.name);
      return true;
    }
    if (node.children) {
      for (const child of node.children) {
        if (dfs(child, targetId)) {
          path.unshift(node.name);
          return true;
        }
      }
    }
    return false;
  }
  dfs(root, nodeId);
  return path.join('/');
}

/**
 * 构建 HTML entry（合并所有资源到单个 HTML）
 */
export function buildHtmlEntry(project: VirtualProject): string {
  const files = flattenFiles(project.root);
  const htmlFile = files.find((f) => f.name.endsWith('.html'));
  if (!htmlFile) return '';

  let html = htmlFile.content || '';

  // 注入 CSS 文件
  const cssFiles = files.filter((f) => f.name.endsWith('.css'));
  const styleTag = cssFiles.map((f) => f.content).join('\n');
  if (styleTag) {
    const styleElement = `<style>${styleTag}</style>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${styleElement}\n</head>`);
    } else {
      html = styleElement + html;
    }
  }

  // 注入 JS 文件
  const jsFiles = files.filter((f) => f.name.endsWith('.js') && !f.name.endsWith('.json'));
  const scriptTag = jsFiles.map((f) => f.content).join('\n');
  if (scriptTag) {
    const scriptElement = `<script>${scriptTag}</script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${scriptElement}\n</body>`);
    } else {
      html += scriptElement;
    }
  }

  return html;
}
