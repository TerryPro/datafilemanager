/**
 * Workflow Editor Plugin
 *
 * Provides visual workflow editing functionality for creating and managing notebook workflows.
 * This plugin adds a workflow editor button to notebook toolbars and registers commands
 * to open the workflow editor in a split view.
 *
 * Requirements: 1.1, 2.2, 3.1, 3.2
 *
 * @packageDocumentation
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ICommandPalette, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ServiceManager } from '@jupyterlab/services';
import { WorkflowWidget } from './WorkflowWidget';

/**
 * Workflow Editor Plugin
 *
 * This plugin provides:
 * - A command to open the workflow editor in split-right mode
 * - A menu item in the View menu
 * - Integration with the notebook tracker for workflow execution
 */
const workflowPlugin: JupyterFrontEndPlugin<void> = {
  id: 'datafilemanager:workflow',
  description:
    'Provides visual workflow editor for creating and managing notebook workflows',
  autoStart: true,
  requires: [INotebookTracker, ICommandPalette, IMainMenu],
  optional: [IToolbarWidgetRegistry],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    palette: ICommandPalette,
    mainMenu: IMainMenu,
    toolbarRegistry?: IToolbarWidgetRegistry
  ) => {
    console.log('Workflow Editor plugin activated');

    try {
      // Define the workflow editor command ID
      const workflowCommandId = 'datafilemanager:open-workflow-editor';

      // Register the workflow editor command
      app.commands.addCommand(workflowCommandId, {
        label: '算法流程设计',
        caption: '打开算法流程设计器',
        execute: () => {
          const widgetId = 'datafilemanager-workflow-editor';

          // Try to find existing widget in the shell
          // Convert iterator to array to search
          const existingWidget = Array.from(app.shell.widgets('main')).find(
            w => w.id === widgetId
          );

          if (existingWidget && !existingWidget.isDisposed) {
            console.log(
              '[Workflow] Activating existing widget:',
              existingWidget.id
            );
            app.shell.activateById(existingWidget.id);
          } else {
            console.log('[Workflow] Creating new widget instance');
            // Cast to ServiceManager for compatibility
            const serviceManager =
              app.serviceManager as unknown as ServiceManager;

            // Create the workflow widget
            const content = new WorkflowWidget(tracker, serviceManager);
            // Ensure ID matches what we look for (though constructor sets it)
            content.id = widgetId;

            console.log('[Workflow] New widget created with ID:', content.id);

            // Open in split-right mode to show side-by-side with notebook
            app.shell.add(content, 'main', { mode: 'split-right' });
            app.shell.activateById(content.id);
          }
        }
      });

      // Add the command to the command palette
      palette.addItem({
        command: workflowCommandId,
        category: 'Workflow'
      });

      // Add to View menu
      if (mainMenu) {
        mainMenu.viewMenu.addGroup([{ command: workflowCommandId }], 10);
      }
    } catch (error) {
      console.error('[datafilemanager:workflow] Activation failed:', error);
    }
  }
};

export default workflowPlugin;
