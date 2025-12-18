/**
 * Validate Algorithm Handler
 *
 * Handles validating notebook cell code as algorithm without saving.
 */

import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel } from '@jupyterlab/notebook';
import { showErrorMessage, showDialog, Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { LibraryService } from '../../services/library-service';

/**
 * 处理算法验证的完整流程（仅验证，不保存）
 */
export async function handleValidateAlgorithm(
  panel: NotebookPanel,
  app: JupyterFrontEnd
): Promise<void> {
  console.log('[ValidateAlgorithm] Starting validation flow');
  const libraryService = new LibraryService();

  // 1. 检查活动单元格
  const activeCell = panel.content.activeCell;
  if (!activeCell || activeCell.model.type !== 'code') {
    await showErrorMessage('验证算法', '请选择一个代码单元格后再验证');
    return;
  }

  // 2. 获取单元格代码
  const cellCode = activeCell.model.sharedModel.getSource();
  if (!cellCode.trim()) {
    await showErrorMessage('验证算法', '代码单元格为空，无法验证');
    return;
  }

  // 3. 显示加载提示
  const loadingDialog = new Dialog({
    title: '正在验证算法代码...',
    body: '请稍候',
    buttons: [Dialog.okButton({ label: '取消' })]
  });
  loadingDialog.launch();

  try {
    // 4. 调用验证API
    const validationResult = await libraryService.validateCode(cellCode);
    console.log('[ValidateAlgorithm] Validation result =', validationResult);

    // 关闭加载对话框
    loadingDialog.reject();

    // 5. 显示验证结果
    if (validationResult.issues && validationResult.issues.length > 0) {
      await showValidationResultDialog(validationResult);
    } else {
      // 没有任何问题
      await showDialog({
        title: '✅ 验证通过',
        body: '代码格式完全符合规范，没有发现任何问题！',
        buttons: [Dialog.okButton({ label: '确定' })]
      });
    }
  } catch (error: any) {
    // 关闭加载对话框
    loadingDialog.reject();

    console.error('[ValidateAlgorithm] Validation failed:', error);
    const errorMsg = error?.message || error?.toString() || '未知错误';
    await showErrorMessage('验证失败', `验证算法时发生错误：${errorMsg}`);
  }
}

/**
 * 显示验证结果对话框
 */
async function showValidationResultDialog(
  validationResult: any
): Promise<void> {
  const { issues } = validationResult;

  const errorIssues = issues.filter((i: any) => i.level === 'error');
  const warningIssues = issues.filter((i: any) => i.level === 'warning');
  const suggestionIssues = issues.filter((i: any) => i.level === 'suggestion');

  // 创建HTML内容
  const createIssueList = (
    title: string,
    issues: any[],
    color: string,
    icon: string
  ): string => {
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
  };

  let bodyHtml =
    '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.6; padding: 10px; max-height: 500px; overflow-y: auto;">';

  bodyHtml += createIssueList('错误', errorIssues, '#d32f2f', '❌');
  bodyHtml += createIssueList('警告', warningIssues, '#f57c00', '⚠️');
  bodyHtml += createIssueList('建议', suggestionIssues, '#1976d2', '💡');

  // 总结信息
  let summaryColor = '#4caf50'; // 绿色
  let summaryIcon = '✅';
  let summaryText = '验证通过';

  if (errorIssues.length > 0) {
    summaryColor = '#d32f2f'; // 红色
    summaryIcon = '❌';
    summaryText = `发现 ${errorIssues.length} 个错误，请修复后再保存`;
  } else if (warningIssues.length > 0) {
    summaryColor = '#f57c00'; // 橙色
    summaryIcon = '⚠️';
    summaryText = `发现 ${warningIssues.length} 个警告，建议优化`;
  } else if (suggestionIssues.length > 0) {
    summaryColor = '#1976d2'; // 蓝色
    summaryIcon = '💡';
    summaryText = `发现 ${suggestionIssues.length} 个建议，可选优化`;
  }

  bodyHtml += '<div style="margin-top: 20px; padding: 12px; background-color: ';
  bodyHtml +=
    errorIssues.length > 0
      ? '#ffebee'
      : warningIssues.length > 0
      ? '#fff3e0'
      : suggestionIssues.length > 0
      ? '#e3f2fd'
      : '#e8f5e9';
  bodyHtml += `; border-left: 4px solid ${summaryColor}; border-radius: 4px;">`;
  bodyHtml += `<strong>${summaryIcon} ${summaryText}</strong>`;
  bodyHtml += '</div>';

  bodyHtml += '</div>';

  // 创建Widget来显示HTML内容
  const bodyWidget = new Widget();
  bodyWidget.node.innerHTML = bodyHtml;

  await showDialog({
    title: '算法格式验证结果',
    body: bodyWidget,
    buttons: [Dialog.okButton({ label: '确定' })]
  });
}
