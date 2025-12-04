import React from 'react';
import { NotebookPanel } from '@jupyterlab/notebook';
import { SplitPanel, BoxLayout } from '@lumino/widgets';
import { ReactWidget } from '@jupyterlab/apputils';
import { FlowNotePanel } from './FlowNotePanel';

export class FlowNoteEnhancer {
  /**
   * Manage the notebook panel to conditionally enable FlowNote features.
   * Only attaches the FlowNote UI if 'use_stepbook' metadata is present.
   */
  static manage(panel: NotebookPanel): void {
    console.log('FlowNote: manage called for panel', panel.id);
    // Wait for context to be ready to read metadata
    panel.context.ready.then(() => {
      console.log('FlowNote: context ready for panel', panel.id);
      // Check initial state
      const checkAndAttach = () => {
        const model = panel.context.model;
        // Check metadata from sharedModel (JL4+ standard)
        const useStepbook =
          model.sharedModel.getMetadata('use_stepbook') === true;

        console.log('FlowNote: checkAndAttach, useStepbook=', useStepbook);
        if (useStepbook) {
          FlowNoteEnhancer.attach(panel);
        }
      };

      checkAndAttach();

      // Listen for sharedModel changes (more reliable for metadata updates in JL4)
      panel.context.model.sharedModel.changed.connect((sender, change) => {
        if (change.metadataChange) {
          console.log(
            'FlowNote: sharedModel metadata changed',
            change.metadataChange
          );
          checkAndAttach();
        }
      });
    });
  }

  static attach(panel: NotebookPanel): void {
    if (panel.hasClass('jp-FlowNote-Enhanced')) {
      console.log('FlowNote: Already enhanced, skipping attach');
      return;
    }
    console.log('FlowNote: Attaching FlowNote to panel', panel.id);

    panel.addClass('jp-FlowNote-Enhanced');

    // Create Flow Panel wrapper
    const flowWidget = ReactWidget.create(
      React.createElement(FlowNotePanel, {
        notebook: panel,
        serviceManager: (panel.context as any)?.manager?.services
      })
    );
    flowWidget.addClass('jp-FlowNote-Panel');
    // Do not hide by default, handle visibility in checkMetadata immediately

    // Create SplitPanel
    const splitPanel = new SplitPanel({ orientation: 'horizontal' });
    // Ensure horizontal orientation explicitly
    (splitPanel as any).orientation = 'horizontal';
    splitPanel.addClass('jp-FlowNote-SplitPanel');
    splitPanel.spacing = 4;

    // Get the Notebook widget (content)
    const notebook = panel.content;

    // Access layout
    // NotebookPanel layout is typically a BoxLayout (from DocumentWidget)
    const layout = panel.layout as any;

    // Reparent notebook to SplitPanel (no explicit remove needed; Lumino handles reparenting)

    // Insert SplitPanel
    BoxLayout.setStretch(splitPanel, 1);
    layout.addWidget(splitPanel);

    // Add Notebook and Flow to SplitPanel
    splitPanel.addWidget(notebook);
    splitPanel.addWidget(flowWidget);
    // Initial relative sizes for left-right layout
    splitPanel.setRelativeSizes([0.6, 0.4]);

    // Ensure splitPanel fills the space
    splitPanel.id = 'flownote-split-panel';

    // Initial sizing: Set based on initial metadata state
    // splitPanel.setRelativeSizes([1, 0]);

    // Metadata check function
    const checkMetadata = () => {
      const model = panel.context.model;
      const useStepbook =
        model.sharedModel.getMetadata('use_stepbook') === true;

      if (useStepbook) {
        if (flowWidget.isHidden) {
          flowWidget.show();
          splitPanel.setRelativeSizes([0.6, 0.4]);
        }
      } else {
        // Only hide if currently shown
        if (!flowWidget.isHidden) {
          flowWidget.hide();
          splitPanel.setRelativeSizes([1, 0]);
        }
      }
    };

    // Initial check
    checkMetadata();

    // Connect listeners
    // Note: checkMetadata already called once above to set initial state
    panel.context.ready.then(() => {
      // Re-check in case metadata wasn't ready initially (though manage() calls attach after ready)
      checkMetadata();
      // Listen for sharedModel changes
      panel.context.model.sharedModel.changed.connect((sender, change) => {
        if (change.metadataChange) {
          checkMetadata();
        }
      });
    });

    // Handle disposal
    panel.disposed.connect(() => {
      flowWidget.dispose();
      splitPanel.dispose();
    });
  }
}
