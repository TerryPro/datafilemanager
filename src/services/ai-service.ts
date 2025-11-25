import { NotebookPanel } from '@jupyterlab/notebook';

/**
 * AI Service to handle backend interactions and notebook context logic.
 * Independent of AiDialogManager to avoid modifying existing code.
 */
export class AiService {
    /**
     * Request code generation from the backend.
     */
    async requestGenerate(payload: any): Promise<{ suggestion: string; explanation?: string; error?: string }> {
        try {
            const resp = await fetch('/aiserver/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                return await resp.json();
            } else {
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
     * Build the payload for the AI request.
     */
    buildAiRequestPayload(panel: NotebookPanel, source: string, intent: string, mode: string, autoRun: boolean): any {
        const kernel = panel.sessionContext?.session?.kernel?.name ?? 'python';
        const ctx = this.pickNeighborCells(panel, 2);

        // Get output if in fix mode
        let output = '';
        if (mode === 'fix') {
            const cell = panel.content.activeCell;
            if (cell && cell.model.type === 'code') {
                const outputs = (cell.model as any).outputs;
                for (let i = 0; i < outputs.length; i++) {
                    const out = outputs.get(i);
                    if (out.type === 'stream' && (out.data as any).name === 'stderr') {
                        output += `[stderr] ${(out.data as any).text}\n`;
                    } else if (out.type === 'error') {
                        output += `[error] ${(out.data as any).ename}: ${(out.data as any).evalue}\n`;
                        if ((out.data as any).traceback) {
                            output += `Traceback:\n${((out.data as any).traceback as string[]).join('\n')}\n`;
                        }
                    } else if (out.type === 'execute_result' || out.type === 'display_data') {
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
     * Pick neighbor cells for context.
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
}
