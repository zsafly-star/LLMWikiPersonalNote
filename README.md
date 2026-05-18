# ZSSNote - 个人知识管理系统

基于 Flask 的个人知识管理系统，支持 Markdown 笔记、图片管理、AI 聊天、智能 Wiki 知识库和知识星链。

## 功能特性

### 核心模块

| 模块 | 说明 |
|------|------|
| 首页 | 天气时间、收藏卡片、数据统计、可拖拽布局 |
| 文章 | Markdown 知识库管理，阅读/编辑双模式，文档收藏与拖拽排序，附件管理 |
| Wiki | 基于 LLM 的智能知识编译，从文章自动提取概念并生成 Wiki 页面 |
| 星链 | D3.js 力导向知识图谱，可视化概念关联关系 |
| 图片 | 一级文件夹管理、图片上传/删除/搜索/预览、自定义文件夹图标 |
| 聊天 | 多模型 AI 对话（OpenAI/Claude/Gemini/本地模型），聊天转文档 |
| 计划 | 计划管理 |
| 笔记 | 快速笔记 |
| 待办 | 待办事项 |
| 设置 | 主题切换（青绿/粉色）、LLM 配置、资源路径配置 |

### 文章管理
- Markdown 渲染与编辑，工具栏快捷操作
- 知识库文件夹管理（自定义 Fluent Emoji 图标）
- 文档收藏、拖拽排序、三点菜单操作
- MD 文件内图片自动解析与展示
- 附件管理：弹窗选择已有附件或上传新附件，支持分页浏览和批量插入
- 上传进度条实时显示上传状态
- 附件链接在新标签页打开下载

### 图片管理
- 一级文件夹目录树（自定义图标）
- 图片上传、批量删除、网格/列表视图
- 搜索框同时过滤文件夹和图片
- 图片点击放大预览，左右翻页
- 工具栏三点菜单进入删除模式（全选/确认删除/取消）

### Wiki 知识库
- **两阶段编译管道**：概念提取 → 概念合并 → 页面生成 → 索引构建
- **增量编译**：基于源文件 SHA256 哈希检测变化，只处理有更新的文章
- **全量编译**：清空重建，自动执行初始化
- **分组批量提取**：动态调整批次大小（3-10 篇/批），减少 LLM 调用次数
- **并行页面生成**：ThreadPoolExecutor 5 线程并发生成概念页面
- **概念关联**：LLM 生成 `[[概念名]]` 链接，传入已知概念列表确保引用准确
- **错误处理**：LLM 调用失败时立即停止，分级异常（限流/认证/网络），弹窗提示详情
- **状态追踪**：实时编译进度、文章编译状态（已编译/待编译）、错误日志

### 知识星链
- D3.js v7 力导向图，可视化概念之间的关联关系
- 节点大小反映关联数量，点击节点跳转到对应 Wiki 页面
- 模糊匹配算法（精确匹配 → 标题包含匹配 → slug 包含匹配），最大化连线显示
- 支持拖拽、缩放、悬停高亮关联节点

## 项目结构

```
src/
├── app.py                    # Flask 应用入口
├── config.py                 # 配置管理（含资源路径集中配置）
├── extensions.py             # 共享扩展（db 等）
├── dev.ps1                   # 开发启动脚本（start/stop/restart/status）
├── requirements.txt          # Python 依赖
├── .env                      # 环境变量
├── common/
│   └── response.py           # 统一响应格式
├── modules/
│   ├── article/              # 文章模块
│   │   ├── routes.py         # 路由层（纯路由定义）
│   │   ├── file_service.py   # 文件系统操作（文件树、文件夹管理、附件）
│   │   ├── markdown_service.py # Markdown 渲染与图片链接处理
│   │   ├── models.py         # 数据模型
│   │   ├── services.py       # 数据库 CRUD 服务
│   │   └── templates/
│   ├── picture/              # 图片模块
│   │   ├── routes.py         # 路由（树、图片CRUD、文件夹管理）
│   │   └── templates/
│   ├── wiki/                # Wiki 知识库模块
│   │   ├── routes.py        # 路由（编译、页面、图谱、查询）
│   │   ├── wiki_compiler.py # 编译引擎（提取、合并、生成）
│   │   ├── wiki_service.py  # 文件系统操作（页面读写、哈希管理）
│   │   ├── models.py        # WikiPage 数据模型
│   │   └── templates/
│   │       ├── wiki.html    # Wiki 主页面
│   │       └── graph.html   # 知识星链页面
│   ├── chat/                 # 聊天模块
│   │   ├── routes.py
│   │   ├── models.py
│   │   └── services.py
│   ├── home/                 # 首页模块
│   ├── note/                 # 笔记模块
│   ├── plan/                 # 计划模块
│   ├── todo/                 # 待办模块
│   ├── settings/             # 设置模块
│   └── folder/               # 文件夹模块
├── static/
│   ├── css/main.css          # 全局样式
│   ├── js/app.js             # 前端逻辑
│   ├── lib/                  # 本地第三方库
│   │   ├── font-awesome.min.css
│   │   └── chart.js
│   ├── webfonts/             # Font Awesome 字体文件
│   └── emoji/                # Fluent Emoji 3D 图标（55个，自包含）
└── templates/
    ├── base.html             # 基础布局模板
    ├── index.html            # 首页单页模板
    ├── article.html          # 文章页模板
    ├── picture.html          # 图片页模板
    ├── home.html             # 首页模板
    ├── note.html             # 笔记页模板
    ├── plan.html             # 计划页模板
    ├── todo.html             # 待办页模板
    └── settings.html         # 设置页模板
```

## 快速开始

