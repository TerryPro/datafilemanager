import { Widget } from '@lumino/widgets';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { AiService } from '../services/ai-service';
import { aiAssistantIcon } from './ai-button-manager';

/**
 * AI Sidebar Widget
 */
export class AiSidebar extends Widget {
    private app: JupyterFrontEnd;
    private tracker: INotebookTracker;
    private aiService: AiService;
    private chatHistory: HTMLDivElement;
    private intentInput: HTMLTextAreaElement;
    private modeSelect: HTMLSelectElement;
    private executeBtn: HTMLButtonElement;

    constructor(app: JupyterFrontEnd, tracker: INotebookTracker) {
        super();
        this.app = app;
        this.id = 'ai-sidebar';
        this.title.icon = aiAssistantIcon;
        this.title.caption = 'AI Assistant';
        this.addClass('jp-AiSidebar');

        this.tracker = tracker;
        this.aiService = new AiService();

        // Chat History Area
        this.chatHistory = document.createElement('div');
        this.chatHistory.className = 'ai-sidebar-history';
        this.node.appendChild(this.chatHistory);

        // Input Container
        const inputContainer = document.createElement('div');
        inputContainer.className = 'ai-sidebar-input-container';

        // Intent Input
        this.intentInput = document.createElement('textarea');
        this.intentInput.className = 'jp-mod-styled ai-sidebar-intent-input';
        this.intentInput.rows = 4;
        inputContainer.appendChild(this.intentInput);

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'ai-sidebar-toolbar';

        // Mode Select
        this.modeSelect = document.createElement('select');
        this.modeSelect.className = 'jp-mod-styled ai-sidebar-mode-select';

        const modes = [
            { value: 'replace', label: '编写代码' },
            { value: 'fix', label: '修改代码' },
            { value: 'explain', label: '编写说明' },
        ];

        modes.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.value;
            opt.textContent = m.label;
            this.modeSelect.appendChild(opt);
        });

        toolbar.appendChild(this.modeSelect);

        // Execute Button
        this.executeBtn = document.createElement('button');
        this.executeBtn.className = 'ai-sidebar-execute-btn';
        this.executeBtn.title = '生成';
        this.executeBtn.innerHTML = '▶';
        this.executeBtn.onclick = () => this.handleGenerate();

        toolbar.appendChild(this.executeBtn);

        inputContainer.appendChild(toolbar);

        this.node.appendChild(inputContainer);
    }



    private async handleGenerate() {
        const panel = this.tracker.currentWidget;
        if (!panel) {
            this.appendHistory('System', '未检测到活动的 Notebook。', 'error');
            return;
        }

        const intent = this.intentInput.value.trim();
        if (!intent) {
            this.appendHistory('System', '请输入意图描述。', 'warning');
            return;
        }

        const cell = panel.content.activeCell;
        if (!cell || cell.model.type !== 'code') {
            this.appendHistory('System', '请选中一个代码单元。', 'warning');
            return;
        }

        const source = cell.model.sharedModel.getSource();
        const mode = this.modeSelect.value;

        this.executeBtn.disabled = true;
        this.executeBtn.style.opacity = '0.5';
        this.appendHistory('User', intent);

        try {
            let variables: any[] = [];
            try {
                variables = await this.aiService.getDataFrameInfo(panel);
                console.log('Fetched variables:', variables);
            } catch (e) {
                console.warn('Failed to fetch variables:', e);
            }

            const payload = this.aiService.buildAiRequestPayload(panel, source, intent, mode, false, variables);
            const resp = await this.aiService.requestGenerate(payload);

            if (resp.error) {
                this.appendHistory('AI', `错误: ${resp.error}\n\n建议:\n${resp.suggestion}`, 'error');
            } else {
                this.appendHistory('AI', resp.suggestion, 'success', true);
            }
        } catch (e) {
            this.appendHistory('System', `请求失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
        } finally {
            this.executeBtn.disabled = false;
            this.executeBtn.style.opacity = '1';
        }
    }

    private async handleApply(suggestion: string) {
        const panel = this.tracker.currentWidget;
        if (!panel) return;

        const mode = this.modeSelect.value as 'replace' | 'insert' | 'append' | 'explain' | 'fix';

        try {
            await this.applySuggestion(panel, suggestion, mode);
        } catch (e) {
            this.appendHistory('System', `应用失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
        }
    }

    private async applySuggestion(panel: NotebookPanel, suggestion: string, mode: 'replace' | 'insert' | 'append' | 'explain' | 'fix'): Promise<void> {
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
            await this.app.commands.execute('notebook:insert-cell-below');
            await this.app.commands.execute('notebook:change-cell-to-markdown');
            content.activeCell.model.sharedModel.setSource(suggestion);
        }
    }

    private appendHistory(sender: string, text: string, type: 'normal' | 'error' | 'warning' | 'success' | 'info' = 'normal', showApplyBtn: boolean = false) {
        const msg = document.createElement('div');
        msg.className = 'ai-sidebar-message';

        if (sender === 'User') {
            msg.classList.add('ai-sidebar-message-user');
            msg.innerHTML = `<strong>You:</strong> ${text}`;
        } else if (sender === 'AI') {
            msg.classList.add('ai-sidebar-message-ai');

            // 检查内容是否需要折叠（超过5行）
            const lines = text.split('\n');
            const shouldCollapse = lines.length > 5;

            // 创建顶部工具栏（包含展开和应用按钮）
            const toolbar = document.createElement('div');
            toolbar.className = 'ai-sidebar-message-toolbar';

            // 创建文本内容
            const textContent = document.createElement('div');
            textContent.className = 'ai-sidebar-message-ai-text';

            if (shouldCollapse) {
                // 创建折叠状态的内容
                const collapsedText = lines.slice(0, 5).join('\n') + '\n...';
                textContent.innerHTML = `<strong>AI:</strong>\n${collapsedText}`;
                textContent.classList.add('ai-sidebar-message-collapsed');

                // 创建展开/收起按钮（使用图标）
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'ai-sidebar-icon-btn';
                toggleBtn.innerHTML = '▼';
                toggleBtn.title = '展开完整内容';

                let isExpanded = false;
                toggleBtn.onclick = () => {
                    isExpanded = !isExpanded;
                    if (isExpanded) {
                        textContent.innerHTML = `<strong>AI:</strong>\n${text}`;
                        textContent.classList.remove('ai-sidebar-message-collapsed');
                        toggleBtn.innerHTML = '▲';
                        toggleBtn.title = '收起内容';
                    } else {
                        textContent.innerHTML = `<strong>AI:</strong>\n${collapsedText}`;
                        textContent.classList.add('ai-sidebar-message-collapsed');
                        toggleBtn.innerHTML = '▼';
                        toggleBtn.title = '展开完整内容';
                    }
                };

                toolbar.appendChild(toggleBtn);
            } else {
                textContent.innerHTML = `<strong>AI:</strong>\n${text}`;
            }

            // 添加应用按钮
            if (showApplyBtn) {
                const applyBtn = document.createElement('button');
                applyBtn.className = 'ai-sidebar-icon-btn';
                applyBtn.innerHTML = '✓';
                applyBtn.title = '应用此建议';
                applyBtn.onclick = () => this.handleApply(text.replace(/^AI:\n/, ''));
                toolbar.appendChild(applyBtn);
            }

            // 组装消息结构
            msg.appendChild(toolbar);
            msg.appendChild(textContent);
        } else {
            msg.classList.add('ai-sidebar-message-system');
            msg.innerHTML = `<strong>[${sender}]</strong> ${text}`;
            if (type === 'error') {
                msg.classList.add('ai-sidebar-message-error');
            }
            if (type === 'success') {
                msg.classList.add('ai-sidebar-message-success');
            }
            if (type === 'info') {
                msg.classList.add('ai-sidebar-message-info');
            }
        }

        this.chatHistory.appendChild(msg);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }
}
