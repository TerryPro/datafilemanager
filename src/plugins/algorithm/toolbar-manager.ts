/**
 * Notebook Toolbar Manager
 *
 * Manages algorithm-related toolbar buttons for notebooks.
 */

import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel, NotebookActions } from '@jupyterlab/notebook';
import { ToolbarButton } from '@jupyterlab/apputils';
import { paletteIcon, saveIcon, checkIcon } from '@jupyterlab/ui-components';
import { handleSaveAlgorithm } from './save-algorithm-handler';
import { handleValidateAlgorithm } from './validate-algorithm-handler';

/**
 * Setup algorithm toolbar buttons for a notebook panel
 */
export function setupAlgorithmToolbar(
  panel: NotebookPanel,
  app: JupyterFrontEnd
): void {
  // 1. Insert Algorithm Widget Button
  const insertWidgetButton = new ToolbarButton({
    icon: paletteIcon,
    label: '',
    tooltip: '插入算法小部件',
    onClick: async () => {
      await handleInsertAlgorithmWidget(panel);
    }
  });
  panel.toolbar.insertItem(10, 'add-algorithm-widget', insertWidgetButton);

  // 2. Validate Algorithm Button
  const validateAlgorithmButton = new ToolbarButton({
    icon: checkIcon,
    tooltip: '验证算法格式',
    onClick: async () => {
      await handleValidateAlgorithm(panel, app);
    }
  });
  panel.toolbar.insertItem(11, 'validate-algorithm', validateAlgorithmButton);

  // 3. Save Algorithm Button
  const saveAlgorithmButton = new ToolbarButton({
    icon: saveIcon,
    tooltip: '保存算法',
    onClick: async () => {
      await handleSaveAlgorithm(panel, app);
    }
  });
  panel.toolbar.insertItem(12, 'save-algorithm', saveAlgorithmButton);
}

/**
 * Handle Insert Algorithm Widget
 */
async function handleInsertAlgorithmWidget(
  panel: NotebookPanel
): Promise<void> {
  const session = panel.sessionContext;
  if (!session.isReady) {
    return;
  }

  const code =
    'from algorithm.widgets import AlgorithmWidget\nAlgorithmWidget()';

  if (panel.content.activeCell) {
    const activeCell = panel.content.activeCell;
    if (
      activeCell.model.type === 'code' &&
      activeCell.model.sharedModel.getSource().trim() === ''
    ) {
      // Use current empty cell
      activeCell.model.sharedModel.setSource(code);
      await NotebookActions.run(panel.content, session);
    } else {
      // Insert below
      NotebookActions.insertBelow(panel.content);
      const newCell = panel.content.activeCell;
      if (newCell) {
        newCell.model.sharedModel.setSource(code);
        await NotebookActions.run(panel.content, session);
      }
    }
  }
}
