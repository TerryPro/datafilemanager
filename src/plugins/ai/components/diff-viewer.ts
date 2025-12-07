/**
 * DiffViewer Component
 * 
 * A modal component for displaying and interacting with code diffs.
 * Supports block-level accept/reject decisions and real-time preview of merged results.
 */

import { computeLineOps, groupIntoHunks, buildTextFromDecisions } from '../utils/diff-utils';
import { DiffOp, DiffHunk, Decision } from '../state/types';
import { createElement } from '../utils/dom-utils';

/**
 * Props for the DiffViewer component
 */
export interface DiffViewerProps {
  /** Original text before changes */
  oldText: string;
  
  /** New text with proposed changes */
  newText: string;
  
  /** Callback when user accepts changes with final merged text */
  onAccept: (finalText: string) => void;
  
  /** Callback when user rejects all changes */
  onReject: () => void;
}

/**
 * DiffViewer - A modal component for interactive code diff preview
 * 
 * This component displays a side-by-side diff view with:
 * - Left column: Original text with highlighted changes
 * - Right column: Preview of merged result based on user decisions
 * - Block-level accept/reject controls for each change hunk
 * - Global accept all/reject all buttons
 * 
 * @example
 * ```typescript
 * DiffViewer.show({
 *   oldText: 'line1\nline2\nline3',
 *   newText: 'line1\nline2 modified\nline3\nline4',
 *   onAccept: (finalText) => {
 *     console.log('Applying:', finalText);
 *   },
 *   onReject: () => {
 *     console.log('Changes rejected');
 *   }
 * });
 * ```
 */
export class DiffViewer {
  /**
   * Display the diff viewer modal
   * 
   * Creates a modal overlay with interactive diff display. The modal is centered
   * on screen and can be dismissed with Escape key or reject button.
   * 
   * @param props - Configuration for the diff viewer
   */
  static show(props: DiffViewerProps): void {
    const { oldText, newText, onAccept, onReject } = props;
    
    // Create modal overlay
    const overlay = this.createOverlay();
    
    // Create header with title and action buttons
    const { header, hunkCountLabel, acceptAllBtn, rejectAllBtn } = this.createHeader();
    
    // Create body container for diff content
    const body = this.createBody();
    
    // Create footer with apply/cancel buttons
    const { footer, acceptBtn, rejectBtn } = this.createFooter();
    
    // Create grid container for two-column layout
    const gridContainer = createElement('div');
    gridContainer.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      align-items: start;
      grid-auto-rows: max-content;
    `;
    
    // Render the interactive diff
    const { ops, decisionsProvider, setAllDecisions } = this.renderInteractiveDiff(
      oldText,
      newText,
      gridContainer
    );
    
    // Calculate and display hunk count
    const hunks = groupIntoHunks(ops);
    hunkCountLabel.textContent = `变更块：${hunks.length}`;
    
    // Assemble the modal
    body.appendChild(gridContainer);
    overlay.appendChild(header);
    overlay.appendChild(body);
    overlay.appendChild(footer);
    document.body.appendChild(overlay);
    
    // Cleanup function to remove modal
    const cleanup = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
    };
    
    // Wire up event handlers
    acceptBtn.onclick = () => {
      const finalText = buildTextFromDecisions(ops, decisionsProvider());
      cleanup();
      onAccept(finalText);
    };
    
    rejectBtn.onclick = () => {
      cleanup();
      onReject();
    };
    
    acceptAllBtn.onclick = () => {
      setAllDecisions('accept');
    };
    
    rejectAllBtn.onclick = () => {
      setAllDecisions('reject');
    };
    
    // Handle Escape key to close modal
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        cleanup();
        onReject();
      }
    };
    document.addEventListener('keydown', onKeyDown);
  }
  
  /**
   * Create the modal overlay container
   * 
   * @returns The overlay element
   */
  private static createOverlay(): HTMLDivElement {
    const overlay = createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: calc(100vw - 64px);
      max-width: 1920px;
      max-height: 80vh;
      box-sizing: border-box;
      z-index: 10000;
      background: var(--jp-layout-color1);
      border: 1px solid var(--jp-border-color2);
      border-radius: 8px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.25);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;
    return overlay;
  }
  
  /**
   * Create the header section with title and action buttons
   * 
   * @returns Object containing header element and interactive elements
   */
  private static createHeader(): {
    header: HTMLDivElement;
    hunkCountLabel: HTMLSpanElement;
    acceptAllBtn: HTMLButtonElement;
    rejectAllBtn: HTMLButtonElement;
  } {
    const header = createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid var(--jp-border-color2);
      background: var(--jp-layout-color2);
      border-radius: 8px 8px 0 0;
      font-size: 13px;
      color: var(--jp-ui-font-color1);
    `;
    
    // Left side: title and hunk count
    const headerLeft = createElement('div');
    headerLeft.style.cssText = 'display: flex; align-items: center; gap: 12px;';
    
    const titleLabel = createElement('span', undefined, 'Diff预览（AI建议 vs 当前单元）');
    
    const hunkCountLabel = createElement('span', undefined, '变更块：计算中…');
    hunkCountLabel.style.cssText = 'font-size: 12px; color: var(--jp-ui-font-color2);';
    
    headerLeft.appendChild(titleLabel);
    headerLeft.appendChild(hunkCountLabel);
    
    // Right side: action buttons
    const headerActions = createElement('div');
    headerActions.style.cssText = 'display: flex; gap: 8px;';
    
    const acceptAllBtn = createElement('button', 'jp-Button jp-mod-accept', '接受全部');
    const rejectAllBtn = createElement('button', 'jp-Button jp-mod-warn', '拒绝全部');
    
    headerActions.appendChild(rejectAllBtn);
    headerActions.appendChild(acceptAllBtn);
    
    header.appendChild(headerLeft);
    header.appendChild(headerActions);
    
    return { header, hunkCountLabel, acceptAllBtn, rejectAllBtn };
  }
  
