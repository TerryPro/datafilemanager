import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel } from '@jupyterlab/notebook';
import { showErrorMessage } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';

/**
 * AI对话框管理器类
 * 负责创建和管理AI对话框的UI和交互逻辑
 */
export class AiDialogManager {
    constructor(private app: JupyterFrontEnd) { }

    /**
     * 打开AI对话框：采集用户意图与选项，生成建议并提供应用入口
     */
    async openAiDialog(panel: NotebookPanel): Promise<void> {
        const cell = panel.content.activeCell;
        if (!cell || cell.model.type !== 'code') {
            await showErrorMessage('AI Assist', '请选中一个代码单元');
            return;
        }
        const source = cell.model.sharedModel.getSource();

        // 创建主对话框内容
        const body = document.createElement('div');
        body.className = 'aiassist-dialog-body';
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

        // 意图描述输入区域
        const { container: fieldIntent } = createFieldContainer('意图描述');
        const intentInput = document.createElement('textarea');
        intentInput.className = 'ai-textarea';
        intentInput.rows = 4;
        intentInput.placeholder = '例如：读取 dataset 下所有 CSV 合并为一个 DataFrame 并显示前 20 行';
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

        // 生成模式选择区域
        const { container: fieldMode } = createFieldContainer('生成模式');
        const modeSelect = document.createElement('select');
        modeSelect.className = 'ai-select';
        modeSelect.style.cssText = `
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--jp-border-color2);
            border-radius: 6px;
            font-size: 14px;
            background: var(--jp-layout-color1);
            color: var(--jp-ui-font-color1);
            cursor: pointer;
        `;
        [
            { value: 'replace', label: '代码生成' },
            { value: 'fix', label: '代码修复' },
            { value: 'explain', label: '代码总结' }
        ].forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.value; opt.textContent = item.label;
            modeSelect.appendChild(opt);
        });

        const modeDesc = document.createElement('div');
        modeDesc.style.cssText = `
            font-size: 13px;
            color: var(--jp-ui-font-color2);
            padding: 8px 12px;
            background: var(--jp-layout-color2);
            border-radius: 4px;
            border-left: 3px solid var(--jp-brand-color1);
        `;

        const updateDesc = () => {
            const v = modeSelect.value;
            const map: Record<string, string> = {
                replace: '用生成代码替换当前单元内容',
                fix: '分析错误信息并修复当前代码',
                explain: '生成对当前代码的中文说明，不改动代码'
            };
            modeDesc.textContent = map[v] || '';
        };
        modeSelect.addEventListener('change', updateDesc);
        updateDesc();

        fieldMode.appendChild(modeSelect);
        fieldMode.appendChild(modeDesc);

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
        autoRun.style.cssText = `
            width: 18px;
            height: 18px;
            cursor: pointer;
        `;
        const autoRunText = document.createElement('span');
        autoRunText.textContent = '自动执行生成后的代码';
        autoRunText.style.cssText = `
            font-size: 14px;
            color: var(--jp-ui-font-color1);
            cursor: pointer;
        `;
        autoRunContainer.appendChild(autoRun);
        autoRunContainer.appendChild(autoRunText);
        fieldRun.appendChild(autoRunContainer);

        // 预览区域
        const { container: fieldPreview } = createFieldContainer('预览');
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
        preview.textContent = '点击"生成"按钮生成代码...';
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
        generateBtn.textContent = '生成';
        generateBtn.className = 'jp-Button jp-mod-accept';
        generateBtn.disabled = false;
        generateBtn.style.cssText = `
            min-width: 100px;
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
        body.appendChild(fieldIntent);
        body.appendChild(fieldMode);
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

        // 生成按钮点击事件
        generateBtn.addEventListener('click', async () => {
            if (!intentInput.value.trim()) {
                preview.textContent = '请先输入意图描述';
                return;
            }

            // 显示加载状态
            generateBtn.disabled = true;
            generateBtn.textContent = '生成中...';
            preview.textContent = '正在生成代码，请稍候...';

            try {
                const payload = this.buildAiRequestPayload(panel, source, intentInput.value, modeSelect.value, autoRun.checked);
                const aiResp = await this.requestGenerate(payload);

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
                            await this.applySuggestion(panel, aiResp.suggestion, modeSelect.value as 'replace' | 'insert' | 'append' | 'explain', autoRun.checked);
                            // 关闭对话框
                            dialog.remove();
                        } catch (error) {
                            preview.textContent += `\n\n应用失败: ${error instanceof Error ? error.message : '未知错误'}`;
                        }
                    }
                };

            } catch (error) {
                preview.textContent = `生成失败: ${error instanceof Error ? error.message : '未知错误'}`;
                generateBtn.textContent = '生成';
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
     * 构建AI请求载荷
     */
    private buildAiRequestPayload(panel: NotebookPanel, source: string, intent: string, mode: string, autoRun: boolean): any {
        const kernel = panel.sessionContext?.session?.kernel?.name ?? 'python';
        const ctx = this.pickNeighborCells(panel, 2);

        // 如果是修复模式，获取单元格输出（错误信息）
        let output = '';
        if (mode === 'fix') {
            const cell = panel.content.activeCell;
            if (cell && cell.model.type === 'code') {
                const outputs = (cell.model as any).outputs;
                for (let i = 0; i < outputs.length; i++) {
                    const out = outputs.get(i);
                    // 提取错误信息 (stderr) 或 文本输出
                    if (out.type === 'stream' && (out.data as any).name === 'stderr') {
                        output += `[stderr] ${(out.data as any).text}\n`;
                    } else if (out.type === 'error') {
                        output += `[error] ${(out.data as any).ename}: ${(out.data as any).evalue}\n`;
                        if ((out.data as any).traceback) {
                            output += `Traceback:\n${((out.data as any).traceback as string[]).join('\n')}\n`;
                        }
                    } else if (out.type === 'execute_result' || out.type === 'display_data') {
                        // 也可以选择性包含部分正常输出作为上下文
                        if (out.data['text/plain']) {
                            output += `[output] ${out.data['text/plain']}\n`;
                        }
                    }
                }
            }
        }

        return { language: kernel, source, context: ctx, intent, options: { mode, autoRun, privacy: 'normal' }, output };
    }

    /**
     * 邻近单元采样（各最多n个），限制上下文规模
     */
    private pickNeighborCells(panel: NotebookPanel, n: number): { prev: string[]; next: string[] } {
        const content = panel.content;
        const index = content.activeCellIndex;
        const prev: string[] = [];
        const next: string[] = [];
        const model = content.model;
        if (!model) {
            return { prev, next };
        }
        for (let i = Math.max(0, index - n); i < index; i++) {
            const c = model.cells.get(i);
            if (c.type === 'code') {
                prev.push((content.widgets[i] as any)?.model?.sharedModel?.getSource?.() ?? '');
            }
        }
        for (let i = index + 1; i <= Math.min(content.widgets.length - 1, index + n); i++) {
            const c = model.cells.get(i);
            if (c.type === 'code') {
                next.push((content.widgets[i] as any)?.model?.sharedModel?.getSource?.() ?? '');
            }
        }
        return { prev, next };
    }

    /**
     * 请求后端生成建议；后端未接入时返回演示代码
     */
    private async requestGenerate(payload: any): Promise<{ suggestion: string; explanation?: string; error?: string }> {
        try {
            const resp = await fetch('/aiserver/generate', {
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
                        suggestion: errorData.suggestion || '# 示例：打印DataFrame前5行\nprint(df.head())',
                        explanation: errorData.explanation || '后端返回错误',
                        error: errorData.error || `HTTP ${resp.status}: ${resp.statusText}`
                    };
                } catch {
                    return {
                        suggestion: '# 示例：打印DataFrame前5行\nprint(df.head())',
                        explanation: '后端返回错误',
                        error: `HTTP ${resp.status}: ${resp.statusText}`
                    };
                }
            }
        } catch (error) {
            return {
                suggestion: '# 示例：打印DataFrame前5行\nprint(df.head())',
                explanation: '网络错误或后端未启动',
                error: error instanceof Error ? error.message : '未知错误'
            };
        }
    }

    /**
     * 应用AI建议到Notebook，并可选执行
     */
    private async applySuggestion(panel: NotebookPanel, suggestion: string, mode: 'replace' | 'insert' | 'append' | 'explain' | 'fix', autoRun: boolean): Promise<void> {
        const content = panel.content;
        const cell = content.activeCell;
        if (!cell || cell.model.type !== 'code') {
            return;
        }
        if (mode === 'replace' || mode === 'fix') {
            cell.model.sharedModel.setSource(suggestion);
        } else if (mode === 'insert') {
            await this.app.commands.execute('notebook:insert-cell-below');
            content.activeCell.model.sharedModel.setSource(suggestion);
        } else if (mode === 'append') {
            const src = cell.model.sharedModel.getSource();
            cell.model.sharedModel.setSource(src + '\n' + suggestion);
        } else if (mode === 'explain') {
            // 在当前单元格下方插入新的Markdown单元格
            await this.app.commands.execute('notebook:insert-cell-below');
            // 更改新单元格类型为Markdown
            await this.app.commands.execute('notebook:change-cell-to-markdown');
            // 设置Markdown单元格内容为AI返回的解释
            content.activeCell.model.sharedModel.setSource(suggestion);
            // 如果设置了自动执行，则运行该单元格
            if (autoRun) {
                await this.app.commands.execute('notebook:run-cell');
            }
        }
        // 对于非explain模式，如果设置了自动执行，则运行当前单元格
        if (autoRun && mode !== 'explain') {
            await this.app.commands.execute('notebook:run-cell');
        }
    }
}