### 环境要求

| 依赖 | 版本 |
|------|------|
| Python | >= 3.8 |
| Flask | >= 2.0 |
| Conda | 可选，推荐 |

### 安装

```bash
cd src

# 使用 conda（推荐）
conda activate flask
pip install -r requirements.txt

# 或使用自带 venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 配置

创建 `.env` 文件：

```env
SECRET_KEY=your-secret-key

# 资源路径（可选，默认为项目根目录下的 resource/）
# RESOURCE_BASE_PATH=D:\my-resource

# AI 模型（可选）
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
GEMINI_API_KEY=your-key
```

资源路径说明：
- 默认自动定位到项目根目录下的 `resource/` 文件夹
- 可通过环境变量 `RESOURCE_BASE_PATH` 自定义
- 系统会自动创建 `article/`、`img/`、`attachments/` 子目录

### 启动

```powershell
# 使用开发脚本（推荐）
.\dev.ps1 start       # 启动
.\dev.ps1 stop        # 停止
.\dev.ps1 restart     # 重启
.\dev.ps1 status      # 查看状态

# 或直接运行
python app.py
```

访问地址：`http://localhost:5000`

## API 接口

### 文章模块

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/article/tree` | GET | 获取知识库目录树 |
| `/api/article/content` | GET | 获取文章内容（Markdown 渲染） |
| `/api/article/content` | POST | 保存文章内容 |
| `/api/article/preview` | POST | 预览文章（Markdown 渲染） |
| `/api/article/folder` | POST | 创建知识库文件夹 |
| `/api/article/folder-meta` | GET | 获取知识库元信息（图标等） |
| `/api/article/folder-meta` | POST | 更新知识库元信息 |
| `/api/article/document` | POST | 创建文档 |
| `/api/article/rename` | POST | 重命名文档 |
| `/api/article/document` | DELETE | 删除文档 |
| `/api/article/init-paths` | POST | 初始化资源目录 |
| `/api/article/image` | GET | 文章内图片代理 |
| `/api/article/emoji/<name>` | GET | 获取 Fluent Emoji 图标 |
| `/api/article/upload-attachment` | POST | 上传附件 |
| `/api/article/attachments` | GET | 获取附件列表（分页） |
| `/api/article/attachment` | GET | 下载附件 |

### 图片模块

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/picture/tree` | GET | 获取图片目录树（一级文件夹） |
| `/api/picture/images` | GET | 获取图片列表 |
| `/api/picture/image` | GET | 获取单张图片 |
| `/api/picture/folder` | POST | 创建图片文件夹 |
| `/api/picture/folder` | DELETE | 删除文件夹及所有图片 |
| `/api/picture/folder-icon` | POST | 更新文件夹图标 |
| `/api/picture/upload` | POST | 上传图片 |
| `/api/picture/delete-images` | POST | 批量删除图片 |

### 聊天模块

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat/sessions` | GET/POST | 获取会话列表 / 创建会话 |
| `/api/chat/sessions/<id>` | GET | 获取会话详情 |
| `/api/chat/sessions/<id>/messages` | POST | 发送消息 |
| `/api/chat/sessions/<id>/to-article` | POST | 聊天转笔记 |

### Wiki 模块

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/wiki/compile` | POST | 启动编译（`incremental`/`init` 参数） |
| `/api/wiki/status` | GET | 获取编译状态（进度、错误） |
| `/api/wiki/pages` | GET | 获取概念页面列表 |
| `/api/wiki/pages/<slug>` | GET | 获取单个概念页面详情 |
| `/api/wiki/sources` | GET | 获取源文章列表（含编译状态） |
| `/api/wiki/graph` | GET | 获取知识图谱数据（节点+边） |
| `/api/wiki/query` | POST | Wiki 智能查询 |
| `/api/wiki/queries` | GET | 获取查询历史 |
| `/api/llm/config` | GET | 获取 LLM 配置 |
| `/api/llm/config` | POST | 保存 LLM 配置 |

## 数据存储

| 数据 | 存储方式 | 位置 |
|------|---------|------|
| 知识库文章 | 文件系统 | `resource/article/` |
| 图片文件 | 文件系统 | `resource/img/` |
| 附件文件 | 文件系统 | `resource/attachments/` |
| Wiki 概念页面 | 文件系统 | `resource/wiki/concepts/` |
| Wiki 查询记录 | 文件系统 | `resource/wiki/queries/` |
| Wiki 索引 | 文件系统 | `resource/wiki/index.md` |
| 编译哈希记录 | JSON | `resource/wiki/source_hashes.json` |
| 文件夹元信息 | JSON | `文件夹下 .zsnote.json` |
| 聊天/Wiki 数据 | SQLite | `instance/sseditor.db` |
| 主题/布局 | 浏览器 localStorage | - |

## 技术栈

| 类别 | 技术 |
|------|------|
| 后端框架 | Flask |
| 数据库 | SQLite（SQLAlchemy ORM） |
| 前端 | 原生 JavaScript |
| 图标 | Font Awesome 6.4（本地托管）+ Fluent Emoji 3D（本地托管） |
| 图表 | Chart.js（本地托管） |
| 知识图谱 | D3.js v7 |
| Markdown | Python-Markdown |
| AI 模型 | OpenAI / Anthropic / Gemini API |

## 部署

本项目 `src/` 目录完全自包含，部署时只需复制以下内容：

```
src/          # 应用代码（含 static/emoji 图标资源）
resource/     # 用户数据（文章、图片、附件）
```

无需依赖 `demo/` 目录中的任何资源。

## 贡献

欢迎提交 Issue 和 Pull Request！
