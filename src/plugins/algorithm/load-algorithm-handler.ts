/**
 * Load Algorithm Handler
 *
 * Handles loading algorithms from library to notebook cells.
 */

import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel } from '@jupyterlab/notebook';
import { showErrorMessage } from '@jupyterlab/apputils';
import { AlgorithmLibraryDialogManager } from '../../component/algorithm/algorithm-library-dialog';

/**
 * Handle Load Algorithm to Cell
 */
export async function handleLoadAlgorithm(
  panel: NotebookPanel,
  app: JupyterFrontEnd
): Promise<void> {
  console.log('[LoadAlgorithm] Starting load algorithm flow');

  // 1. 检查活动单元格
  const activeCell = panel.content.activeCell;
  if (!activeCell) {
    await showErrorMessage('无活动单元格', '请先选择一个Notebook单元格');
    return;
  }

  if (activeCell.model.type !== 'code') {
    await showErrorMessage('无效单元格类型', '请选择一个代码单元格');
    return;
  }

  // 2. 直接调用算法库对话框（与 Browse Algorithm Library 一致）
  const libraryDialogManager = new AlgorithmLibraryDialogManager(app);
  await libraryDialogManager.openLibraryDialog(panel, 'df');
}
