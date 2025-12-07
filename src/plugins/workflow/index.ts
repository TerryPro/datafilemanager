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
import { ServiceManager } from '@jupyterlab/services';
import { WorkflowWidget } from '../../components/workflow/WorkflowWidget';
import { WorkflowButtonManager } from '../../components/workflow/workflow-button-manager';

/**
 * Workflow Editor Plugin
 *
 * This plugin provides:
 * - A toolbar button in notebooks to open the workflow editor
 * - A command to open the workflow editor in split-right mode
 * - Integration with the notebook tracker for workflow execution
 */
const workflowPlugin: JupyterFrontEndPlugin<void> = {
  id: 'datafilemanager:workflow',
  description:
    'Provides visual workflow editor for creating and managing notebook workflows',
  autoStart: true,
  requires: [INotebookTracker, ICommandPalette],
  optional: [IToolbarWidgetRegistry],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    palette: ICommandPalette,
    toolbarRegistry?: IToolbarWidgetRegistry
  ) => {
    console.log('Workflow Editor plugin activated');

    try {
      // Define the workflow editor command ID
      const workflowCommandId = 'datafilemanager:open-workflow-editor';

      // Register the workflow editor command
      app.commands.addCommand(workflowCommandId, {
        label: 'Open Workflow Editor',
        caption: 'Open the visual workflow editor in split view',
        execute: () => {
          // Cast to ServiceManager for compatibility
          const serviceManager =
            app.serviceManager as unknown as ServiceManager;

          // Create the workflow widget
          const content = new WorkflowWidget(tracker, serviceManager);

          // Open in split-right mode to show side-by-side with notebook
          app.shell.add(content, 'main', { mode: 'split-right' });

          // Activate the widget
          app.shell.activateById(content.id);
        }
      });

      // Add the command to the command palette
      palette.addItem({
        command: workflowCommandId,
        category: 'Workflow'
      });

      // Initialize the workflow button manager for toolbar integration
      const workflowButtonManager = new WorkflowButtonManager(
        tracker,
        toolbarRegistry,
        () => app.commands.execute(workflowCommandId)
      );

      // Initialize the workflow button (adds to toolbar)
      workflowButtonManager.initialize();
    } catch (error) {
      console.error('[datafilemanager:workflow] Activation failed:', error);
    }
  }
};

export default workflowPlugin;
