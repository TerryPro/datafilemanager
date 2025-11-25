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
    private modeButtons: Map<string, HTMLButtonElement> = new Map();
    private selectedMode: string = 'replace';
    private generateBtn: HTMLButtonElement;

    constructor(app: JupyterFrontEnd, tracker: INotebookTracker) {
        super();
        this.app = app;
        this.id = 'ai-sidebar';
        this.title.icon = aiAssistantIcon;
        this.title.caption = 'AI Assistant';
        this.addClass('jp-AiSidebar');

        this.tracker = tracker;
        this.aiService = new AiService();

        this.node.style.display = 'flex';
        this.node.style.flexDirection = 'column';
        this.node.style.padding = '12px';
        this.node.style.overflow = 'hidden';
        this.node.style.backgroundColor = 'var(--jp-layout-color1)';

        // Chat History Area
        this.chatHistory = document.createElement('div');
        this.chatHistory.className = 'ai-sidebar-history';
        this.chatHistory.style.flex = '1';
        this.chatHistory.style.overflowY = 'auto';
        this.chatHistory.style.marginBottom = '12px';
        this.chatHistory.style.border = '1px solid var(--jp-border-color2)';
        this.chatHistory.style.borderRadius = '8px';
        this.chatHistory.style.padding = '10px';
        this.chatHistory.style.backgroundColor = 'var(--jp-layout-color0)';
        this.node.appendChild(this.chatHistory);

        // Input Area
        const inputContainer = document.createElement('div');
        inputContainer.style.display = 'flex';
        inputContainer.style.flexDirection = 'column';
        inputContainer.style.gap = '10px';

        // Mode Selection - Modern Button Group
        const modeLabel = document.createElement('label');
        modeLabel.textContent = '模式选择:';
        modeLabel.style.fontWeight = '600';
        modeLabel.style.fontSize = '12px';
        modeLabel.style.color = 'var(--jp-ui-font-color1)';
        inputContainer.appendChild(modeLabel);

        const modeContainer = document.createElement('div');
        modeContainer.style.display = 'flex';
        modeContainer.style.gap = '6px';
        modeContainer.style.flexWrap = 'wrap';

        const modes = [
            { value: 'replace', label: '替换', icon: '🔄' },
            { value: 'fix', label: '修复', icon: '🔧' },
            { value: 'explain', label: '解释', icon: '💡' },
            { value: 'insert', label: '插入', icon: '➕' },
            { value: 'append', label: '追加', icon: '📝' }
        ];

        modes.forEach(m => {
            const btn = document.createElement('button');
            btn.className = 'ai-mode-btn';
            btn.innerHTML = `<span style="margin-right: 4px;">${m.icon}</span>${m.label}`;
            btn.style.flex = '1';
            btn.style.minWidth = '70px';
            btn.style.padding = '8px 12px';
            btn.style.border = '1px solid var(--jp-border-color2)';
            btn.style.borderRadius = '6px';
            btn.style.backgroundColor = 'var(--jp-layout-color2)';
            btn.style.color = 'var(--jp-ui-font-color1)';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = '500';
            btn.style.transition = 'all 0.2s ease';
            btn.style.outline = 'none';

            btn.onmouseover = () => {
                if (this.selectedMode !== m.value) {
                    btn.style.backgroundColor = 'var(--jp-layout-color3)';
                }
            };
            btn.onmouseout = () => {
                if (this.selectedMode !== m.value) {
                    btn.style.backgroundColor = 'var(--jp-layout-color2)';
                }
            };

            btn.onclick = () => this.selectMode(m.value);
            this.modeButtons.set(m.value, btn);
            modeContainer.appendChild(btn);
        });

        inputContainer.appendChild(modeContainer);

        // Set initial selected mode
        this.selectMode('replace');

        // Intent Input
        const label = document.createElement('label');
        label.textContent = '意图描述:';
        label.style.fontWeight = '600';
        label.style.fontSize = '12px';
        label.style.color = 'var(--jp-ui-font-color1)';
        inputContainer.appendChild(label);

        this.intentInput = document.createElement('textarea');
        this.intentInput.className = 'jp-mod-styled';
        this.intentInput.placeholder = '输入您的需求...';
        this.intentInput.rows = 3;
        this.intentInput.style.width = '100%';
        this.intentInput.style.resize = 'vertical';
        this.intentInput.style.borderRadius = '6px';
        this.intentInput.style.padding = '8px';
        this.intentInput.style.fontSize = '13px';
        inputContainer.appendChild(this.intentInput);

        // Generate Button
        this.generateBtn = document.createElement('button');
        this.generateBtn.className = 'jp-Button jp-mod-accept';
        this.generateBtn.textContent = '✨ 生成';
        this.generateBtn.style.width = '100%';
        this.generateBtn.style.padding = '10px';
        this.generateBtn.style.borderRadius = '6px';
        this.generateBtn.style.fontSize = '14px';
        this.generateBtn.style.fontWeight = '600';
        this.generateBtn.onclick = () => this.handleGenerate();
        inputContainer.appendChild(this.generateBtn);

        this.node.appendChild(inputContainer);
    }

    private selectMode(mode: string) {
        this.selectedMode = mode;
        this.modeButtons.forEach((btn, key) => {
            if (key === mode) {
                btn.style.backgroundColor = 'var(--jp-brand-color1)';
                btn.style.color = 'white';
                btn.style.borderColor = 'var(--jp-brand-color1)';
                btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            } else {
                btn.style.backgroundColor = 'var(--jp-layout-color2)';
                btn.style.color = 'var(--jp-ui-font-color1)';
                btn.style.borderColor = 'var(--jp-border-color2)';
                btn.style.boxShadow = 'none';
            }
        });
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
        const mode = this.selectedMode;

        this.generateBtn.disabled = true;
        this.generateBtn.textContent = '⏳ 生成中...';
        this.appendHistory('User', intent);

        try {
            const payload = this.aiService.buildAiRequestPayload(panel, source, intent, mode, false);
            const resp = await this.aiService.requestGenerate(payload);

            if (resp.error) {
                this.appendHistory('AI', `错误: ${resp.error}\n\n建议:\n${resp.suggestion}`, 'error');
                this.lastSuggestion = resp.suggestion;
            } else {
                this.appendHistory('AI', resp.suggestion, 'success', true);
                this.lastSuggestion = resp.suggestion;
            }
        } catch (e) {
            this.appendHistory('System', `请求失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
        } finally {
            this.generateBtn.disabled = false;
            this.generateBtn.textContent = '✨ 生成';
        }
    }

    private async handleApply(suggestion: string) {
        const panel = this.tracker.currentWidget;
        if (!panel) return;

        const mode = this.selectedMode as 'replace' | 'insert' | 'append' | 'explain' | 'fix';

        try {
            await this.applySuggestion(panel, suggestion, mode);
            this.appendHistory('System', '✅ 代码已应用。', 'info');
        } catch (e) {
            this.appendHistory('System', `❌ 应用失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
        msg.style.marginBottom = '10px';
        msg.style.padding = '10px';
        msg.style.borderRadius = '8px';
        msg.style.fontSize = '13px';
        msg.style.wordBreak = 'break-word';
        msg.style.position = 'relative';

        if (sender === 'User') {
            msg.style.backgroundColor = 'var(--jp-layout-color2)';
            msg.style.alignSelf = 'flex-end';
            msg.style.borderLeft = '3px solid var(--jp-brand-color1)';
            msg.innerHTML = `<strong>You:</strong> ${text}`;
        } else if (sender === 'AI') {
            msg.style.backgroundColor = 'var(--jp-layout-color3)';
            msg.style.borderLeft = '3px solid var(--jp-success-color1)';
            msg.style.display = 'flex';
            msg.style.justifyContent = 'space-between';
            msg.style.alignItems = 'flex-start';
            msg.style.gap = '10px';

            const textContent = document.createElement('div');
            textContent.style.flex = '1';
            textContent.style.whiteSpace = 'pre-wrap';
            textContent.style.fontFamily = 'var(--jp-code-font-family)';
            textContent.innerHTML = `<strong>AI:</strong>\n${text}`;
            msg.appendChild(textContent);

            if (showApplyBtn) {
                const applyIcon = document.createElement('button');
                applyIcon.innerHTML = '✓';
                applyIcon.title = '应用此建议';
                applyIcon.style.backgroundColor = 'var(--jp-brand-color1)';
                applyIcon.style.color = 'white';
                applyIcon.style.border = 'none';
                applyIcon.style.borderRadius = '50%';
                applyIcon.style.width = '28px';
                applyIcon.style.height = '28px';
                applyIcon.style.cursor = 'pointer';
                applyIcon.style.fontSize = '16px';
                applyIcon.style.fontWeight = 'bold';
                applyIcon.style.flexShrink = '0';
                applyIcon.style.transition = 'all 0.2s ease';
                applyIcon.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

                applyIcon.onmouseover = () => {
                    applyIcon.style.transform = 'scale(1.1)';
                    applyIcon.style.boxShadow = '0 3px 6px rgba(0,0,0,0.3)';
                };
                applyIcon.onmouseout = () => {
                    applyIcon.style.transform = 'scale(1)';
                    applyIcon.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                };

                applyIcon.onclick = () => this.handleApply(text.replace(/^AI:\n/, ''));
                msg.appendChild(applyIcon);
            }
        } else {
            msg.style.fontStyle = 'italic';
            msg.style.fontSize = '12px';
            msg.innerHTML = `<strong>[${sender}]</strong> ${text}`;
            if (type === 'error') {
                msg.style.color = 'var(--jp-error-color1)';
                msg.style.backgroundColor = 'var(--jp-error-color3)';
            }
            if (type === 'success') {
                msg.style.color = 'var(--jp-success-color1)';
            }
            if (type === 'info') {
                msg.style.color = 'var(--jp-info-color1)';
            }
        }

        this.chatHistory.appendChild(msg);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }
}
