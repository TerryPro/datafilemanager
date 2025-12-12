/**
 * Algorithm Library Plugin
 *
 * Provides a browsable library of algorithm templates and code snippets.
 * Displays a sidebar panel with a tree view of algorithms organized by category.
 * Allows users to view algorithm details and insert code into notebooks.
 *
 * Requirements: 1.1, 2.2, 3.1
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ICommandPalette, ToolbarButton } from '@jupyterlab/apputils';
import { paletteIcon, searchIcon } from '@jupyterlab/ui-components';
import { showErrorMessage } from '@jupyterlab/apputils';
import { AlgorithmLibraryPanel } from './algorithm-library-panel';
import { AlgorithmLibraryDialogManager } from '../../component/algorithm/algorithm-library-dialog';

/**
 * Algorithm Library Plugin
 *
 * This plugin provides:
 * - A left sidebar panel displaying algorithm categories and functions
 * - A command to open the algorithm library dialog
 * - Integration with the notebook tracker to insert code
 */
const algorithmPlugin: JupyterFrontEndPlugin<void> = {
  id: 'datafilemanager:algorithm',
  description:
    'Provides a browsable library of algorithm templates and code snippets',
  autoStart: true,
  requires: [INotebookTracker, ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    palette: ICommandPalette
  ) => {
    console.log('Algorithm Library plugin activated');

    // Add Algorithm Button to Notebook Toolbar
    tracker.widgetAdded.connect((sender, panel) => {
      const button = new ToolbarButton({
        icon: paletteIcon,
        label: '',
        tooltip: 'Insert Algorithm Widget',
        onClick: async () => {
          const session = panel.sessionContext;
          if (session.isReady) {
            const code = 'from algorithm.widgets import AlgorithmWidget\nAlgorithmWidget()';
            // Import NotebookActions dynamically
            const { NotebookActions } = await import('@jupyterlab/notebook');

            if (panel.content.activeCell) {
              const activeCell = panel.content.activeCell;
              if (activeCell.model.type === 'code' && activeCell.model.sharedModel.getSource().trim() === '') {
                activeCell.model.sharedModel.setSource(code);
                await NotebookActions.run(panel.content, session);
              } else {
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
      });
      panel.toolbar.insertItem(10, 'add-algorithm-widget', button);

      const browseButton = new ToolbarButton({
        icon: searchIcon,
        tooltip: 'Browse Algorithm Library',
        onClick: async () => {
          const session = panel.sessionContext;
          if (session.isReady) {
            // Lazy load manager to avoid circular deps or heavy init if possible,
            // or just new it up here.
            const manager = new AlgorithmLibraryDialogManager(app);
            const selection = await manager.selectAlgorithm(panel);

            if (selection) {
              const code = `from algorithm.widgets import AlgorithmWidget\nAlgorithmWidget(init_algo='${selection.id}')`;
              const { NotebookActions } = await import('@jupyterlab/notebook');

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
        }
      });
      panel.toolbar.insertItem(11, 'browse-algorithm-library', browseButton);
    });

    try {
      // Create and add the algorithm library panel to the left sidebar
      const algoPanel = new AlgorithmLibraryPanel(app, tracker);
      app.shell.add(algoPanel, 'left', { rank: 103 });

      // Create the algorithm library dialog manager
      const algorithmLibraryDialogManager = new AlgorithmLibraryDialogManager(
        app
      );

      // Register the command to open the algorithm library dialog
      const algoLibraryOpenCommand = 'datafilemanager:open-algorithm-library';
      app.commands.addCommand(algoLibraryOpenCommand, {
        label: 'Open Algorithm Library',
        caption:
          'Open the algorithm library dialog to browse and insert algorithms',
        execute: async () => {
          // Get the current notebook panel
          const panel =
            tracker.currentWidget ??
            (app.shell.currentWidget as NotebookPanel | null);

          if (panel) {
            // Open the algorithm library dialog
            await algorithmLibraryDialogManager.openLibraryDialog(
              panel,
              null // No specific DataFrame name
            );
          } else {
            // Show error if no active notebook
            await showErrorMessage(
              'Algorithm Library',
              '未检测到活动的Notebook'
            );
          }
        }
      });

      // Add the command to the command palette
      palette.addItem({
        command: algoLibraryOpenCommand,
        category: 'Algorithm'
      });
    } catch (error) {
      console.error('[datafilemanager:algorithm] Activation failed:', error);
    }
  }
};

export default algorithmPlugin;
