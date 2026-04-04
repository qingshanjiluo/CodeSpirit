# 灵程 CodeSpirit - AI互动编程学习平台

<p align="center">
  <img src="public/icons/icon-192x192.png" alt="灵程 Logo" width="128" height="128">
</p>

<p align="center">
  <strong>你的AI编程导师，让学习像游戏一样有趣</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#部署指南">部署指南</a> •
  <a href="#使用说明">使用说明</a> •
  <a href="#技术栈">技术栈</a>
</p>

---

## 功能特性

### 核心功能

- **AI 课程生成**：通过自然语言描述学习目标，AI 自动生成个性化课程
- **对话式学习**：AI 导师全程伴学，提供实时指导和答疑
- **代码沙箱**：支持 JavaScript、Python、HTML/CSS 在线运行
- **游戏化学习**：积分、徽章、连续打卡等激励机制
- **离线学习**：PWA 支持，已下载课程可离线学习

### 学习工具

- **笔记本**：自动/手动笔记，支持 Markdown 编辑和导出
- **学习看板**：可视化学习进度和统计数据
- **作品集**：展示学习成果
- **课程分享**：支持导出/导入课程，加密分享

### 技术特性

- **纯前端架构**：无需后端服务器，数据存储在本地 IndexedDB
- **多 API 密钥轮询**：支持配置多个 AI API 密钥，自动负载均衡
- **响应式设计**：适配桌面和移动设备
- **深色模式**：支持浅色/深色主题切换

---

## 快速开始

### 环境要求

- Node.js 18+ 
- npm 9+ 或 yarn 1.22+

### 安装步骤

1. **克隆仓库**

```bash
git clone <repository-url>
cd codespirit
```

2. **安装依赖**

```bash
npm install
```

3. **启动开发服务器**

```bash
npm run dev
```

4. **打开浏览器访问**

```
http://localhost:5173
```

### 构建生产版本

```bash
npm run build
```

构建后的文件位于 `dist/` 目录。

---

## 部署指南

### 静态部署（推荐）

灵程是纯前端应用，可以部署到任何静态托管服务：

#### Vercel

```bash
npm i -g vercel
vercel --prod
```

#### Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

#### GitHub Pages

```bash
npm run build
# 将 dist 目录内容推送到 gh-pages 分支
```

#### Nginx 部署

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/codespirit/dist;
    index index.html;

    # 前端路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
```

### HTTPS 配置

PWA 功能需要 HTTPS 环境。可以使用以下方式获取免费 SSL 证书：

- [Let's Encrypt](https://letsencrypt.org/)
- [Cloudflare](https://www.cloudflare.com/)

---

## 使用说明

### 首次使用

1. 打开应用后，进入**设置**页面
2. 在 **AI 配置** 中添加你的 API 密钥
3. 支持 DeepSeek、OpenAI 等兼容 OpenAI API 格式的服务

### 创建课程

1. 点击首页的**创建课程**按钮
2. 用自然语言描述你的学习目标
3. 选择 AI 生成的课程方案
4. 调整难度、时间等参数
5. 上传封面图片（可选）
6. 等待 AI 生成课程内容

### 学习过程

1. 进入课程后，AI 导师会引导你学习
2. 可以随时提问，AI 会实时回答
3. 完成练习和测试，获得经验值
4. 使用笔记本记录重要知识点

### 数据管理

- **导出数据**：在设置中导出所有数据为 JSON 文件
- **导入数据**：从备份文件恢复数据
- **分享课程**：导出单个课程为 `.lingcheng` 文件

---

## 技术栈

### 前端框架

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **shadcn/ui** - UI 组件库

### 核心库

- **Monaco Editor** - 代码编辑器
- **Pyodide** - Python 运行时（浏览器中运行 Python）
- **Chart.js** - 数据可视化
- **marked** - Markdown 解析

### 存储

- **IndexedDB** - 本地数据存储
- **localStorage** - 配置和缓存

### PWA

- **Service Worker** - 离线缓存
- **Web App Manifest** - 应用清单
- **Web Speech API** - 语音输入/输出

---

## 项目结构

```
codespirit/
├── public/                 # 静态资源
│   ├── manifest.json      # PWA 清单
│   ├── sw.js              # Service Worker
│   └── icons/             # 应用图标
├── src/
│   ├── components/        # React 组件
│   │   ├── ui/           # shadcn/ui 组件
│   │   ├── Sidebar.tsx   # 侧边栏
│   │   └── Header.tsx    # 顶部导航
│   ├── pages/            # 页面组件
│   │   ├── HomePage.tsx
│   │   ├── CoursesPage.tsx
│   │   ├── LearningPage.tsx
│   │   └── ...
│   ├── db/               # IndexedDB 封装
│   ├── ai/               # AI 调用模块
│   ├── utils/            # 工具函数
│   ├── types/            # TypeScript 类型
│   └── App.tsx           # 主应用组件
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 配置说明

### AI 配置

在设置页面的 **AI 配置** 中：

- **API 端点**：DeepSeek 默认 `https://api.deepseek.com/v1/chat/completions`
- **模型**：DeepSeek 默认 `deepseek-chat`
- **API 密钥**：支持配置多个密钥，自动轮询

### 环境变量（可选）

创建 `.env` 文件：

```env
# 开发环境
VITE_APP_TITLE=灵程 CodeSpirit

# 可选：默认 API 配置
VITE_DEFAULT_API_ENDPOINT=https://api.deepseek.com/v1/chat/completions
VITE_DEFAULT_MODEL=deepseek-chat
```

---

## 浏览器兼容性

| 浏览器 | 最低版本 |
|--------|----------|
| Chrome | 90+      |
| Firefox| 88+      |
| Safari | 14+      |
| Edge   | 90+      |

**注意**：
- PWA 安装功能需要 Chrome/Edge 90+ 或 Safari 14+
- 语音功能需要浏览器支持 Web Speech API
- Python 代码运行需要 WebAssembly 支持

---

## 常见问题

### Q: 如何获取 DeepSeek API 密钥？

A: 访问 [DeepSeek 开放平台](https://platform.deepseek.com/) 注册并创建 API 密钥。

### Q: 数据存储在哪里？

A: 所有数据存储在浏览器的 IndexedDB 中，不会上传到服务器。

### Q: 如何备份数据？

A: 在设置页面的**数据管理**中点击**导出数据**。

### Q: 支持哪些编程语言？

A: 目前支持 JavaScript、Python、HTML/CSS 的在线运行，其他语言可以通过 AI 模拟执行。

### Q: 离线时可以使用哪些功能？

A: 离线时可以查看已下载的课程内容，但 AI 实时对话和代码运行功能需要网络连接。

---

## 开发计划

- [ ] 支持更多编程语言（Java、C++、Go 等）
- [ ] 多人协作学习
- [ ] 社区课程市场
- [ ] 更丰富的游戏化元素
- [ ] 移动端 App（React Native）

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/xxx`
3. 提交更改：`git commit -am 'Add xxx'`
4. 推送分支：`git push origin feature/xxx`
5. 创建 Pull Request

---

## 许可证

[MIT License](LICENSE)

---

## 联系方式

- 项目主页：[https://codespirit.app](https://codespirit.app)
- 问题反馈：[GitHub Issues](https://github.com/yourusername/codespirit/issues)
- 邮件联系：support@codespirit.app

---

<p align="center">
  Made with ❤️ by CodeSpirit Team
</p>
