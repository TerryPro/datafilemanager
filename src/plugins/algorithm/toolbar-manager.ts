/**
 * Notebook Toolbar Manager
 *
 * Manages algorithm-related toolbar buttons for notebooks.
 */

import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel, NotebookActions } from '@jupyterlab/notebook';
import { ToolbarButton } from '@jupyterlab/apputils';
import {
  paletteIcon,
  searchIcon,
  saveIcon,
  addIcon
} from '@jupyterlab/ui-components';
import { AlgorithmLibraryDialogManager } from '../../component/algorithm/algorithm-library-dialog';
import { handleLoadAlgorithm } from './load-algorithm-handler';
import { handleSaveAlgorithm } from './save-algorithm-handler';

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
    tooltip: 'Insert Algorithm Widget',
    onClick: async () => {
      await handleInsertAlgorithmWidget(panel);
    }
  });
  panel.toolbar.insertItem(10, 'add-algorithm-widget', insertWidgetButton);

  // 2. Browse Algorithm Library Button
  const browseButton = new ToolbarButton({
    icon: searchIcon,
    tooltip: 'Browse Algorithm Library',
    onClick: async () => {
      await handleBrowseLibrary(panel, app);
    }
  });
  panel.toolbar.insertItem(11, 'browse-algorithm-library', browseButton);

  // 3. Load Algorithm to Cell Button
  const loadAlgorithmButton = new ToolbarButton({
    icon: addIcon,
    tooltip: '加载算法到Cell',
    onClick: async () => {
      await handleLoadAlgorithm(panel, app);
    }
  });
  panel.toolbar.insertItem(12, 'load-algorithm', loadAlgorithmButton);

  // 4. Save Algorithm Button
  const saveAlgorithmButton = new ToolbarButton({
    icon: saveIcon,
    tooltip: '保存当前Cell为算法',
    onClick: async () => {
      await handleSaveAlgorithm(panel, app);
    }
  });
  panel.toolbar.insertItem(13, 'save-algorithm', saveAlgorithmButton);
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

/**
 * Handle Browse Library
 */
async function handleBrowseLibrary(
  panel: NotebookPanel,
  app: JupyterFrontEnd
): Promise<void> {
  const session = panel.sessionContext;
  if (!session.isReady) {
    return;
  }

  const manager = new AlgorithmLibraryDialogManager(app);
  const selection = await manager.selectAlgorithm(panel);

  if (selection) {
    const code = `from algorithm.widgets import AlgorithmWidget\nAlgorithmWidget(init_algo='${selection.id}')`;

    if (panel.content.activeCell) {
      const activeCell = panel.content.activeCell;
      const source = activeCell.model.sharedModel.getSource().trim();

      if (source === '') {
        // Current cell is empty, use it
        activeCell.model.sharedModel.setSource(code);
        await NotebookActions.run(panel.content, session);
      } else {
        // Current cell not empty, insert below
        NotebookActions.insertBelow(panel.content);
        const newCell = panel.content.activeCell;
        if (newCell) {
          newCell.model.sharedModel.setSource(code);
          await NotebookActions.run(panel.content, session);
        }
      }
    }
  }
}
