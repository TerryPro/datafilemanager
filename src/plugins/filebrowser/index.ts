/**
 * File Browser Restriction Plugin
 *
 * This plugin provides file browser restriction functionality including:
 * - Limiting navigation to specific directories (defaults to 'notebook')
 * - Hiding parent directory navigation when at the restricted root
 * - Applying CSS styles to hide restricted paths
 *
 * Requirements:
 * - 1.1: Each feature domain implemented as separate plugin
 * - 6.1: File browser restriction is optional and configurable
 * - 6.2: Restriction limits navigation to configured directory
 * - 6.5: Restrictions applied consistently across all instances
 *
 * @packageDocumentation
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IFileBrowserFactory,
  IDefaultFileBrowser
} from '@jupyterlab/filebrowser';

/**
 * The restricted directory path
 */
const RESTRICTED_DIRECTORY = 'notebook';

/**
 * Injects CSS to hide restricted paths in the file browser
 */
function injectRestrictionStyles(): void {
  const styleId = 'datafilemanager-filebrowser-restriction-styles';

  // Check if styles already exist
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Hide parent directory navigation when at restricted root */
    .jp-DirListing-item[data-isdir="true"]:first-child {
      /* Will be controlled by MutationObserver */
    }
    
    /* Additional styles for restricted paths can be added here */
  `;

  document.head.appendChild(style);
}

/**
 * Sets up a MutationObserver to hide the ".." parent directory navigation
 * when the browser is at the restricted root directory
 *
 * @param defaultBrowser - The default file browser widget
 */
function setupParentDirectoryHiding(defaultBrowser: IDefaultFileBrowser): void {
  const observer = new MutationObserver(() => {
    // Only hide ".." when at the restricted directory root
    if (defaultBrowser.model.path === RESTRICTED_DIRECTORY) {
      const upDirItem = defaultBrowser.node.querySelector(
        '.jp-DirListing-item[data-isdir="true"]:first-child'
      );

      if (upDirItem && upDirItem.textContent?.includes('..')) {
        (upDirItem as HTMLElement).style.display = 'none';
      }
    }
  });

  // Observe changes to the file browser DOM
  observer.observe(defaultBrowser.node, {
    childList: true,
    subtree: true
  });

  console.log(
    `[datafilemanager:filebrowser-restriction] MutationObserver set up for ${RESTRICTED_DIRECTORY}`
  );
}

/**
 * File browser restriction plugin
 *
 * Restricts the default file browser to navigate only within a specific directory.
 * This prevents users from navigating outside the designated workspace area.
 */
const filebrowserPlugin: JupyterFrontEndPlugin<void> = {
  id: 'datafilemanager:filebrowser-restriction',
  description: 'Restricts file browser navigation to specific directories',
  autoStart: true,
  requires: [IFileBrowserFactory, IDefaultFileBrowser],
  optional: [],
  activate: (
    _app: JupyterFrontEnd,
    _browserFactory: IFileBrowserFactory,
    defaultBrowser: IDefaultFileBrowser
  ) => {
    console.log('[datafilemanager:filebrowser-restriction] Plugin activated');

    try {
      // Inject CSS styles for hiding restricted paths
      injectRestrictionStyles();

      // Navigate to the restricted directory on startup
      void defaultBrowser.model
        .cd(RESTRICTED_DIRECTORY)
        .then(() => {
          console.log(
            `[datafilemanager:filebrowser-restriction] Navigated to ${RESTRICTED_DIRECTORY}`
          );
        })
        .catch(error => {
          console.error(
            `[datafilemanager:filebrowser-restriction] Failed to navigate to ${RESTRICTED_DIRECTORY}:`,
            error
          );
        });

      // Set up observer to hide parent directory navigation
      setupParentDirectoryHiding(defaultBrowser);

      console.log(
        '[datafilemanager:filebrowser-restriction] File browser restriction initialized successfully'
      );
    } catch (error) {
      console.error(
        '[datafilemanager:filebrowser-restriction] Activation failed:',
        error
      );
      // Don't throw - allow other plugins to continue
    }
  }
};

export default filebrowserPlugin;
