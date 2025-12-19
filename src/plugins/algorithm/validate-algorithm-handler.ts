/**
 * Validate Algorithm Handler
 *
 * Handles validating notebook cell code as algorithm without saving.
 */

import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel } from '@jupyterlab/notebook';
import { showErrorMessage, showDialog, Dialog } from '@jupyterlab/apputils';
import { LibraryService } from '../../services/library-service';
import {
  getActiveCodeCell,
  showValidationResultDialog
} from './algorithm-validation-ui';

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
  const cellData = getActiveCodeCell(panel);
  if (!cellData) {
    await showErrorMessage('验证算法', '请选择一个非空的代码单元格后再验证');
    return;
  }

  // 2. 显示加载提示
  const loadingDialog = new Dialog({
    title: '正在验证算法代码...',
    body: '请稍候',
    buttons: [Dialog.okButton({ label: '取消' })]
  });
  loadingDialog.launch();

  try {
    // 3. 调用验证API
    const validationResult = await libraryService.validateCode(cellData.code);
    console.log('[ValidateAlgorithm] Validation result =', validationResult);

    // 关闭加载对话框
    loadingDialog.reject();

    // 4. 显示验证结果
    if (validationResult.issues && validationResult.issues.length > 0) {
      await showValidationResultDialog(validationResult, 'validate');
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