  /**
   * Create the body section for diff content
   * 
   * @returns The body element
   */
  private static createBody(): HTMLDivElement {
    const body = createElement('div');
    body.style.cssText = `
      flex: 1;
      min-height: 0;
      overflow: auto;
      font-family: var(--jp-code-font-family);
      font-size: 13px;
      line-height: 1.5;
      padding: 12px;
    `;
    return body;
  }
  
  /**
   * Create the footer section with apply/cancel buttons
   * 
   * @returns Object containing footer element and buttons
   */
  private static createFooter(): {
    footer: HTMLDivElement;
    acceptBtn: HTMLButtonElement;
    rejectBtn: HTMLButtonElement;
  } {
    const footer = createElement('div');
    footer.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 10px 12px;
      border-top: 1px solid var(--jp-border-color2);
      background: var(--jp-layout-color2);
      border-radius: 0 0 8px 8px;
    `;
    
    const acceptBtn = createElement('button', 'jp-Button jp-mod-accept', '应用所选更改');
    const rejectBtn = createElement('button', 'jp-Button jp-mod-warn', '取消');
    
    footer.appendChild(rejectBtn);
    footer.appendChild(acceptBtn);
    
    return { footer, acceptBtn, rejectBtn };
  }
  
  /**
   * Render interactive diff with block-level controls
   * 
   * Creates a two-column layout:
   * - Left: Context lines and change hunks with accept/reject buttons
   * - Right: Preview of merged result based on current decisions
   * 
   * @param oldText - Original text
   * @param newText - New text with changes
   * @param gridContainer - Container element for the grid layout
   * @returns Object with diff operations, decision provider, and setter
   */
  private static renderInteractiveDiff(
    oldText: string,
    newText: string,
    gridContainer: HTMLDivElement
  ): {
    ops: DiffOp[];
    decisionsProvider: () => Decision[];
    setAllDecisions: (decision: Decision) => void;
  } {
    // Compute diff operations
    const oldLines = oldText.split(/\r?\n/);
    const newLines = newText.split(/\r?\n/);
    const ops = computeLineOps(oldLines, newLines);
    const hunks = groupIntoHunks(ops);
    
    // Initialize all decisions to 'accept'
    const decisions: Decision[] = hunks.map(() => 'accept');
    
    // Track right-side preview elements for batch updates
    const rightHunkViews: HTMLDivElement[] = [];
    
    // Render context lines and hunks
    let cursor = 0;
    
    /**
     * Render context lines up to the specified index
     */
    const renderContextUntil = (endIndex: number) => {
      const leftCtx = this.createContextContainer();
      const rightCtx = this.createContextContainer();
      let hasContext = false;
      const contextTexts: string[] = [];
      
      while (cursor < endIndex) {
        if (ops[cursor].type === 'ctx') {
          leftCtx.appendChild(this.createDiffLine('ctx', ops[cursor].text));
          contextTexts.push(ops[cursor].text);
          hasContext = true;
        }
        cursor++;
      }
      
      if (hasContext) {
        contextTexts.forEach(text => 
          rightCtx.appendChild(this.createPreviewLine(text))
        );
        gridContainer.appendChild(leftCtx);
        gridContainer.appendChild(rightCtx);
      }
    };
    
    // Render each hunk with controls
    hunks.forEach((hunk, hunkIndex) => {
      // Render context before this hunk
      renderContextUntil(hunk.start);
      
      // Create hunk container with header and controls
      const { hunkWrapper, acceptToggle, rejectToggle } = this.createHunkContainer(hunkIndex);
      
      // Add diff lines to hunk
      for (let k = hunk.start; k <= hunk.end; k++) {
        const op = ops[k];
        if (op.type === 'add' || op.type === 'del') {
          hunkWrapper.appendChild(this.createDiffLine(op.type, op.text));
        }
      }
      
      // Create right-side preview for this hunk
      const rightPreview = this.createHunkPreview(hunkIndex);
      
      /**
       * Update visual state and preview for this hunk
       */
      const updateVisuals = () => {
        const decision = decisions[hunkIndex];
        
        // Update button states
        if (decision === 'accept') {
          acceptToggle.classList.add('jp-mod-accept');
          rejectToggle.classList.remove('jp-mod-accept');
          hunkWrapper.style.borderColor = 'rgba(0,160,0,0.6)';
          hunkWrapper.style.background = 'rgba(0,160,0,0.06)';
        } else {
          rejectToggle.classList.add('jp-mod-accept');
          acceptToggle.classList.remove('jp-mod-accept');
          hunkWrapper.style.borderColor = 'rgba(200,0,0,0.6)';
          hunkWrapper.style.background = 'rgba(200,0,0,0.06)';
        }
        
        // Update preview
        this.updateHunkPreview(rightPreview, ops, hunk, decision);
      };
      
      // Wire up button handlers
      acceptToggle.onclick = () => {
        decisions[hunkIndex] = 'accept';
        updateVisuals();
      };
      
      rejectToggle.onclick = () => {
        decisions[hunkIndex] = 'reject';
        updateVisuals();
      };
      
      // Initial render
      updateVisuals();
      
      // Add to grid
      gridContainer.appendChild(hunkWrapper);
      gridContainer.appendChild(rightPreview);
      rightHunkViews.push(rightPreview);
      
      cursor = hunk.end + 1;
    });
    
    // Render remaining context
    renderContextUntil(ops.length);
    
    /**
     * Set all decisions to the same value and update all previews
     */
    const setAllDecisions = (decision: Decision) => {
      for (let i = 0; i < decisions.length; i++) {
        decisions[i] = decision;
      }
      
      // Batch update all hunk previews
      hunks.forEach((hunk, idx) => {
        const rightPreview = rightHunkViews[idx];
        if (rightPreview) {
          this.updateHunkPreview(rightPreview, ops, hunk, decisions[idx]);
        }
      });
    };
    
    return {
      ops,
      decisionsProvider: () => decisions.slice(),
      setAllDecisions
    };
  }
  
  /**
   * Create a container for context lines
   * 
   * @returns Container element
   */
  private static createContextContainer(): HTMLDivElement {
    const container = createElement('div');
    container.style.cssText = `
      white-space: pre;
      border: 1px dashed var(--jp-border-color2);
      border-radius: 6px;
      padding: 6px;
      background: var(--jp-layout-color1);
      min-width: 0;
      box-sizing: border-box;
    `;
    return container;
  }
  
  /**
   * Create a hunk container with header and controls
   * 
   * @param hunkIndex - Index of the hunk
   * @returns Object with container and control buttons
   */
  private static createHunkContainer(hunkIndex: number): {
    hunkWrapper: HTMLDivElement;
    acceptToggle: HTMLButtonElement;
    rejectToggle: HTMLButtonElement;
  } {
    const hunkWrapper = createElement('div');
    hunkWrapper.style.cssText = `
      border: 1px dashed var(--jp-border-color2);
      border-radius: 6px;
      padding: 6px;
      background: var(--jp-layout-color1);
      min-width: 0;
      box-sizing: border-box;
    `;
    
    // Create header with label and buttons
    const hunkHeader = createElement('div');
    hunkHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    `;
    
    const label = createElement('span', undefined, `变更块 ${hunkIndex + 1}`);
    label.style.cssText = 'color: var(--jp-ui-font-color1); font-size: 12px;';
    
    const btnRow = createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 6px;';
    
    const acceptToggle = createElement('button', 'jp-Button', '接受');
    const rejectToggle = createElement('button', 'jp-Button jp-mod-warn', '拒绝');
    
    btnRow.appendChild(rejectToggle);
    btnRow.appendChild(acceptToggle);
    
    hunkHeader.appendChild(label);
    hunkHeader.appendChild(btnRow);
    hunkWrapper.appendChild(hunkHeader);
    
    return { hunkWrapper, acceptToggle, rejectToggle };
  }
  
