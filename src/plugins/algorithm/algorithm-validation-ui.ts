/**
 * Algorithm Validation UI Utilities
 *
 * Shared utilities for displaying algorithm validation results.
 */

import { showDialog, Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { NotebookPanel } from '@jupyterlab/notebook';

/**
 * 验证并获取活动代码单元格
 * @returns 单元格对象和代码，如果验证失败返回 null
 */
export function getActiveCodeCell(
  panel: NotebookPanel
): { cell: any; code: string } | null {
  const activeCell = panel.content.activeCell;

  if (!activeCell || activeCell.model.type !== 'code') {
    return null;
  }

  const code = activeCell.model.sharedModel.getSource();
  if (!code.trim()) {
    return null;
  }

  return { cell: activeCell, code };
}

/**
 * 显示验证结果对话框
 * @param validationResult 验证结果对象
 * @param mode 'save' 模式需要用户确认，'validate' 模式仅展示
 * @returns boolean - 是否继续（仅在 save 模式下有意义）
 */
export async function showValidationResultDialog(
  validationResult: any,
  mode: 'save' | 'validate' = 'validate'
): Promise<boolean> {
  const { issues } = validationResult;

  const errorIssues = issues.filter((i: any) => i.level === 'error');
  const warningIssues = issues.filter((i: any) => i.level === 'warning');
  const suggestionIssues = issues.filter((i: any) => i.level === 'suggestion');

  // 创建HTML内容
  const bodyHtml = createValidationHtml(
    errorIssues,
    warningIssues,
    suggestionIssues,
    mode
  );
  const bodyWidget = new Widget();
  bodyWidget.node.innerHTML = bodyHtml;

  // save 模式：需要用户确认是否继续
  if (mode === 'save') {
    if (errorIssues.length > 0) {
      await showDialog({
        title: '代码格式检查',
        body: bodyWidget,
        buttons: [Dialog.okButton({ label: '确定' })]
      });
      return false;
    }

    const result = await showDialog({
      title: '代码格式检查',
      body: bodyWidget,
      buttons: [
        Dialog.cancelButton({ label: '取消' }),
        Dialog.okButton({ label: '继续保存' })
      ]
    });

    return result.button.accept;
  }

  // validate 模式：仅展示结果
  await showDialog({
    title: '算法格式验证结果',
    body: bodyWidget,
    buttons: [Dialog.okButton({ label: '确定' })]
  });

  return true;
}

/**
 * 创建验证结果 HTML
 */
function createValidationHtml(
  errorIssues: any[],
  warningIssues: any[],
  suggestionIssues: any[],
  mode: 'save' | 'validate'
): string {
  let html =
    "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.6; padding: 10px;";

  if (mode === 'validate') {
    html += ' max-height: 500px; overflow-y: auto;';
  }
  html += '">';

  html += createIssueList('错误', errorIssues, '#d32f2f', '❌');
  html += createIssueList('警告', warningIssues, '#f57c00', '⚠️');
  html += createIssueList('建议', suggestionIssues, '#1976d2', '💡');

  // 总结信息
  html += createSummary(errorIssues, warningIssues, suggestionIssues, mode);
  html += '</div>';

  return html;
}

/**
 * 创建问题列表 HTML
 */
function createIssueList(
  title: string,
  issues: any[],
  color: string,
  icon: string
): string {
  if (issues.length === 0) {
    return '';
  }

  let html = '<div style="margin-bottom: 20px;">';
  html += `<div style="color: ${color}; font-weight: bold; font-size: 14px; margin-bottom: 10px; display: flex; align-items: center;">`;
  html += `<span style="margin-right: 8px;">${icon}</span>`;
  html += `<span>${title} (${issues.length} 个)</span>`;
  html += '</div>';
  html += '<ul style="margin: 0; padding-left: 30px; list-style: decimal;">';

  issues.forEach((issue: any) => {
    html += '<li style="margin-bottom: 8px; line-height: 1.5;">';
    html += `<span>${issue.message}</span>`;
    if (issue.line) {
      html += ` <span style="color: #999; font-size: 12px;">(行 ${issue.line})</span>`;
    }
    html += '</li>';
  });

  html += '</ul>';
  html += '</div>';
  return html;
}

/**
 * 创建总结信息 HTML
 */
function createSummary(
  errorIssues: any[],
  warningIssues: any[],
  suggestionIssues: any[],
  mode: 'save' | 'validate'
): string {
  let summaryColor = '#4caf50';
  let summaryIcon = '✅';
  let summaryText = '验证通过';

  if (errorIssues.length > 0) {
    summaryColor = '#d32f2f';
    summaryIcon = '❌';
    summaryText =
      mode === 'save'
        ? '发现严重错误，请修复后再保存。'
        : `发现 ${errorIssues.length} 个错误，请修复后再保存`;
  } else if (warningIssues.length > 0) {
    summaryColor = '#f57c00';
    summaryIcon = '⚠️';
    summaryText =
      mode === 'save'
        ? '是否继续保存？'
        : `发现 ${warningIssues.length} 个警告，建议优化`;
  } else if (suggestionIssues.length > 0) {
    summaryColor = '#1976d2';
    summaryIcon = '💡';
    summaryText =
      mode === 'save'
        ? '是否继续保存？'
        : `发现 ${suggestionIssues.length} 个建议，可选优化`;
  }

  const bgColor =
    errorIssues.length > 0
      ? '#ffebee'
      : warningIssues.length > 0
      ? '#fff3e0'
      : suggestionIssues.length > 0
      ? '#e3f2fd'
      : '#e8f5e9';

  return `<div style="margin-top: 20px; padding: 12px; background-color: ${bgColor}; border-left: 4px solid ${summaryColor}; border-radius: 4px;">
    <strong>${summaryIcon} ${summaryText}</strong>
  </div>`;
}
