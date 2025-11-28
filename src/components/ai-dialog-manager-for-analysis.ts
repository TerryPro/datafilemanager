import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel } from '@jupyterlab/notebook';
import { showErrorMessage } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';

/**
 * 数据分析AI对话框管理器类
 * 负责创建和管理数据分析AI对话框的UI和交互逻辑
 */
export class AiDialogManagerForAnalysis {
    constructor(private app: JupyterFrontEnd) {}

    /**
     * 打开数据分析AI对话框：采集用户意图，获取DataFrame元数据，生成分析代码
     */
    async openAnalysisDialog(panel: NotebookPanel, dfName: string): Promise<void> {
        // 创建主对话框内容
        const body = document.createElement('div');
        body.className = 'aiassist-analysis-dialog-body';
        body.style.cssText = `
            font-family: var(--jp-ui-font-family);
            color: var(--jp-ui-font-color1);
            min-width: 600px;
        `;

        // 创建各个字段容器，统一样式
        const createFieldContainer = (labelText: string) => {
            const container = document.createElement('div');
            container.style.cssText = `
                margin-bottom: 20px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            `;
            
            const label = document.createElement('label');
            label.textContent = labelText;
            label.style.cssText = `
                font-weight: 600;
                font-size: 14px;
                color: var(--jp-ui-font-color1);
            `;
            
            container.appendChild(label);
            return { container, label };
        };

        // DataFrame信息显示区域
        const { container: fieldDfInfo } = createFieldContainer(`DataFrame: ${dfName}`);
        const dfInfoDisplay = document.createElement('div');
        dfInfoDisplay.className = 'df-info-display';
        dfInfoDisplay.style.cssText = `
            width: 100%;
            padding: 12px;
            border: 1px solid var(--jp-border-color2);
            border-radius: 6px;
            background: var(--jp-layout-color2);
            color: var(--jp-ui-font-color1);
            font-size: 14px;
            font-family: var(--jp-ui-font-family);
            line-height: 1.5;
            white-space: pre-wrap;
            overflow-y: auto;
            max-height: 150px;
        `;
        dfInfoDisplay.textContent = '正在获取DataFrame信息...';
        fieldDfInfo.appendChild(dfInfoDisplay);

        // 意图描述输入区域
        const { container: fieldIntent } = createFieldContainer('分析意图');
        const intentInput = document.createElement('textarea');
        intentInput.className = 'ai-textarea';
        intentInput.rows = 4;
        intentInput.placeholder = '例如：分析这个数据集的基本统计信息，找出异常值，并生成可视化图表';
        intentInput.style.cssText = `
            width: 100%;
            padding: 12px;
            border: 1px solid var(--jp-border-color2);
            border-radius: 6px;
            font-size: 14px;
            font-family: var(--jp-ui-font-family);
            resize: vertical;
            min-height: 80px;
            background: var(--jp-layout-color1);
            color: var(--jp-ui-font-color1);
        `;
        fieldIntent.appendChild(intentInput);

        // 选项区域
        const { container: fieldRun } = createFieldContainer('');
        fieldRun.style.marginBottom = '24px';
        const autoRunContainer = document.createElement('div');
        autoRunContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            background: var(--jp-layout-color2);
            border-radius: 6px;
        `;
        const autoRun = document.createElement('input');
        autoRun.type = 'checkbox';
        autoRun.checked = true; // 默认勾选
        autoRun.style.cssText = `
            width: 18px;
            height: 18px;
            cursor: pointer;
        `;
        const autoRunText = document.createElement('span');
        autoRunText.textContent = '自动执行生成后的分析代码';
        autoRunText.style.cssText = `
            font-size: 14px;
            color: var(--jp-ui-font-color1);
            cursor: pointer;
        `;
        autoRunContainer.appendChild(autoRun);
        autoRunContainer.appendChild(autoRunText);
        fieldRun.appendChild(autoRunContainer);

        // 预览区域
        const { container: fieldPreview } = createFieldContainer('生成的分析代码');
        fieldPreview.style.marginBottom = '24px';
        const preview = document.createElement('div');
        preview.className = 'ai-preview';
        preview.style.cssText = `
            width: 100%;
            height: 180px;
            padding: 12px;
            border: 1px solid var(--jp-border-color2);
            border-radius: 6px;
            background: var(--jp-layout-color1);
            color: var(--jp-ui-font-color1);
            font-family: var(--jp-code-font-family);
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            overflow-y: auto;
            resize: vertical;
        `;
        preview.textContent = '点击"生成分析代码"按钮生成代码...';
        fieldPreview.appendChild(preview);

        // 按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid var(--jp-border-color2);
        `;
        
        const generateBtn = document.createElement('button');
        generateBtn.textContent = '生成分析代码';
        generateBtn.className = 'jp-Button jp-mod-accept';
        generateBtn.disabled = false;
        generateBtn.style.cssText = `
            min-width: 120px;
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 600;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.className = 'jp-Button jp-mod-allow';
        closeBtn.style.cssText = `
            min-width: 80px;
            padding: 10px 20px;
            font-size: 14px;
        `;
        
        buttonContainer.appendChild(generateBtn);
        buttonContainer.appendChild(closeBtn);

        // 组装所有元素
        body.appendChild(fieldDfInfo);
        body.appendChild(fieldIntent);
        body.appendChild(fieldRun);
        body.appendChild(fieldPreview);
        body.appendChild(buttonContainer);

        const bodyWidget = new Widget();
        bodyWidget.node.appendChild(body);

        // 创建模态对话框
        const dialog = document.createElement('div');
        dialog.style.position = 'fixed';
        dialog.style.top = '0';
        dialog.style.left = '0';
        dialog.style.width = '100%';
        dialog.style.height = '100%';
        dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        dialog.style.display = 'flex';
        dialog.style.alignItems = 'center';
        dialog.style.justifyContent = 'center';
        dialog.style.zIndex = '1000';

        // 创建对话框内容容器
        const dialogContent = document.createElement('div');
        dialogContent.style.backgroundColor = 'white';
        dialogContent.style.padding = '20px';
        dialogContent.style.borderRadius = '8px';
        dialogContent.style.maxWidth = '800px';
        dialogContent.style.maxHeight = '80vh';
        dialogContent.style.overflow = 'auto';
        dialogContent.appendChild(body);

        dialog.appendChild(dialogContent);
        document.body.appendChild(dialog);

        // 获取DataFrame元数据
        this.fetchDataFrameMetadata(panel, dfName).then(metadata => {
            if (metadata && !metadata.error) {
                // 处理数据类型显示
                let dtypesText = '未知';
                if (metadata.dtypes) {
                    if (typeof metadata.dtypes === 'object') {
                        // 如果是对象，转换为每行一个列名的格式
                        dtypesText = Object.entries(metadata.dtypes)
                            .map(([col, dtype]) => `${col}: ${dtype}`)
                            .join('\n');
                    } else if (Array.isArray(metadata.dtypes)) {
                        // 如果是数组，直接连接
                        dtypesText = metadata.dtypes.join('\n');
                    }
                }
                
                dfInfoDisplay.textContent = `形状: ${metadata.shape ? metadata.shape.join(' x ') : '未知'}\n列名: ${metadata.columns ? metadata.columns.join(', ') : '未知'}\n数据类型:\n${dtypesText}`;
            } else {
                dfInfoDisplay.textContent = `无法获取DataFrame信息: ${metadata?.error || '未知错误'}`;
            }
        });

        // 生成按钮点击事件
        generateBtn.addEventListener('click', async () => {
            if (!intentInput.value.trim()) {
                preview.textContent = '请先输入分析意图';
                return;
            }
            
            // 显示加载状态
            generateBtn.disabled = true;
            generateBtn.textContent = '生成中...';
            preview.textContent = '正在生成分析代码，请稍候...';
            
            try {
                // 获取DataFrame元数据
                const metadata = await this.fetchDataFrameMetadata(panel, dfName);
                
                // 构建请求载荷
                const payload = {
                    dfName: dfName,
                    intent: intentInput.value,
                    metadata: metadata,
                    options: {
                        autoRun: autoRun.checked,
                        privacy: 'normal'
                    }
                };
                
                // 发送请求到后端API
                const aiResp = await this.requestAnalysisCode(payload);
                
                // 显示生成的代码或错误信息
                if (aiResp.error) {
                    preview.textContent = `错误: ${aiResp.error}\n\n建议代码:\n${aiResp.suggestion || ''}`;
                } else {
                    preview.textContent = aiResp.suggestion || '';
                }
                
                // 生成完成后，更改按钮状态显示可以应用
                generateBtn.textContent = '应用';
                generateBtn.className = 'jp-Button jp-mod-accept';
                generateBtn.disabled = false;
                
                // 应用按钮点击事件
                generateBtn.onclick = async () => {
                    if (aiResp.suggestion) {
                        try {
                            await this.applyAnalysisCode(panel, aiResp.suggestion, autoRun.checked);
                            // 关闭对话框
                            dialog.remove();
                        } catch (error) {
                            preview.textContent += `\n\n应用失败: ${error instanceof Error ? error.message : '未知错误'}`;
                        }
                    }
                };
                
            } catch (error) {
                preview.textContent = `生成失败: ${error instanceof Error ? error.message : '未知错误'}`;
                generateBtn.textContent = '生成分析代码';
                generateBtn.disabled = false;
            }
        });

        // 关闭按钮点击事件
        closeBtn.addEventListener('click', () => {
            dialog.remove();
        });

        // 防止对话框外点击关闭（模态效果）
        dialog.addEventListener('click', (event) => {
            // 只在点击背景时才阻止事件传播，点击内容区域不处理
            if (event.target === dialog) {
                event.preventDefault();
                event.stopPropagation();
            }
        });

        // 对话框已创建并显示
    }

    /**
     * 获取DataFrame的元数据
     */
    private async fetchDataFrameMetadata(panel: NotebookPanel, dfName: string): Promise<any> {
        if (!panel.sessionContext.session?.kernel) {
            return { error: "No active kernel" };
        }

        const code = [
            'import json',
            'try:',
            '  import pandas as pd',
            'except Exception as e:',
            '  print(json.dumps({"error": f"pandas not available: {e}"}))',
            'else:',
            `  _df_name = r'${dfName}'`,
            '  _df = globals().get(_df_name)',
            '  if _df is None or not isinstance(_df, pd.DataFrame):',
            '    print(json.dumps({"error": f"DataFrame {_df_name} not found or not a DataFrame"}))',
            '  else:',
            '    _metadata = {',
            '      "name": _df_name,',
            '      "shape": list(_df.shape),',
            '      "columns": list(_df.columns),',
            '      "dtypes": {col: str(_df[col].dtype) for col in _df.columns}',
            '    }',
            '    print(json.dumps(_metadata))'
        ].join('\n');

        const future = panel.sessionContext.session.kernel.requestExecute({ code, stop_on_error: true });
        let output = '';
        let errorMsg = '';
        
        await new Promise<void>(resolve => {
            future.onIOPub = msg => {
                const t = (msg as any).header.msg_type;
                const c = (msg as any).content;
                if (t === 'stream' && c.text) {
                    output += c.text as string;
                } else if ((t === 'execute_result' || t === 'display_data') && c.data && c.data['text/plain']) {
                    output += c.data['text/plain'] as string;
                } else if (t === 'error') {
                    errorMsg = c.evalue || 'Unknown error';
                }
            };
            future.onReply = () => resolve();
        });
        
        try {
            const trimmedOutput = output.trim();
            if (trimmedOutput) {
                const parsed = JSON.parse(trimmedOutput);
                return parsed;
            } else if (errorMsg) {
                return { error: errorMsg };
            } else {
                return { error: "No output received from kernel" };
            }
        } catch (e) {
            return { error: `Failed to parse metadata: ${e instanceof Error ? e.message : 'Unknown error'}` };
        }
    }

    /**
     * 请求后端生成分析代码
     */
    private async requestAnalysisCode(payload: any): Promise<{ suggestion: string; explanation?: string; error?: string }> {
        try {
            const resp = await fetch('/aiserver/analyze-dataframe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                return await resp.json();
            } else {
                // 尝试解析错误响应
                try {
                    const errorData = await resp.json();
                    return { 
                        suggestion: errorData.suggestion || '# 示例：打印DataFrame基本信息\nprint(df.info())\nprint(df.describe())', 
                        explanation: errorData.explanation || '后端返回错误',
                        error: errorData.error || `HTTP ${resp.status}: ${resp.statusText}`
                    };
                } catch {
                    return { 
                        suggestion: '# 示例：打印DataFrame基本信息\nprint(df.info())\nprint(df.describe())', 
                        explanation: '后端返回错误',
                        error: `HTTP ${resp.status}: ${resp.statusText}`
                    };
                }
            }
        } catch (error) {
            return { 
                suggestion: '# 示例：打印DataFrame基本信息\nprint(df.info())\nprint(df.describe())', 
                explanation: '网络错误或后端未启动',
                error: error instanceof Error ? error.message : '未知错误'
            };
        }
    }

    /**
     * 应用分析代码到Notebook，并可选执行
     * 若当前活动代码单元为空，则直接覆盖并可选执行；否则在其下方插入新单元并应用
     */
    private async applyAnalysisCode(panel: NotebookPanel, code: string, autoRun: boolean): Promise<void> {
        const content = panel.content;
        const cell = content.activeCell;
        if (cell && cell.model.type === 'code') {
            const src = (cell.model.sharedModel.getSource() || '').trim();
            if (src.length === 0) {
                cell.model.sharedModel.setSource(code);
                if (autoRun) {
                    await this.app.commands.execute('notebook:run-cell');
                }
                return;
            }
        }
        // 当前单元格非空或不存在，插入并应用到新单元
        await this.app.commands.execute('notebook:insert-cell-below');
        if (content.activeCell && content.activeCell.model.type === 'code') {
            content.activeCell.model.sharedModel.setSource(code);
            if (autoRun) {
                await this.app.commands.execute('notebook:run-cell');
            }
        } else {
            showErrorMessage('错误', '无法找到活动的Notebook单元格');
        }
    }
}
