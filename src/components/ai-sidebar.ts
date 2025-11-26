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

        // Sidebar Header
        const header = document.createElement('div');
        header.className = 'ai-sidebar-header';

        const title = document.createElement('div');
        title.className = 'ai-sidebar-title';
        title.innerHTML = `${this.ICONS.ai} <span>AI Assistant</span>`;

        const clearBtn = document.createElement('button');
        clearBtn.className = 'ai-sidebar-clear-btn';
        clearBtn.innerHTML = this.ICONS.trash;
        clearBtn.title = '清空对话';
        clearBtn.onclick = () => this.clearHistory();

        header.appendChild(title);
        header.appendChild(clearBtn);
        this.node.appendChild(header);

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
            { value: 'create', label: '编写代码' },
            { value: 'fix', label: '错误修复' },
            { value: 'refactor', label: '代码完善' },
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



    private clearHistory() {
        this.chatHistory.innerHTML = '';
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

        const mode = this.modeSelect.value as 'create' | 'insert' | 'append' | 'explain' | 'fix' | 'refactor';

        try {
            await this.applySuggestion(panel, suggestion, mode);
        } catch (e) {
            this.appendHistory('System', `应用失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
        }
    }

    private async applySuggestion(panel: NotebookPanel, suggestion: string, mode: 'create' | 'insert' | 'append' | 'explain' | 'fix' | 'refactor'): Promise<void> {
        const content = panel.content;
        const cell = content.activeCell;
        if (!cell || cell.model.type !== 'code') {
            return;
        }

        if (mode === 'create' || mode === 'fix' || mode === 'refactor') {
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

    // 定义SVG图标常量
    private readonly ICONS = {
        expand: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
        collapse: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
        apply: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        user: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
        ai: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12 2.1 12a10.1 10.1 0 0 0 9.9 9.9v-9.9z"></path><path d="M12 12V2.1A10.1 10.1 0 0 0 2.1 12h9.9z"></path></svg>`,
        trash: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`
    };

    private appendHistory(sender: string, text: string, type: 'normal' | 'error' | 'warning' | 'success' | 'info' = 'normal', showApplyBtn: boolean = false) {
        const msg = document.createElement('div');
        msg.className = 'ai-sidebar-message';

        if (sender === 'User') {
            msg.classList.add('ai-sidebar-message-user');
            // User Header
            const header = document.createElement('div');
            header.className = 'ai-message-header';

            const label = document.createElement('div');
            label.className = 'ai-message-label';
            label.innerHTML = `${this.ICONS.user} <span>You</span>`;
            header.appendChild(label);

            msg.appendChild(header);

            // User Content
            const content = document.createElement('div');
            content.className = 'ai-message-content';
            content.textContent = text;
            msg.appendChild(content);

        } else if (sender === 'AI') {
            msg.classList.add('ai-sidebar-message-ai');

            // AI Header with Toolbar
            const header = document.createElement('div');
            header.className = 'ai-message-header';

            const label = document.createElement('div');
            label.className = 'ai-message-label';
            label.innerHTML = `${this.ICONS.ai} <span>AI Suggestion</span>`;
            header.appendChild(label);

            const toolbar = document.createElement('div');
            toolbar.className = 'ai-message-toolbar';
            header.appendChild(toolbar);

            msg.appendChild(header);

            // Content Area
            const content = document.createElement('div');
            content.className = 'ai-message-content ai-code-block';

            // Check if content needs collapsing
            const lines = text.split('\n');
            const shouldCollapse = lines.length > 8; // 稍微增加默认显示的行数

            if (shouldCollapse) {
                const collapsedText = lines.slice(0, 8).join('\n') + '\n...';
                content.textContent = collapsedText;
                content.classList.add('collapsed');

                // Toggle Button
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'ai-toolbar-btn';
                toggleBtn.innerHTML = this.ICONS.expand;
                toggleBtn.title = '展开完整代码';

                let isExpanded = false;
                toggleBtn.onclick = () => {
                    isExpanded = !isExpanded;
                    if (isExpanded) {
                        content.textContent = text;
                        content.classList.remove('collapsed');
                        toggleBtn.innerHTML = this.ICONS.collapse;
                        toggleBtn.title = '收起代码';
                    } else {
                        content.textContent = collapsedText;
                        content.classList.add('collapsed');
                        toggleBtn.innerHTML = this.ICONS.expand;
                        toggleBtn.title = '展开完整代码';
                    }
                };
                toolbar.appendChild(toggleBtn);
            } else {
                content.textContent = text;
            }

            // Apply Button
            if (showApplyBtn) {
                const applyBtn = document.createElement('button');
                applyBtn.className = 'ai-toolbar-btn ai-btn-primary';
                applyBtn.innerHTML = this.ICONS.apply;
                applyBtn.title = '应用此代码';
                applyBtn.onclick = () => this.handleApply(text.replace(/^AI:\n/, ''));
                toolbar.appendChild(applyBtn);
            }

            msg.appendChild(content);

        } else {
            // System Message
            msg.classList.add('ai-sidebar-message-system');
            msg.innerHTML = `<strong>[${sender}]</strong> ${text}`;
            if (type === 'error') msg.classList.add('error');
            if (type === 'success') msg.classList.add('success');
            if (type === 'info') msg.classList.add('info');
        }

        this.chatHistory.appendChild(msg);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }
}
