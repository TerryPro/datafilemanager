/**
 * AI Assistant Plugin
 *
 * This plugin provides AI-powered code generation and assistance including:
 * - Chat interface for code generation
 * - Variable reference integration
 * - Algorithm selection assistance
 * - Context-aware code suggestions
 *
 * @packageDocumentation
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { AiSidebar } from './ai-sidebar';

/**
 * AI assistant plugin
 *
 * Provides a right sidebar with AI-powered code generation capabilities.
 * Requires INotebookTracker to access active notebook context.
 */
const aiPlugin: JupyterFrontEndPlugin<void> = {
  id: 'datafilemanager:ai',
  description: 'Provides AI-powered code generation and assistance',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension datafilemanager:ai is activated!');

    try {
      // Create and register AI sidebar
      const aiSidebar = new AiSidebar(app, tracker);
      app.shell.add(aiSidebar, 'right', { rank: 1000 });

      console.log('AI sidebar successfully added to right panel');
    } catch (error) {
      console.error('[datafilemanager:ai] Activation failed:', error);
    }
  }
};

export default aiPlugin;
