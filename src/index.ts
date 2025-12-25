/**
 * DataFileManager JupyterLab Extension
 *
 * This extension provides a modular plugin architecture for managing data files,
 * DataFrames, AI assistance, algorithms, workflows, and FlowNote functionality.
 *
 * The extension is organized into the following plugins:
 * - CSV Plugin: CSV file management with data loading capabilities
 * - DataFrame Plugin: DataFrame inspection and analysis
 * - AI Plugin: AI-powered code generation and assistance
 * - Algorithm Plugin: Browsable library of algorithm templates
 * - Workflow Plugin: Visual workflow editor for notebooks
 * - FileBrowser Plugin: File browser navigation restrictions
 * - FlowNote Plugin: Flow-driven notebook functionality
 *
 * Each plugin is independently activated and can fail without affecting others.
 *
 * @packageDocumentation
 */

// Import all plugins
import csvPlugin from './plugins/csv';
import dataframePlugin from './plugins/dataframe';
import aiPlugin from './plugins/ai';
import algorithmPlugin from './plugins/algorithm';
import workflowPlugin from './plugins/workflow';
import filebrowserPlugin from './plugins/filebrowser';
import flowNotePlugin from './plugins/flownote';

/**
 * Export all plugins as a default array
 *
 * JupyterLab will automatically activate each plugin based on its configuration.
 * The order of plugins in this array does not affect activation order - JupyterLab
 * determines activation order based on plugin dependencies.
 */
export default [
  csvPlugin,
  dataframePlugin,
  aiPlugin,
  algorithmPlugin,
  workflowPlugin,
  filebrowserPlugin,
  flowNotePlugin
];
