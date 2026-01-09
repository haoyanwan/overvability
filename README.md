# Navimow Observability Dashboard

Azure VM 服务监控仪表盘，使用 React Flow 可视化服务拓扑，集成 Prometheus 指标展示。

## 功能特性

- 可视化 Azure VM 服务拓扑图
- 实时 Prometheus 指标监控（CPU、内存、存储）
- 30天指标聚合（峰值、平均值、最低值）
- 可拖拽节点布局，支持保存/重置
- 深色/浅色主题切换
- 数据持久化存储（TinyDB）

## 技术栈

**前端：**
- React 19 + TypeScript
- Vite
- React Flow（节点可视化）

**后端：**
- Python Flask
- TinyDB（JSON 数据库）
- Azure SDK
- Prometheus API Client

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.9+

### 1. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

### 2. 配置环境变量

创建 `backend/.env` 文件：

```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
PROMETHEUS_URL=http://your-prometheus-server:9090
METRICS_INTERVAL=30
```

### 3. 运行项目

**开发模式（同时启动前端和后端）：**

```bash
npm run dev
```

**分别启动：**

```bash
# 前端（端口 5173）
npm run dev:frontend

# 后端（端口 5000）
cd backend
python app.py
```

### 4. 访问

打开浏览器访问 http://localhost:5173

## 项目结构

```
navimow-observability/
├── backend/
│   ├── app.py              # Flask 主应用
│   ├── database.py         # TinyDB 数据库操作
│   ├── prometheus_service.py # Prometheus 指标查询
│   ├── requirements.txt    # Python 依赖
│   ├── data.json          # TinyDB 数据文件（运行时生成）
│   └── layout.json        # 布局配置（运行时生成）
├── src/
│   ├── App.tsx            # 主应用组件
│   ├── components/        # UI 组件
│   │   ├── Sidebar.tsx    # 侧边栏详情
│   │   ├── LayoutControls.tsx # 布局控制按钮
│   │   └── LoadingOverlay.tsx
│   ├── nodes/             # React Flow 节点
│   │   └── JavaProcessNode.tsx
│   └── types/             # TypeScript 类型定义
├── config/                # 构建配置
└── package.json
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/vms` | GET | 获取所有 VM 数据 |
| `/api/metrics` | GET | 获取所有指标数据 |
| `/api/prometheus/status` | GET | 检查 Prometheus 状态 |
| `/api/layout` | GET/POST/DELETE | 布局管理 |

## 数据更新频率

- VM 数据：每 30 分钟从 Azure 同步
- 指标数据：每 30 秒从 Prometheus 同步
- 前端轮询：与后端同步频率一致

## 生产部署

参考 Linux 部署步骤：

1. 构建前端：`npm run build`
2. 使用 systemd 管理后端服务
3. 使用 nginx 代理前端静态文件和 API 请求

## License

MIT
