# 灵程 CodeSpirit - GitHub Pages 部署指南

## 概述

本指南将帮助你将灵程 CodeSpirit 项目部署到 GitHub Pages，实现免费的静态网站托管。

## 前提条件

1. **GitHub 账户**：如果没有，请先注册 [GitHub](https://github.com)
2. **Git 客户端**：已安装并配置好
3. **Node.js 18+**：用于构建项目

## 部署步骤

### 步骤 1：上传代码到 GitHub

1. 在 GitHub 上创建新仓库：
   - 访问 https://github.com/new
   - 仓库名：`CodeSpirit`（或其他你喜欢的名字）
   - 选择 Public（公开）
   - 不要初始化 README、.gitignore 或 license

2. 将本地代码推送到 GitHub：
   ```bash
   # 进入项目目录
   cd f:/学习/编程/灵程
   
   # 初始化 Git 仓库（如果还没有）
   git init
   
   # 添加所有文件
   git add .
   
   # 提交更改
   git commit -m "初始提交：灵程 CodeSpirit AI互动编程学习平台"
   
   # 添加远程仓库
   git remote add origin https://github.com/你的用户名/CodeSpirit.git
   
   # 推送代码
   git branch -M main
   git push -u origin main
   ```

### 步骤 2：配置 GitHub Pages

1. 在 GitHub 仓库页面，点击 **Settings**（设置）
2. 左侧菜单选择 **Pages**（页面）
3. 在 **Source**（源）部分：
   - 选择 **GitHub Actions**（GitHub 操作）
   - 或选择 **Deploy from a branch**（从分支部署）
   - 分支选择 `main` 或 `gh-pages`
   - 文件夹选择 `/ (root)` 或 `/app/dist`（根据构建输出）

### 步骤 3：创建 GitHub Actions 工作流（推荐）

创建文件 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: app/package-lock.json
        
    - name: Install Dependencies
      run: |
        cd app
        npm ci
        
    - name: Build
      run: |
        cd app
        npm run build
        
    - name: Deploy to GitHub Pages
      uses: JamesIves/github-pages-deploy-action@v4
      with:
        folder: app/dist
        branch: gh-pages
```

### 步骤 4：手动构建和部署（备选方案）

如果你不想使用 GitHub Actions，可以手动构建并部署：

1. 本地构建项目：
   ```bash
   cd app
   npm install
   npm run build
   ```

2. 创建 `gh-pages` 分支并部署：
   ```bash
   # 安装 gh-pages 工具
   npm install --save-dev gh-pages
   
   # 在 package.json 中添加部署脚本
   # "scripts": {
   #   "predeploy": "npm run build",
   #   "deploy": "gh-pages -d dist"
   # }
   
   # 部署到 GitHub Pages
   npm run deploy
   ```

## 配置说明

### 1. 修改 vite.config.ts（如果需要）

确保 `vite.config.ts` 中的 `base` 设置为 GitHub Pages 的路径：

```typescript
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/CodeSpirit/' : './',
  // 其他配置...
})
```

如果你的仓库名不是 `CodeSpirit`，请相应修改路径。

### 2. 配置 PWA（可选）

项目已支持 PWA（渐进式 Web 应用），部署后可以：
- 添加到主屏幕
- 离线使用
- 获得类似原生应用的体验

### 3. 配置自定义域名（可选）

如果你有自己的域名：
1. 在域名注册商处添加 CNAME 记录指向 `你的用户名.github.io`
2. 在 GitHub Pages 设置中添加自定义域名

## 访问你的应用

部署成功后，可以通过以下 URL 访问：

- **GitHub Pages URL**: `https://你的用户名.github.io/CodeSpirit/`
- **自定义域名**（如果配置了）: `https://你的域名.com`

## 常见问题

### 1. 页面显示空白
- 检查控制台是否有 JavaScript 错误
- 确保 `base` 路径配置正确
- 检查构建是否成功

### 2. 资源加载失败
- 检查网络标签，确认 CSS/JS 文件是否正确加载
- 确保所有资源路径使用相对路径

### 3. PWA 不工作
- 确保 HTTPS 连接
- 检查 `manifest.json` 和 `sw.js` 是否正确配置
- 清除浏览器缓存后重试

### 4. AI API 调用失败
- 需要在设置页面配置 DeepSeek API 密钥
- 确保网络可以访问 `api.deepseek.com`
- 检查 API 密钥是否有效

## 维护和更新

### 更新代码
```bash
# 本地修改后
git add .
git commit -m "更新描述"
git push origin main
```

GitHub Actions 会自动构建和部署。

### 回滚版本
```bash
# 回退到指定提交
git reset --hard <commit-hash>
git push -f origin main
```

## 高级功能

### 1. 自动构建通知
配置 GitHub Actions 在构建成功后发送通知（邮件、Slack、钉钉等）。

### 2. 多环境部署
可以配置不同的环境（开发、测试、生产）：
- 开发环境：`develop` 分支
- 生产环境：`main` 分支

### 3. CDN 加速
使用 jsDelivr 等 CDN 加速静态资源加载。

## 技术支持

如果遇到问题：
1. 检查 GitHub Actions 日志
2. 查看浏览器控制台错误
3. 在 GitHub Issues 中提问
4. 参考 Vite 和 React 官方文档

## 许可证

本项目采用 MIT 许可证，你可以自由使用、修改和分发。

---

**祝你部署顺利！🎉**

如果有任何问题，欢迎在 GitHub 仓库中提交 Issue。