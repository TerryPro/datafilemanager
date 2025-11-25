# JupyterLab 单元格 AI 辅助按钮设计方案

## 目标
 - 在 Notebook 单元格操作栏中新增“AI”按钮，集成 LLM 辅助编写代码。
 - 根据当前单元内容与用户意图生成建议代码，支持预览、插入/替换、可选自动执行。

## 用户体验
 - 单元格工具栏新增按钮：`AI`
 - 点击后打开轻量对话框（或右侧面板），包含：
   - 输入框：描述希望实现的意图（中文/英文）
   - 选项：生成模式（替换当前单元、在下方插入、追加到末尾、仅注释解释）
   - 开关：是否自动执行（默认关闭）
 - 响应区展示 LLM 建议代码与简要说明，提供“应用更改”“复制”“重新生成”。
 - 快捷键：`Alt + A` 打开 AI 面板。

## 技术架构
 - 前端（JupyterLab 扩展，TypeScript）
   - 在 Notebook 单元格工具栏注册 AI 按钮，采集上下文、调用后端接口、渲染响应并应用到 Notebook。
   - 组件：轻量对话框（Dialog）或右侧 `MainAreaWidget` 面板。
 - 后端（Jupyter Server 扩展，Python）
   - 暴露 REST 路由：`POST /aiassist/generate`。
   - 统一 Provider 适配层支持 OpenAI/Claude/Gemini/Azure/Ollama 等。

## 前端实现
 - 依赖接口
   - `@jupyterlab/notebook` 获取 `NotebookPanel`、`activeCell`。
   - `@jupyterlab/apputils` 使用 `Dialog`, `ToolbarRegistry`, `showErrorMessage`。
 - 命令与按钮
   - `aiassist:open` 打开对话框；`aiassist:apply` 应用建议；`aiassist:run` 可选执行。
 - 上下文收集策略
   - 语言：从 `panel.sessionContext.session.kernel.name` 推断（示例：`python3`）。
   - 代码：当前单元源码；可选拼接前后各 N 个单元（限制长度）。
   - 补充：Notebook 标题、目录、`dataset` 路径提示、已导入模块（解析 `import`）。
 - 应用逻辑
   - 替换/插入/追加：更新 `sharedModel.setSource`；可选 `notebook:run-cell` 自动执行。

## 后端接口设计
 - 路由：`POST /aiassist/generate`
 - 请求体
   - `model: string`（模型名）
   - `language: string`（如 `python`）
   - `source: string`（当前单元内容）
   - `context: { prev?: string[], next?: string[] }`
   - `intent: string`（用户意图）
   - `options: { temperature?: number, max_tokens?: number, mode?: 'replace'|'insert'|'append'|'explain' }`
 - 响应体
   - `suggestion: string`（生成代码）
   - `explanation: string`（简要说明）
   - `usage: { input_tokens?: number, output_tokens?: number, latency_ms?: number }`
 - Provider 适配层
   - `BaseLLMProvider.generate(prompt, params) -> { suggestion, explanation }`

## Prompt 规范
 - 系统指令：你是专业 Jupyter 开发助手，遵循 Python 规范，使用中文函数级注释。
 - 用户意图：直接注入。
 - 上下文：当前代码、依赖、路径约束（`dataset`）。
 - 输出要求：仅返回代码片段；遵循选择的模式（替换/插入/追加）。

## 安全与配置
 - 密钥管理：通过环境变量配置 `AI_API_KEY`，后端读取，不在前端暴露。
 - 访问控制：模型白名单与速率限制（如每用户每分钟 20 次）。
 - 隐私：默认仅上传当前单元与少量上下文；提供“严格隐私”开关。

## 错误处理
 - 连接失败：提示“LLM 接口不可用”，支持重试。
 - 响应异常：显示简短错误并保留用户输入；后端记录日志。
 - 模型超时：提示裁剪上下文或重试。

## 性能与限流
 - 前端：请求取消令牌、防抖；最小渲染。
 - 后端：上下文裁剪（如最大 200 行）、可选响应缓存。

## 兼容性
 - 适配 JupyterLab 4.x 单元格工具栏机制。
 - 首期支持 Python；其他语言（`ir`、`js`）提示暂不支持，可规划扩展。

## 验收测试
 - 正常流程：打开 Notebook → 选中代码单元 → 点击 AI → 输入“合并 dataset 下 CSV 并显示前 20 行” → 选择“在下方插入并运行”，生成并执行。
 - 异常场景：无 API Key/断网/内核不可用，提示错误并可重试。
 - 隐私场景：严格隐私时只上传当前单元内容。

## 实施步骤
 1) 前端：注册按钮与命令，开发对话框组件与应用逻辑；封装 `aiassistClient`。
 2) 后端：实现 `POST /aiassist/generate` 路由与 Provider 适配层；读取密钥、限流与日志。
 3) 集成验证：在本地 `.venv` 激活后 `npm run build`、`jupyter labextension develop . --overwrite`、`jupyter lab`。
 4) 文档与示例：提供最小示例与常见问题（API Key、隐私、上下文长度）。

## 后续扩展
 - 支持流式生成（前端渐进显示）。
 - 代码差异高亮与一键回滚。
 - 模型与参数在 UI 中可切换（温度、最大 Token）。
 - 多语言支持与 Notebook 元数据记忆用户偏好。