import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { ServiceManager } from '@jupyterlab/services';
import { WorkflowEditor } from './WorkflowEditor';

export class WorkflowWidget extends ReactWidget {
  private tracker: INotebookTracker;
  private serviceManager: ServiceManager;
  private workflowData: any = null;

  constructor(tracker: INotebookTracker, serviceManager: ServiceManager) {
    super();
    this.tracker = tracker;
    this.serviceManager = serviceManager;
    // Use a fixed ID to allow finding the instance via shell.widgets()
    this.id = 'datafilemanager-workflow-editor';
    this.title.label = 'Workflow Editor';
    this.title.closable = true;
    this.addClass('jp-WorkflowEditor');

    // Listen to active cell changes
    this.tracker.activeCellChanged.connect(this.onActiveCellChanged, this);
    // Initialize with current
    this.onActiveCellChanged();
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    // Explicitly disconnect signals
    if (this.tracker) {
      this.tracker.activeCellChanged.disconnect(this.onActiveCellChanged, this);
    }
    super.dispose();
  }

  private onActiveCellChanged() {
    const cell = this.tracker.activeCell;
    if (cell) {
      const data = cell.model.sharedModel.getMetadata('aiserver_workflow');
      this.workflowData = data;
    } else {
      this.workflowData = null;
    }
    this.update();
  }

  render(): JSX.Element {
    return (
      <WorkflowEditor
        onInjectCode={this.injectCode.bind(this)}
        serviceManager={this.serviceManager}
        initialData={this.workflowData}
      />
    );
  }

  private injectCode(code: string, workflowData: any) {
    const current = this.tracker.currentWidget;

    if (!current) {
      window.alert('No active notebook found! Please open a notebook first.');
      return;
    }

    const notebook = current.content;

    // Get the active cell
    let activeCell = notebook.activeCell;

    // Only create a new cell if there is no active cell (which is rare, e.g. empty notebook?)
    // Or if the user specifically requested behavior for "new file without cell" (though new files usually have 1 empty cell)
    // We'll assume if activeCell is null, we try to insert one.
    if (!activeCell) {
      NotebookActions.insertBelow(notebook);
      activeCell = notebook.activeCell;
    }

    if (activeCell) {
      activeCell.model.sharedModel.setSource(code);
      // Save workflow data to cell metadata
      activeCell.model.sharedModel.setMetadata(
        'aiserver_workflow',
        workflowData
      );
    }
  }
}
