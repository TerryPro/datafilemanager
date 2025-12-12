export interface IAlgorithmInfo {
  id: string;
  name: string;
  params?: any;
  expectedOutput?: string;
  prompt?: string;
}

export class LibraryService {
  /**
   * 从后端获取算法提示词库
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

  /**
   * 获取Python函数库元数据
   */
  async getFunctionLibrary(): Promise<any> {
    try {
      const resp = await fetch('/aiserver/function-library');
      if (resp.ok) {
        return await resp.json();
      }
      console.error('Failed to fetch function library:', resp.statusText);
      return {};
    } catch (error) {
      console.error('Error fetching function library:', error);
      return {};
    }
  }

  /**
   * Reload function library metadata
   */
  async reloadFunctionLibrary(): Promise<any> {
    try {
      const resp = await fetch('/aiserver/reload-library', {
        method: 'POST'
      });
      if (resp.ok) {
        return await resp.json();
      }
      console.error('Failed to reload function library:', resp.statusText);
      return {};
    } catch (error) {
      console.error('Error reloading function library:', error);
      return {};
    }
  }

  /**
   * Manage algorithm (add, update, delete)
   */
  async manageAlgorithm(action: 'add' | 'update' | 'delete', data: any): Promise<any> {
    try {
      const resp = await fetch('/aiserver/algorithm-manage', {
        method: 'POST',
        body: JSON.stringify({
          action,
          ...data
        })
      });
      
      if (resp.ok) {
        return await resp.json();
      }
      
      let errorMsg = resp.statusText;
      try {
        const errJson = await resp.json();
        if (errJson.error) errorMsg = errJson.error;
      } catch (e) {
        // ignore
      }
      
      console.error('Failed to manage algorithm:', errorMsg);
      throw new Error(errorMsg);
    } catch (error) {
      console.error('Error managing algorithm:', error);
      throw error;
    }
  }

  /**
   * Get algorithm source code
   */
  async getAlgorithmCode(id: string): Promise<string> {
    try {
      const resp = await fetch('/aiserver/algorithm-manage', {
        method: 'POST',
        body: JSON.stringify({
          action: 'get_code',
          id
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.code;
      }
      const errorText = await resp.text();
      throw new Error(errorText || resp.statusText);
    } catch (error) {
      console.error('Error fetching algorithm code:', error);
      throw error;
    }
  }

  /**
   * 为算法生成默认的参数配置与预期输出
   */
  getDefaultAlgorithmMeta(id: string): { params: any; expectedOutput: string } {
    switch (id) {
      case 'summary_stats':
        return { params: {}, expectedOutput: '统计摘要表或字典' };
      case 'line_plot':
        return {
          params: { backend: 'matplotlib' },
          expectedOutput: '时序曲线图'
        };
      case 'spectral_analysis':
        return { params: { method: 'welch' }, expectedOutput: '功率谱密度图' };
      case 'autocorrelation':
        return { params: { lags: 'auto' }, expectedOutput: 'ACF 图' };
      case 'decomposition':
        return { params: { model: 'STL' }, expectedOutput: '分解结果图' };
      case 'heatmap_distribution':
        return { params: { x: 'date', y: 'hour' }, expectedOutput: '热力图' };
      case 'trend_basic_stacked':
        return {
          params: { layout: 'stacked' },
          expectedOutput: '趋势图（分栏）'
        };
      case 'trend_basic_overlay':
        return {
          params: { layout: 'overlay' },
          expectedOutput: '趋势图（叠加）'
        };
      case 'trend_basic_grid':
        return { params: { layout: 'grid' }, expectedOutput: '趋势图（网格）' };
      case 'trend_ma':
        return { params: { window: 'auto' }, expectedOutput: '移动平均趋势图' };
      case 'trend_ewma':
        return { params: { span: 'auto' }, expectedOutput: 'EWMA 趋势图' };
      case 'trend_loess':
        return { params: { frac: 'auto' }, expectedOutput: 'LOESS 趋势图' };
      case 'trend_polyfit':
        return { params: { degree: 1 }, expectedOutput: '多项式趋势拟合图' };
      case 'trend_stl_trend':
        return { params: { period: 'auto' }, expectedOutput: 'STL 趋势分量图' };
      default:
        return { params: {}, expectedOutput: '' };
    }
  }

  /**
   * 基于选择生成结构化提示词
   */
  generateStructuredPrompt(
    variable?: { name: string; type: string },
    algorithm?: { name: string; prompt?: string }
  ): string {
    const varName = variable?.name ?? '当前变量';
    const algoName = algorithm?.name ?? '所选算法';
    const header = `请对${varName} 执行${algoName}分析。`;
    const backendBodyRaw = algorithm?.prompt ?? '';
    const backendBody = this.fillPromptPlaceholders(backendBodyRaw, variable, {
      name: algoName
    });
    if (backendBody.trim().length > 0) {
      const startsWithInstruction = /^请对.*执行.*分析/.test(backendBody);
      return startsWithInstruction ? backendBody : `${header}\n${backendBody}`;
    }
    return header;
  }

  /**
   * 用选中变量/算法替换提示词中的站位符
   */
  fillPromptPlaceholders(
    prompt: string,
    variable?: { name: string; type: string },
    algorithm?: { name: string }
  ): string {
    const safe = (v?: string, def?: string) =>
      v && v.trim().length > 0 ? v : def ?? '';
    const replaced = prompt
      .replace(/\{VAR_NAME\}/g, safe(variable?.name, '当前变量'))
      .replace(/\{VAR_TYPE\}/g, safe(variable?.type, '数据集'))
      .replace(/\{ALGO_NAME\}/g, safe(algorithm?.name, '所选算法'));
    return replaced;
  }
}
