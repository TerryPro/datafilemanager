/**
 * CSV File Management Plugin
 *
 * This plugin provides CSV file management functionality including:
 * - File browsing in the dataset directory
 * - File upload, delete, rename, duplicate operations
 * - Loading CSV files into notebook DataFrames
 * - Context menu integration
 * - Path copying and file download
 *
 * @packageDocumentation
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ITranslator } from '@jupyterlab/translation';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CsvFileManager } from './csv-file-manager';

/**
 * CSV File Management Plugin
 *
 * Provides a dedicated file browser for CSV data files with enhanced
 * functionality for loading data into notebooks.
 */
const csvPlugin: JupyterFrontEndPlugin<void> = {
  id: 'datafilemanager:csv',
  description: 'CSV file management with data loading capabilities',
  autoStart: true,
  requires: [
    IFileBrowserFactory,
    IDocumentManager,
    ICommandPalette,
    ITranslator
  ],
  optional: [INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    browserFactory: IFileBrowserFactory,
    docManager: IDocumentManager,
    palette: ICommandPalette,
    translator: ITranslator,
    notebookTracker?: INotebookTracker
  ) => {
    console.log('[datafilemanager:csv] CSV file management plugin activated');

    try {
      // Initialize the CSV file manager component
      // This component handles:
      // - Creating a custom file browser for the dataset directory
      // - Registering all CSV-related commands
      // - Setting up context menu handlers
      // - Managing file operations (upload, delete, rename, etc.)
      // Note: The manager is instantiated for its side effects (command registration, UI setup)
      new CsvFileManager(
        app,
        browserFactory,
        docManager,
        palette,
        translator,
        notebookTracker
      );

      console.log(
        '[datafilemanager:csv] CSV file manager initialized successfully'
      );
    } catch (error) {
      console.error(
        '[datafilemanager:csv] Failed to activate CSV plugin:',
        error
      );
      // Don't throw - allow other plugins to continue loading
    }
  }
};

export default csvPlugin;
