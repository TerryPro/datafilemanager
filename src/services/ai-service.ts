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
     * Get DataFrame info from the current kernel.
     */
    async getDataFrameInfo(panel: NotebookPanel): Promise<any[]> {
        const session = panel.sessionContext.session;
        if (!session?.kernel) {
            return [];
        }

        const code = `
import json
import pandas as pd
_dfs = []
for _name, _var in list(globals().items()):
    if not _name.startswith('_') and isinstance(_var, pd.DataFrame):
        _dfs.append({
            'name': _name,
            'type': 'DataFrame',
            'shape': _var.shape,
            'columns': _var.columns.tolist(),
            'dtypes': {k: str(v) for k, v in _var.dtypes.items()}
        })
print(json.dumps(_dfs))
`;

        console.log('Executing DataFrame info script...');
        const future = session.kernel.requestExecute({ code, stop_on_error: false, silent: false, store_history: false });
        let result: any[] = [];

        future.onIOPub = (msg) => {
            const msgType = msg.header.msg_type;
            console.log('IOPub message:', msgType, msg.content);
            if (msgType === 'stream') {
                const content = msg.content as any;
                if (content.name === 'stdout') {
                    console.log('Stdout received:', content.text);
                    try {
                        result = JSON.parse(content.text);
                        console.log('Parsed DataFrame info:', result);
                    } catch (e) {
                        console.error('Failed to parse DataFrame info:', e);
                    }
                } else if (content.name === 'stderr') {
                    console.warn('Stderr received:', content.text);
                }
            } else if (msgType === 'error') {
                console.error('Kernel error:', msg.content);
            }
        };

        await future.done;
        console.log('Execution finished. Result:', result);
        return result;
    }

    /**
     * Build the payload for the AI request.
     */
    buildAiRequestPayload(panel: NotebookPanel, source: string, intent: string, mode: string, autoRun: boolean, variables: any[] = []): any {
        const kernel = panel.sessionContext?.session?.kernel?.name ?? 'python';
        const ctx = this.pickNeighborCells(panel, 2);

        // Get output if in fix mode
        let output = '';
        if (mode === 'fix') {
            const cell = panel.content.activeCell;
            if (cell && cell.model.type === 'code') {
                const outputs = (cell.model as any).outputs;
                for (let i = 0; i < outputs.length; i++) {
                    const outModel = outputs.get(i);
                    const out = outModel.toJSON();

                    if (out.output_type === 'stream' && out.name === 'stderr') {
                        const text = Array.isArray(out.text) ? out.text.join('') : out.text;
                        output += `[stderr] ${text}\n`;
                    } else if (out.output_type === 'error') {
                        output += `[error] ${out.ename}: ${out.evalue}\n`;
                        if (out.traceback) {
                            output += `Traceback:\n${out.traceback.join('\n')}\n`;
                        }
                    } else if (out.output_type === 'execute_result' || out.output_type === 'display_data') {
                        if (out.data && out.data['text/plain']) {
                            const text = Array.isArray(out.data['text/plain']) ? out.data['text/plain'].join('') : out.data['text/plain'];
                            output += `[output] ${text}\n`;
                        }
                    }
                }
            }
        }

        return { language: kernel, source, context: ctx, intent, options: { mode, autoRun, privacy: 'normal' }, output, variables };
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

    /**
     * Get algorithm prompts from the backend.
     */
    async getAlgorithmPrompts(): Promise<any> {
        try {
            const resp = await fetch('/aiserver/algorithm-prompts');
            if (resp.ok) {
                return await resp.json();
            }
            console.error('Failed to fetch algorithm prompts:', resp.statusText);
            return {};
        } catch (error) {
            console.error('Error fetching algorithm prompts:', error);
            return {};
        }
    }
}
