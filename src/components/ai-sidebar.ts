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
    private variableBtn: HTMLButtonElement;
    private variablePopup: HTMLDivElement;
    private selectionBar: HTMLDivElement;
    private selectedVariable?: { name: string; type: string; description?: string };
    private selectedAlgorithm?: { id: string; name: string; params?: any; expectedOutput?: string; prompt?: string };

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
        // Variable Button (@)
        this.variableBtn = document.createElement('button');
        this.variableBtn.className = 'ai-sidebar-toolbar-btn';
        this.variableBtn.innerHTML = this.ICONS.at;
        this.variableBtn.title = '引用变量 (@)';
        this.variableBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleVariablePopup();
        };
        toolbar.appendChild(this.variableBtn);

        // Prompt Library Button
        this.promptBtn = document.createElement('button');
        this.promptBtn.className = 'ai-sidebar-toolbar-btn';
        this.promptBtn.innerHTML = this.ICONS.library; // Need to add library icon
        this.promptBtn.title = '提示词库';
        this.promptBtn.onclick = (e) => {
            e.stopPropagation();
            this.togglePromptPopup();
        };
        toolbar.appendChild(this.promptBtn);

        // Mode Select Wrapper
        const selectWrapper = document.createElement('div');
        selectWrapper.className = 'ai-sidebar-select-wrapper';

        this.modeSelect = document.createElement('select');
        this.modeSelect.className = 'ai-sidebar-mode-select';

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

        selectWrapper.appendChild(this.modeSelect);
        toolbar.appendChild(selectWrapper);

        // Selection Bar (placed below the prompt input panel)
        this.selectionBar = document.createElement('div');
        this.selectionBar.className = 'ai-selection-bar';
        const varChip = document.createElement('div');
        varChip.className = 'ai-selection-chip';
        const varIcon = document.createElement('span');
        varIcon.className = 'ai-chip-icon';
        varIcon.innerHTML = this.ICONS.table;
        const varLabel = document.createElement('span');
        varLabel.className = 'ai-chip-label';
        const varClear = document.createElement('button');
        varClear.className = 'ai-chip-clear';
        varClear.textContent = '×';
        varClear.title = '清除已选变量';
        varClear.onclick = () => this.clearSelectedVariable();
        varChip.appendChild(varIcon);
        varChip.appendChild(varLabel);
        varChip.appendChild(varClear);

        const algoChip = document.createElement('div');
        algoChip.className = 'ai-selection-chip';
        const algoIcon = document.createElement('span');
        algoIcon.className = 'ai-chip-icon';
        algoIcon.innerHTML = this.ICONS.library;
        const algoLabel = document.createElement('span');
        algoLabel.className = 'ai-chip-label';
        const algoClear = document.createElement('button');
        algoClear.className = 'ai-chip-clear';
        algoClear.textContent = '×';
        algoClear.title = '清除已选算法';
        algoClear.onclick = () => this.clearSelectedAlgorithm();
        algoChip.appendChild(algoIcon);
        algoChip.appendChild(algoLabel);
        algoChip.appendChild(algoClear);

        this.selectionBar.appendChild(varChip);
        this.selectionBar.appendChild(algoChip);

        // Variable Popup
        this.variablePopup = document.createElement('div');
        this.variablePopup.className = 'ai-variable-popup';
        selectWrapper.appendChild(this.variablePopup);

        // Prompt Popup (Attached to toolbar for now, or maybe selectWrapper? Let's put it in toolbar for positioning relative to button)
        this.promptPopup = document.createElement('div');
        this.promptPopup.className = 'ai-variable-popup ai-prompt-popup'; // Reuse class for style, add specific one
        toolbar.appendChild(this.promptPopup);

        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.variablePopup.contains(e.target as Node) && e.target !== this.variableBtn) {
                this.variablePopup.classList.remove('visible');
            }
            if (!this.promptPopup.contains(e.target as Node) && e.target !== this.promptBtn) {
                this.promptPopup.classList.remove('visible');
            }
        });

        toolbar.appendChild(selectWrapper);

        // Execute Button
        this.executeBtn = document.createElement('button');
        this.executeBtn.className = 'ai-sidebar-execute-btn';
        this.executeBtn.title = '生成';
        this.executeBtn.innerHTML = this.ICONS.run;
        this.executeBtn.onclick = () => this.handleGenerate();

        toolbar.appendChild(this.executeBtn);

        inputContainer.appendChild(toolbar);

        this.node.appendChild(inputContainer);
        this.node.appendChild(this.selectionBar);
        this.updateSelectionBar();
    }

    private async toggleVariablePopup() {
        const isVisible = this.variablePopup.classList.contains('visible');
        if (isVisible) {
            this.variablePopup.classList.remove('visible');
        } else {
            this.variablePopup.classList.add('visible');
            await this.loadVariables();
        }
    }

    private async loadVariables() {
        this.variablePopup.innerHTML = '<div class="ai-variable-loading">加载变量中...</div>';

        const panel = this.tracker.currentWidget;
        if (!panel) {
            this.variablePopup.innerHTML = '<div class="ai-variable-empty">未检测到 Notebook</div>';
            return;
        }

        try {
            const variables = await this.aiService.getDataFrameInfo(panel);
            this.renderVariables(variables);
        } catch (e) {
            this.variablePopup.innerHTML = `<div class="ai-variable-empty">加载失败: ${e}</div>`;
        }
    }

    private renderVariables(variables: any[]) {
        this.variablePopup.innerHTML = '';

        if (variables.length === 0) {
            this.variablePopup.innerHTML = '<div class="ai-variable-empty">无可用 DataFrame</div>';
            return;
        }

        variables.forEach(v => {
            const item = document.createElement('div');
            item.className = 'ai-variable-item';

            const icon = document.createElement('span');
            icon.className = 'variable-icon';
            icon.innerHTML = this.ICONS.table;

            const name = document.createElement('span');
            name.className = 'variable-name';
            name.textContent = v.name;

            const info = document.createElement('span');
            info.className = 'variable-info';
            info.textContent = `${v.shape[0]}x${v.shape[1]}`;

            item.appendChild(icon);
            item.appendChild(name);
            item.appendChild(info);

            item.onclick = () => {
                this.selectedVariable = { name: v.name, type: v.type, description: this.aiService.describeVariable(v) };
                this.insertVariable(v.name);
                this.updateSelectionBar();
                this.updateStructuredIntent();
                this.variablePopup.classList.remove('visible');
            };

            this.variablePopup.appendChild(item);
        });
    }

    private insertVariable(name: string) {
        const cursorPos = this.intentInput.selectionStart;
        const textBefore = this.intentInput.value.substring(0, cursorPos);
        const textAfter = this.intentInput.value.substring(cursorPos);

        // Check if there is already an @ before the cursor
        // If user typed @ and then clicked the button, we might want to replace it?
        // But the requirement is "click button -> popup -> select -> insert".
        // So we just insert "name " (maybe with a space?)

        this.intentInput.value = textBefore + name + ' ' + textAfter;
        this.intentInput.focus();
        this.intentInput.setSelectionRange(cursorPos + name.length + 1, cursorPos + name.length + 1);
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

        if (!this.intentInput.value.trim()) {
            this.updateStructuredIntent();
        }
        const intent = this.intentInput.value.trim();

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

            const payload = this.aiService.buildAiRequestPayload(
                panel,
                source,
                intent,
                mode,
                false,
                variables,
                { variable: this.selectedVariable, algorithm: this.selectedAlgorithm }
            );
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

    private promptBtn: HTMLButtonElement;
    private promptPopup: HTMLDivElement;

    private async togglePromptPopup() {
        const isVisible = this.promptPopup.classList.contains('visible');
        if (isVisible) {
            this.promptPopup.classList.remove('visible');
        } else {
            this.promptPopup.classList.add('visible');
            await this.loadPrompts();
        }
    }

    private async loadPrompts() {
        this.promptPopup.innerHTML = '<div class="ai-variable-loading">加载提示词库...</div>';
        try {
            const prompts = await this.aiService.getAlgorithmPrompts();
            this.renderPrompts(prompts);
        } catch (e) {
            this.promptPopup.innerHTML = `<div class="ai-variable-empty">加载失败: ${e}</div>`;
        }
    }

    private renderPrompts(prompts: any) {
        this.promptPopup.innerHTML = '';
        if (!prompts || Object.keys(prompts).length === 0) {
            this.promptPopup.innerHTML = '<div class="ai-variable-empty">暂无提示词</div>';
            return;
        }

        Object.keys(prompts).forEach(key => {
            const category = prompts[key];

            const catHeader = document.createElement('div');
            catHeader.className = 'ai-prompt-category';
            catHeader.textContent = category.label;
            this.promptPopup.appendChild(catHeader);

            category.algorithms.forEach((algo: any) => {
                const item = document.createElement('div');
                item.className = 'ai-variable-item';

                const name = document.createElement('span');
                name.className = 'variable-name';
                name.textContent = algo.name;

                item.appendChild(name);
                item.onclick = () => {
                    this.setSelectedAlgorithm(algo);
                    this.promptPopup.classList.remove('visible');
                };
                this.promptPopup.appendChild(item);
            });
        });
    }

    // 定义SVG图标常量
    private readonly ICONS = {
        expand: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
        collapse: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
        apply: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        user: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
        ai: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12 2.1 12a10.1 10.1 0 0 0 9.9 9.9v-9.9z"></path><path d="M12 12V2.1A10.1 10.1 0 0 0 2.1 12h9.9z"></path></svg>`,
        trash: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
        run: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M5 3l14 9-14 9V3z"/></svg>`,
        at: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg>`,
        library: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
        table: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>`
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

    /**
     * 更新右上角摘要显示
     */
    private updateSelectionBar() {
        const chips = this.selectionBar.querySelectorAll('.ai-selection-chip');
        const [varChip, algoChip] = [chips[0], chips[1]];
        const varLabel = varChip?.querySelector('.ai-chip-label') as HTMLSpanElement;
        const algoLabel = algoChip?.querySelector('.ai-chip-label') as HTMLSpanElement;
        if (varLabel) {
            varLabel.textContent = this.selectedVariable?.name ?? '未选择变量';
        }
        if (algoLabel) {
            algoLabel.textContent = this.selectedAlgorithm?.name ?? '未选择算法';
        }
    }

    /**
     * 基于选择生成并填充结构化提示词
     */
    private updateStructuredIntent() {
        const text = this.aiService.generateStructuredPrompt(this.selectedVariable, this.selectedAlgorithm);
        this.intentInput.value = text;
    }

    /**
     * 设置算法选择并更新视图
     */
    private setSelectedAlgorithm(algo: { id: string; name: string; prompt: string }) {
        const meta = this.aiService.getDefaultAlgorithmMeta(algo.id);
        this.selectedAlgorithm = { id: algo.id, name: algo.name, params: meta.params, expectedOutput: meta.expectedOutput, prompt: algo.prompt };
        this.updateSelectionBar();
        this.updateStructuredIntent();
    }

    /**
     * 清除已选变量
     */
    private clearSelectedVariable() {
        this.selectedVariable = undefined;
        this.updateSelectionBar();
        this.updateStructuredIntent();
    }

    /**
     * 清除已选算法
     */
    private clearSelectedAlgorithm() {
        this.selectedAlgorithm = undefined;
        this.updateSelectionBar();
        this.updateStructuredIntent();
    }
}