  /**
   * Create a preview container for a hunk
   * 
   * @param hunkIndex - Index of the hunk
   * @returns Preview container element
   */
  private static createHunkPreview(hunkIndex: number): HTMLDivElement {
    const rightPreview = createElement('div');
    rightPreview.style.cssText = `
      white-space: pre;
      border: 1px dashed var(--jp-border-color2);
      border-radius: 6px;
      padding: 6px;
      background: var(--jp-layout-color1);
      min-width: 0;
      box-sizing: border-box;
    `;
    
    const rightHeader = createElement('div');
    rightHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    `;
    
    const rightLabel = createElement('span', undefined, `变更块 ${hunkIndex + 1}（预览）`);
    rightLabel.style.cssText = 'color: var(--jp-ui-font-color1); font-size: 12px;';
    
    rightHeader.appendChild(rightLabel);
    rightPreview.appendChild(rightHeader);
    
    return rightPreview;
  }
  
  /**
   * Update the preview content for a hunk based on decision
   * 
   * @param previewContainer - The preview container element
   * @param ops - All diff operations
   * @param hunk - The hunk to preview
   * @param decision - User's decision for this hunk
   */
  private static updateHunkPreview(
    previewContainer: HTMLDivElement,
    ops: DiffOp[],
    hunk: DiffHunk,
    decision: Decision
  ): void {
    // Remove all children except the header (first child)
    while (previewContainer.childElementCount > 1) {
      previewContainer.removeChild(previewContainer.lastChild as Node);
    }
    
    // Build preview lines based on decision
    const previewLines: string[] = [];
    
    if (decision === 'accept') {
      // Accept: show additions
      for (let k = hunk.start; k <= hunk.end; k++) {
        if (ops[k].type === 'add') {
          previewLines.push(ops[k].text);
        }
      }
    } else {
      // Reject: show deletions (keep original)
      for (let k = hunk.start; k <= hunk.end; k++) {
        if (ops[k].type === 'del') {
          previewLines.push(ops[k].text);
        }
      }
    }
    
    // Add preview lines to container
    previewLines.forEach(text => 
      previewContainer.appendChild(this.createPreviewLine(text))
    );
  }
  
  /**
   * Create a diff line element
   * 
   * @param type - Type of diff operation
   * @param text - Line text
   * @returns Line element
   */
  private static createDiffLine(type: 'add' | 'del' | 'ctx', text: string): HTMLDivElement {
    const line = createElement('div');
    line.style.cssText = `
      display: block;
      padding: 2px 8px;
      border-radius: 4px;
      box-sizing: border-box;
      font-family: var(--jp-code-font-family);
      font-size: 13px;
      line-height: 1.5;
      tab-size: 4;
      font-variant-ligatures: none;
      color: var(--jp-ui-font-color1);
      white-space: pre;
    `;
    
    if (type === 'add') {
      line.style.background = 'rgba(0,160,0,0.12)';
      line.textContent = `+ ${text}`;
    } else if (type === 'del') {
      line.style.background = 'rgba(200,0,0,0.12)';
      line.textContent = `- ${text}`;
    } else {
      line.textContent = `  ${text}`;
    }
    
    return line;
  }
  
  /**
   * Create a preview line element
   * 
   * @param text - Line text
   * @returns Line element
   */
  private static createPreviewLine(text: string): HTMLDivElement {
    const line = createElement('div');
    line.style.cssText = `
      display: block;
      padding: 2px 8px;
      border-radius: 4px;
      box-sizing: border-box;
      font-family: var(--jp-code-font-family);
      font-size: 13px;
      line-height: 1.5;
      tab-size: 4;
      font-variant-ligatures: none;
      color: var(--jp-ui-font-color1);
      white-space: pre;
    `;
    
    // Use non-breaking space for empty lines to maintain layout
    const content = text && text.length > 0 ? text : '\u00A0';
    line.textContent = `  ${content}`;
    
    return line;
  }
}
