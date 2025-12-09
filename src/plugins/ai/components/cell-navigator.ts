/**
 * CellNavigator Component
 *
 * Displays a list of notebook cells for quick navigation.
 */

import { Widget } from '@lumino/widgets';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ICONS } from '../utils/icons';
import { createButton } from '../utils/dom-utils';

export interface ICellNavigatorProps {
  tracker: INotebookTracker;
}

export class CellNavigator extends Widget {
  private props: ICellNavigatorProps;
  private popup: HTMLElement;
  private _isVisible = false;
  private toggleBtn: HTMLButtonElement;

  constructor(props: ICellNavigatorProps) {
    super();
    this.props = props;
    this.addClass('ai-cell-navigator');

    // Create toggle button
    this.toggleBtn = createButton(
      'ai-sidebar-nav-btn',
      ICONS.list,
      '导航到单元格',
      () => this.toggle()
    );
    this.node.appendChild(this.toggleBtn);

    // Create popup element
    this.popup = document.createElement('div');
    this.popup.className = 'ai-cell-navigator-popup';
    this.node.appendChild(this.popup);

    // Click outside to close
    document.addEventListener('click', e => {
      if (!this.node.contains(e.target as Node)) {
        this.hide();
      }
    });
  }

  /**
   * Toggle popup visibility
   */
  toggle(): void {
    this._isVisible = !this._isVisible;

    if (this._isVisible) {
      this.popup.classList.add('visible');
      this.loadCells();
    } else {
      this.popup.classList.remove('visible');
    }
  }

  /**
   * Hide popup
   */
  hide(): void {
    this._isVisible = false;
    this.popup.classList.remove('visible');
  }

  /**
   * Load cells from current notebook
   */
  private loadCells(): void {
    this.popup.innerHTML = '';
    const notebookPanel = this.props.tracker.currentWidget as NotebookPanel;

    if (!notebookPanel) {
      this.showEmpty('无活动 Notebook');
      return;
    }

    const cells = notebookPanel.content.widgets;
    if (cells.length === 0) {
      this.showEmpty('无单元格');
      return;
    }

    cells.forEach((cell, index) => {
      const item = document.createElement('div');
      item.className = 'ai-cell-item';

      // Determine type and content
      const type = cell.model.type;
      let content = cell.model.sharedModel.getSource();

      // Truncate content
      const maxLength = 60;
      content = content.replace(/\n/g, ' ').trim();
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '...';
      }
      if (!content) {
        content = '(空单元格)';
      }

      // Icon/Label for type
      const typeLabel =
        type === 'code' ? '[Code]' : type === 'markdown' ? '[MD]' : '[Raw]';

      item.innerHTML = `
        <span class="cell-type ${type}">${typeLabel}</span>
        <span class="cell-content">${content}</span>
      `;

      item.onclick = () => {
        // Activate cell
        notebookPanel.content.activeCellIndex = index;

        // Scroll to cell
        const cellNode = cell.node;
        cellNode.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight logic (optional, but good for UX)
        // ...

        this.hide();
      };

      this.popup.appendChild(item);
    });
  }

  private showEmpty(message: string): void {
    const div = document.createElement('div');
    div.className = 'ai-cell-empty';
    div.textContent = message;
    this.popup.appendChild(div);
  }
}
