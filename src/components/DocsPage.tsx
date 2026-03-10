import { Link } from 'react-router-dom';
import './DocsPage.css';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  params?: { name: string; type: string; description: string }[];
  body?: string;
  response: string;
}

const endpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/<env>/vms',
    description: 'Get all VMs and services for a specific environment.',
    params: [{ name: 'env', type: 'path', description: 'Environment name (dev, fra, release)' }],
    response: `{
  "services": [
    {
      "service": "gateway",
      "businessOwner": "navimow",
      "resourceGroup": "rg-navimow-dev",
      "location": "westeurope",
      "jenkinsJob": "gateway-deploy",
      "vms": [
        {
          "name": "vm-gateway-01",
          "ip": "10.0.1.4",
          "coreCount": 4,
          "memory": "16GB",
          "os": "UbuntuServer 20.04-LTS",
          "status": "running",
          "subscriptionId": "...",
          "resourceGroup": "rg-navimow-dev"
        }
      ]
    }
  ],
  "environment": "dev"
}`,
  },
  {
    method: 'GET',
    path: '/api/<env>/metrics',
    description: 'Get Prometheus metrics grouped by VM IP address.',
    params: [{ name: 'env', type: 'path', description: 'Environment name (dev, fra, release)' }],
    response: `{
  "10.0.1.4": {
    "cpu_usage": 45.2,
    "memory_usage": 62.8,
    "disk_usage": 33.1,
    "network_in": 1024000,
    "network_out": 512000
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/<env>/layout',
    description: 'Get saved ReactFlow layout (node positions and edges) for an environment.',
    params: [{ name: 'env', type: 'path', description: 'Environment name' }],
    response: `{
  "nodes": [{ "id": "gateway", "position": { "x": 100, "y": 200 }, ... }],
  "edges": [{ "id": "e1", "source": "gateway", "target": "nacos" }]
}`,
  },
  {
    method: 'POST',
    path: '/api/<env>/layout',
    description: 'Save ReactFlow layout for an environment.',
    params: [{ name: 'env', type: 'path', description: 'Environment name' }],
    body: `{
  "nodes": [...],
  "edges": [...]
}`,
    response: `{ "success": true, "environment": "dev" }`,
  },
  {
    method: 'DELETE',
    path: '/api/<env>/layout',
    description: 'Delete saved layout for an environment, reverting to auto-layout.',
    params: [{ name: 'env', type: 'path', description: 'Environment name' }],
    response: `{ "success": true, "environment": "dev" }`,
  },
  {
    method: 'PUT',
    path: '/api/<env>/services/<service_name>/jenkins',
    description: 'Associate a Jenkins job with a service.',
    params: [
      { name: 'env', type: 'path', description: 'Environment name' },
      { name: 'service_name', type: 'path', description: 'Service name to update' },
    ],
    body: `{ "jenkinsJob": "my-deploy-job" }`,
    response: `{ "success": true }`,
  },
  {
    method: 'GET',
    path: '/api/prometheus/status',
    description: 'Check whether Prometheus is reachable and return its URL.',
    response: `{
  "available": true,
  "url": "http://prometheus.internal:9090"
}`,
  },
  {
    method: 'GET',
    path: '/api/environments',
    description: 'List all available environments and the default.',
    response: `{
  "environments": ["dev", "fra", "release"],
  "default": "dev"
}`,
  },
  {
    method: 'GET',
    path: '/api/jenkins/builds',
    description: 'Get all Jenkins job build information from the database.',
    response: `{
  "jobs": [
    {
      "name": "gateway-deploy",
      "url": "https://jenkins.example.com/job/gateway-deploy/",
      "color": "blue",
      "lastBuild": { "number": 42, "result": "SUCCESS", "timestamp": 1700000000000 },
      "lastSuccessfulBuild": { ... },
      "lastFailedBuild": { ... }
    }
  ],
  "last_updated": "2024-01-15T10:30:00"
}`,
  },
  {
    method: 'GET',
    path: '/api/jenkins/job/<job_name>',
    description: 'Get detailed information for a specific Jenkins job by name.',
    params: [{ name: 'job_name', type: 'path', description: 'Jenkins job name' }],
    response: `{
  "job": {
    "name": "gateway-deploy",
    "color": "blue",
    "lastBuild": { "number": 42, "result": "SUCCESS", ... }
  },
  "last_updated": "2024-01-15T10:30:00"
}`,
  },
];

const sections = [
  { id: 'overview', label: '系统概述' },
  { id: 'architecture', label: '架构与数据流' },
  { id: 'api', label: 'API 端点' },
  { id: 'structure', label: '项目结构' },
  { id: 'storage', label: '数据存储' },
  { id: 'frontend', label: '前端组织' },
];

export function DocsPage() {
  return (
    <div className="docs-page">
      {/* TOC Sidebar */}
      <nav className="docs-toc">
        <div className="docs-toc__header">
          <span className="docs-toc__title">文档</span>
        </div>
        <Link to="/" className="docs-toc__back">&#8592; 返回仪表盘</Link>
        <div className="docs-toc__nav">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="docs-toc__link">{s.label}</a>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="docs-content">
        <div className="docs-content__inner">

          {/* System Overview */}
          <section id="overview" className="docs-section">
            <h2>系统概述</h2>
            <p>
              Navimow Observability 是一个实时基础设施监控仪表盘，用于可视化 Azure 虚拟机、
              Prometheus 指标和 Jenkins 构建状态。系统以交互式拓扑图的形式展示服务及其关联的 VM，
              支持多环境切换、按业务方过滤，以及自定义布局的保存与恢复。
            </p>
            <h3>技术栈</h3>
            <div className="tech-badges">
              <span className="tech-badge">React 19</span>
              <span className="tech-badge">TypeScript</span>
              <span className="tech-badge">ReactFlow</span>
              <span className="tech-badge">Vite 7</span>
              <span className="tech-badge">Flask</span>
              <span className="tech-badge">TinyDB</span>
              <span className="tech-badge">Prometheus</span>
              <span className="tech-badge">Azure SDK</span>
              <span className="tech-badge">Jenkins API</span>
            </div>
          </section>

          {/* Architecture */}
          <section id="architecture" className="docs-section">
            <h2>架构与数据流</h2>
            <p>后端通过后台线程定期从外部数据源拉取数据，存入 TinyDB，前端通过 REST API 读取。</p>
            <div className="code-block">{`┌─────────────────────────────────────────────────────────────┐
│                      Data Sources                           │
│  ┌──────────┐   ┌────────────┐   ┌──────────┐              │
│  │ Azure SDK │   │ Prometheus │   │ Jenkins  │              │
│  └─────┬────┘   └─────┬──────┘   └─────┬────┘              │
└────────┼──────────────┼────────────────┼────────────────────┘
         │              │                │
         ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│              Flask Backend (Background Threads)              │
│                                                              │
│  background_vm_fetch()    every 30 min                       │
│  background_metrics_fetch()  every 20 sec                    │
│  background_jenkins_fetch()  every 30 sec                    │
│                                                              │
│  ┌────────────────────────────────┐                          │
│  │  TinyDB (per-env JSON files)  │                          │
│  │  data_dev.json                │                          │
│  │  data_fra.json                │                          │
│  │  data_release.json            │                          │
│  └───────────────┬───────────────┘                          │
│                  │                                            │
│           REST API Endpoints                                 │
│      /api/<env>/vms, /metrics, etc.                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  React Frontend                              │
│                                                              │
│  EnvironmentContext  →  App  →  ReactFlow Canvas             │
│                                                              │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐               │
│  │LeftNavPanel│  │ ServiceNode│  │  Sidebar  │               │
│  │(env/filter)│  │  (VM node) │  │ (details) │               │
│  └──────────┘  └────────────┘  └───────────┘               │
└─────────────────────────────────────────────────────────────┘`}</div>
          </section>

          {/* API Endpoints */}
          <section id="api" className="docs-section">
            <h2>API 端点</h2>
            <p>所有 API 端点均以 <code>/api/</code> 为前缀。环境相关端点使用 <code>&lt;env&gt;</code> 路径参数。</p>
            {endpoints.map((ep, i) => (
              <div key={i} className="endpoint-card">
                <div className="endpoint-card__header">
                  <span className={`method-badge method-badge--${ep.method.toLowerCase()}`}>
                    {ep.method}
                  </span>
                  <span className="endpoint-card__path">{ep.path}</span>
                </div>
                <div className="endpoint-card__desc">{ep.description}</div>
                {ep.params && (
                  <table className="params-table">
                    <thead>
                      <tr><th>参数</th><th>类型</th><th>说明</th></tr>
                    </thead>
                    <tbody>
                      {ep.params.map((p) => (
                        <tr key={p.name}>
                          <td><code>{p.name}</code></td>
                          <td>{p.type}</td>
                          <td>{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {ep.body && (
                  <>
                    <h4 style={{ margin: '8px 0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>请求体</h4>
                    <div className="code-block">{ep.body}</div>
                  </>
                )}
                <h4 style={{ margin: '8px 0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>响应示例</h4>
                <div className="code-block">{ep.response}</div>
              </div>
            ))}
          </section>

          {/* Project Structure */}
          <section id="structure" className="docs-section">
            <h2>项目结构</h2>
            <div className="file-tree">
{`navimow-observability/
├── backend/
│   ├── app.py                  `}<span className="file-tree__comment"># Flask 主应用 & API 路由</span>{`
│   ├── database.py             `}<span className="file-tree__comment"># TinyDB 读写操作</span>{`
│   ├── prometheus_service.py   `}<span className="file-tree__comment"># Prometheus 查询封装</span>{`
│   ├── environment_config.py   `}<span className="file-tree__comment"># 环境配置 & 服务过滤</span>{`
│   ├── data_dev.json           `}<span className="file-tree__comment"># Dev 环境数据</span>{`
│   ├── data_fra.json           `}<span className="file-tree__comment"># Fra 环境数据</span>{`
│   └── data_release.json       `}<span className="file-tree__comment"># Release 环境数据</span>{`
├── src/
│   ├── main.tsx                `}<span className="file-tree__comment"># 应用入口 & 路由配置</span>{`
│   ├── App.tsx                 `}<span className="file-tree__comment"># 主仪表盘页面</span>{`
│   ├── index.css               `}<span className="file-tree__comment"># 全局样式 & CSS 变量</span>{`
│   ├── components/
│   │   ├── LeftNavPanel.tsx     `}<span className="file-tree__comment"># 左侧导航面板</span>{`
│   │   ├── Sidebar.tsx         `}<span className="file-tree__comment"># 右侧详情边栏</span>{`
│   │   ├── EnvironmentSelector `}<span className="file-tree__comment"># 环境切换器</span>{`
│   │   ├── BusinessOwnerNav    `}<span className="file-tree__comment"># 业务方过滤器</span>{`
│   │   ├── LayoutControls      `}<span className="file-tree__comment"># 布局保存/重置</span>{`
│   │   ├── LoadingOverlay      `}<span className="file-tree__comment"># 加载动画</span>{`
│   │   └── DocsPage.tsx        `}<span className="file-tree__comment"># 本文档页面</span>{`
│   ├── nodes/                  `}<span className="file-tree__comment"># ReactFlow 自定义节点</span>{`
│   ├── context/
│   │   └── EnvironmentContext  `}<span className="file-tree__comment"># 环境状态管理</span>{`
│   └── types/                  `}<span className="file-tree__comment"># TypeScript 类型定义</span>{`
├── config/
│   ├── vite.config.ts          `}<span className="file-tree__comment"># Vite 构建配置</span>{`
│   └── eslint.config.js        `}<span className="file-tree__comment"># ESLint 配置</span>{`
├── package.json
└── start.sh                    `}<span className="file-tree__comment"># 生产环境启动脚本</span>
            </div>
          </section>

          {/* Data Storage */}
          <section id="storage" className="docs-section">
            <h2>数据存储</h2>
            <p>
              系统使用 TinyDB 作为轻量级 JSON 文件数据库。每个环境对应独立的数据文件，
              后台线程定期更新数据。
            </p>
            <h3>数据文件</h3>
            <ul>
              <li><code>data_dev.json</code> / <code>data_fra.json</code> / <code>data_release.json</code> — 各环境 VM 与指标数据</li>
              <li><code>layout_dev.json</code> / <code>layout_fra.json</code> / <code>layout_release.json</code> — 各环境的保存布局</li>
              <li><code>jenkins_data.json</code> — Jenkins 构建数据（所有环境共享）</li>
            </ul>
            <h3>数据结构</h3>
            <p>每个环境数据文件包含以下表：</p>
            <div className="code-block">{`TinyDB 表结构:
┌─────────────┬─────────────────────────────────────┐
│ 表名         │ 内容                                │
├─────────────┼─────────────────────────────────────┤
│ vm_data     │ Azure VM 信息 (service, vms, owner) │
│ metrics     │ Prometheus 指标 (按 IP 分组)         │
└─────────────┴─────────────────────────────────────┘

Jenkins 数据 (jenkins_data.json):
┌─────────────┬─────────────────────────────────────┐
│ 字段         │ 说明                                │
├─────────────┼─────────────────────────────────────┤
│ jobs        │ Jenkins 任务列表                     │
│ last_updated│ 最后更新时间                         │
└─────────────┴─────────────────────────────────────┘`}</div>
            <h3>更新频率</h3>
            <ul>
              <li>Azure VM 数据: 每 30 分钟</li>
              <li>Prometheus 指标: 每 20 秒（可通过 <code>METRICS_INTERVAL</code> 环境变量配置）</li>
              <li>Jenkins 构建: 每 30 秒（可通过 <code>JENKINS_INTERVAL</code> 环境变量配置）</li>
            </ul>
          </section>

          {/* Frontend Organization */}
          <section id="frontend" className="docs-section">
            <h2>前端组织</h2>

            <h3>组件目录 (src/components/)</h3>
            <ul>
              <li><code>LeftNavPanel</code> — 左侧导航面板，包含环境选择、业务方过滤和布局控制</li>
              <li><code>EnvironmentSelector</code> — 环境切换下拉菜单 (dev / fra / release)</li>
              <li><code>BusinessOwnerNav</code> — 按业务方（proj 标签）过滤服务</li>
              <li><code>LayoutControls</code> — 保存、重置和刷新布局的按钮组</li>
              <li><code>Sidebar</code> — 右侧详情面板，展示选中服务/VM 的详细信息和指标</li>
              <li><code>LoadingOverlay</code> — 数据加载时的全屏覆盖动画</li>
              <li><code>DocsPage</code> — 本文档页面</li>
            </ul>

            <h3>节点目录 (src/nodes/)</h3>
            <p>
              ReactFlow 自定义节点，用于在拓扑图中渲染服务和 VM。
              每个节点类型都有独立的组件文件和样式。
            </p>

            <h3>上下文目录 (src/context/)</h3>
            <ul>
              <li><code>EnvironmentContext</code> — 全局环境状态管理，提供当前环境和切换方法。所有需要环境感知的组件都通过此 Context 获取状态。</li>
            </ul>

            <h3>类型目录 (src/types/)</h3>
            <p>
              TypeScript 类型定义，包括 VM、Service、Metrics 等数据结构接口。
              在组件间共享类型，确保类型安全。
            </p>
          </section>

        </div>
      </main>
    </div>
  );
}
