import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker, INotebookModel } from '@jupyterlab/notebook';
import { ILauncher } from '@jupyterlab/launcher';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { ICommandPalette } from '@jupyterlab/apputils';
import { notebookIcon } from '@jupyterlab/ui-components';
import { FlowNoteIntegration } from './integration/FlowNoteIntegration';

const flowNotePlugin: JupyterFrontEndPlugin<void> = {
  id: 'datafilemanager:flownote',
  description: 'FlowNote: Flow-driven Jupyter Notebook',
  autoStart: true,
  requires: [
    INotebookTracker,
    IDocumentManager,
    ICommandPalette,
    IDefaultFileBrowser
  ],
  optional: [ILauncher],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    docManager: IDocumentManager,
    palette: ICommandPalette,
    defaultFileBrowser: IDefaultFileBrowser,
    launcher: ILauncher | null
  ) => {
    console.log('FlowNote extension is activated!');

    tracker.widgetAdded.connect((sender, panel) => {
      FlowNoteIntegration.manage(panel);
    });

    // Also attach to existing widgets if any
    tracker.forEach(panel => {
      FlowNoteIntegration.manage(panel);
    });

    // Add Command to create new FlowNote
    const command = 'flownote:create-new';
    app.commands.addCommand(command, {
      label: 'FlowNote Notebook',
      caption: 'Create a new FlowNote-enabled Notebook',
      icon: notebookIcon,
      execute: async () => {
        // Get current path from default file browser
        const cwd = defaultFileBrowser.model.path;

        // Create a new untitled notebook in current directory
        const model = await docManager.newUntitled({
          path: cwd,
          type: 'notebook'
        });

        // Open the notebook
        const widget = docManager.open(model.path);

        if (widget) {
          // Wait for context to be ready
          const context = docManager.contextForWidget(widget);
          if (context) {
            await context.ready;
            // Set metadata
            const notebookModel = context.model as INotebookModel;
            // Use sharedModel to set metadata for RTC compatibility and correct API usage in JL4
            notebookModel.sharedModel.setMetadata('use_stepbook', true);
            // Save changes
            await context.save();
          }
        }
      }
    });

    // Add to Palette
    palette.addItem({ command, category: 'Notebook' });

    // Add to Launcher
    if (launcher) {
      launcher.add({
        command,
        category: 'Notebook',
        rank: 1
      });
    }
  }
};

export default flowNotePlugin;
