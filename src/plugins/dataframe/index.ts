/**
 * DataFrame Inspection Plugin
 *
 * This plugin provides DataFrame inspection functionality including:
 * - Viewing DataFrame variables in active notebooks
 * - DataFrame describe operations
 * - Saving DataFrames to files
 * - DataFrame analysis
 *
 * @packageDocumentation
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ITranslator } from '@jupyterlab/translation';
import { DataFramePanel } from './dataframe-panel';

/**
 * DataFrame inspection plugin
 *
 * Provides a sidebar panel for inspecting DataFrame variables in the active notebook.
 * Includes commands for describing DataFrames, saving them to files, and performing analysis.
 *
 * Commands registered:
 * - datafilemanager:df-describe: Show DataFrame describe() in notebook
 * - datafilemanager:df-savefile: Save DataFrame to dataset CSV
 * - datafilemanager:df-analysis: Select algorithm template for DataFrame
 */
const dataframePlugin: JupyterFrontEndPlugin<void> = {
  id: 'datafilemanager:dataframe',
  description: 'Provides DataFrame inspection and analysis functionality',
  autoStart: true,
  requires: [INotebookTracker, ITranslator],
  optional: [],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    translator: ITranslator
  ) => {
    console.log('JupyterLab extension datafilemanager:dataframe is activated!');

    try {
      // Create and register the DataFrame inspection panel
      const dfPanelComponent = new DataFramePanel(
        app,
        app.commands,
        translator,
        notebookTracker
      );

      // Add the panel to the left sidebar with rank 102
      app.shell.add(dfPanelComponent.panel, 'left', { rank: 102 });

      console.log('DataFrame inspection panel added to left sidebar');
    } catch (error) {
      console.error('[datafilemanager:dataframe] Activation failed:', error);
    }
  }
};

export default dataframePlugin;
