/**
 * Algorithm Library Plugin
 *
 * Provides a browsable library of algorithm templates and code snippets.
 * Displays a sidebar panel with a tree view of algorithms organized by category.
 * Allows users to view algorithm details and insert code into notebooks.
 *
 * Requirements: 1.1, 2.2, 3.1
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ICommandPalette, ToolbarButton } from '@jupyterlab/apputils';
import { paletteIcon, searchIcon, saveIcon } from '@jupyterlab/ui-components';
import { showErrorMessage } from '@jupyterlab/apputils';
import { AlgorithmLibraryPanel } from './algorithm-library-panel';
import { AlgorithmLibraryDialogManager } from '../../component/algorithm/algorithm-library-dialog';
import { AlgorithmEditorDialogManager } from '../../component/algorithm/algorithm-editor-dialog';
import { LibraryService } from '../../services/library-service';
import { showDialog, Dialog } from '@jupyterlab/apputils';

/**
 * Algorithm Library Plugin
 *
 * This plugin provides:
 * - A left sidebar panel displaying algorithm categories and functions
 * - A command to open the algorithm library dialog
 * - Integration with the notebook tracker to insert code
 */
const algorithmPlugin: JupyterFrontEndPlugin<void> = {
  id: 'datafilemanager:algorithm',
  description:
    'Provides a browsable library of algorithm templates and code snippets',
  autoStart: true,
  requires: [INotebookTracker, ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    palette: ICommandPalette
  ) => {
    console.log('Algorithm Library plugin activated');

    // Add Algorithm Button to Notebook Toolbar
    tracker.widgetAdded.connect((sender, panel) => {
      const button = new ToolbarButton({
        icon: paletteIcon,
        label: '',
        tooltip: 'Insert Algorithm Widget',
        onClick: async () => {
          const session = panel.sessionContext;
          if (session.isReady) {
            const code =
              'from algorithm.widgets import AlgorithmWidget\nAlgorithmWidget()';
            // Import NotebookActions dynamically
            const { NotebookActions } = await import('@jupyterlab/notebook');

            if (panel.content.activeCell) {
              const activeCell = panel.content.activeCell;
              if (
                activeCell.model.type === 'code' &&
                activeCell.model.sharedModel.getSource().trim() === ''
              ) {
                activeCell.model.sharedModel.setSource(code);
                await NotebookActions.run(panel.content, session);
              } else {
                NotebookActions.insertBelow(panel.content);
                const newCell = panel.content.activeCell;
                if (newCell) {
                  newCell.model.sharedModel.setSource(code);
                  await NotebookActions.run(panel.content, session);
                }
              }
            }
          }
        }
      });
      panel.toolbar.insertItem(10, 'add-algorithm-widget', button);

      const browseButton = new ToolbarButton({
        icon: searchIcon,
        tooltip: 'Browse Algorithm Library',
        onClick: async () => {
          const session = panel.sessionContext;
          if (session.isReady) {
            // Lazy load manager to avoid circular deps or heavy init if possible,
            // or just new it up here.
            const manager = new AlgorithmLibraryDialogManager(app);
            const selection = await manager.selectAlgorithm(panel);

            if (selection) {
              const code = `from algorithm.widgets import AlgorithmWidget\nAlgorithmWidget(init_algo='${selection.id}')`;
              const { NotebookActions } = await import('@jupyterlab/notebook');

              if (panel.content.activeCell) {
                const activeCell = panel.content.activeCell;
                const source = activeCell.model.sharedModel.getSource().trim();

                if (source === '') {
                  // Current cell is empty, use it
                  activeCell.model.sharedModel.setSource(code);
                  await NotebookActions.run(panel.content, session);
                } else {
                  // Current cell not empty, insert below
                  NotebookActions.insertBelow(panel.content);
                  const newCell = panel.content.activeCell;
                  if (newCell) {
                    newCell.model.sharedModel.setSource(code);
                    await NotebookActions.run(panel.content, session);
                  }
                }
              }
            }
          }
        }
      });
      panel.toolbar.insertItem(11, 'browse-algorithm-library', browseButton);

      // Save Algorithm Button
      const saveAlgorithmButton = new ToolbarButton({
        icon: saveIcon,
        tooltip: '保存当前Cell为算法',
        onClick: async () => {
          await handleSaveAlgorithm(panel, app);
        }
      });
      panel.toolbar.insertItem(12, 'save-algorithm', saveAlgorithmButton);
    });

    /**
     * 处理保存算法的完整流程
     */
    async function handleSaveAlgorithm(
      panel: NotebookPanel,
      app: JupyterFrontEnd
    ): Promise<void> {
      console.log('[SaveAlgorithm] Step 1: Starting save algorithm flow');
      const libraryService = new LibraryService();

      // 1. 检查活动单元格
      const activeCell = panel.content.activeCell;
      console.log('[SaveAlgorithm] Step 1: activeCell =', activeCell);
      console.log('[SA] S1 type:', activeCell?.model?.type);
      if (!activeCell || activeCell.model.type !== 'code') {
        console.log('[SaveAlgorithm] Step 1: No code cell selected');
        await showErrorMessage('保存算法', '请选择一个代码单元格后再保存算法');
        return;
      }

      // 2. 获取单元格代码
      const cellCode = activeCell.model.sharedModel.getSource();
      console.log('[SaveAlgorithm] Step 2: code length =', cellCode?.length);
      if (!cellCode.trim()) {
        console.log('[SaveAlgorithm] Step 2: Empty cell');
        await showErrorMessage('保存算法', '代码单元格为空，无法保存');
        return;
      }

      // 3. 显示加载提示
      console.log('[SaveAlgorithm] Step 3: Creating loading dialog');
      let loadingDialog: Dialog<void> | null = new Dialog({
        title: '正在解析算法代码...',
        body: '请稍候',
        buttons: [Dialog.okButton({ label: '取消' })]
      });
      loadingDialog.launch();
      console.log('[SaveAlgorithm] Step 3: Loading dialog launched');

      try {
        // 4. 调用后端解析代码
        console.log('[SaveAlgorithm] Step 4: Parsing code...');
        let metadata: any;
        try {
          metadata = await libraryService.parseCode(cellCode);
          console.log('[SaveAlgorithm] Step 4: Parse OK', metadata);
        } catch (parseError: any) {
          console.log('[SaveAlgorithm] Step 4: Parse failed:', parseError);
          if (loadingDialog) {
            loadingDialog.reject();
            loadingDialog = null;
            console.log('[SaveAlgorithm] Step 4: Loading dialog closed');
          }

          // 检测是否为非标准代码
          const errorMsg = parseError.message || String(parseError);
          const isNonStandardCode =
            errorMsg.includes('Algorithm') ||
            errorMsg.includes('docstring') ||
            errorMsg.includes('metadata');
          console.log('[SaveAlgorithm] Step 4: isNonStd =', isNonStandardCode);

          if (isNonStandardCode) {
            // 提示用户代码需要规范化
            console.log('[SaveAlgorithm] Step 4: Showing normalize dialog...');
            const normalizeResult = await showDialog({
              title: '代码需要规范化',
              body: '当前代码不符合算法规范（缺少Algorithm元数据块）。\n\n建议使用AI侧边栏的"算法规范"功能将代码转换为标准格式后再保存。\n\n是否继续尝试保存？',
              buttons: [
                Dialog.cancelButton({ label: '取消' }),
                Dialog.okButton({ label: '强制保存' })
              ]
            });
            console.log('[SA] S4 nResult:', normalizeResult);
            console.log('[SA] S4 btn:', normalizeResult?.button);

            if (!normalizeResult?.button?.accept) {
              console.log('[SaveAlgorithm] Step 4: User cancelled');
              return;
            }

            // 用户选择强制保存，创建最小元数据
            console.log('[SaveAlgorithm] Step 4: Creating minimal metadata');
            metadata = {
              id: 'new_algorithm',
              name: 'New Algorithm',
              category: 'uncategorized',
              description: 'Algorithm description',
              prompt: '',
              args: [],
              inputs: [],
              outputs: []
            };
          } else {
            // 其他解析错误
            console.log('[SaveAlgorithm] Step 4: Other parse error');
            await showErrorMessage(
              '解析失败',
              `代码解析失败：${errorMsg}\n\n请检查代码格式是否正确。`
            );
            return;
          }
        }

        if (loadingDialog) {
          loadingDialog.reject();
          loadingDialog = null;
          console.log('[SaveAlgorithm] Step 4: Dialog closed');
        }

        // 5. 获取分类列表
        console.log('[SaveAlgorithm] Step 5: Fetching categories...');
        let categories: any[] = [];
        try {
          const prompts = await libraryService.getAlgorithmPrompts();
          categories = Object.keys(prompts).map(id => ({
            id: id,
            label: prompts[id].label
          }));
          console.log('[SaveAlgorithm] Step 5: categories =', categories);
        } catch (e) {
          console.warn('[SaveAlgorithm] Step 5: Fetch failed', e);
          // 使用默认分类
          categories = [
            { id: 'uncategorized', label: '未分类' },
            { id: 'data_operation', label: '数据操作' },
            { id: 'data_preprocessing', label: '数据预处理' },
            { id: 'eda', label: '探索式分析' }
          ];
        }

        // 6. 打开算法编辑器对话框
        console.log('[SaveAlgorithm] Step 6: Opening editor dialog...');
        console.log('[SaveAlgorithm] Step 6: metadata =', metadata);
        const editorManager = new AlgorithmEditorDialogManager();
        const editorResult = await editorManager.showEditor(
          {
            ...metadata,
            code: cellCode
          },
          categories
        );
        console.log('[SaveAlgorithm] Step 6: editorResult =', editorResult);

        if (!editorResult) {
          // 用户取消
          console.log('[SaveAlgorithm] Step 6: User cancelled editor');
          return;
        }

        // 7. 检查ID冲突
        console.log('[SaveAlgorithm] Step 7: ID check', editorResult.id);
        try {
          const existingCode = await libraryService.getAlgorithmCode(
            editorResult.id
          );
          console.log('[SA] S7 exists:', !!existingCode);
          if (existingCode) {
            // ID已存在，询问是否覆盖
            console.log('[SaveAlgorithm] Step 7: Showing overwrite dialog...');
            const overwriteResult = await showDialog({
              title: '算法ID已存在',
              body: `算法ID "${editorResult.id}" 已存在。\n\n是否覆盖现有算法？`,
              buttons: [
                Dialog.cancelButton({ label: '取消' }),
                Dialog.warnButton({ label: '覆盖' })
              ]
            });
            console.log('[SA] S7 oResult:', overwriteResult);
            console.log('[SA] S7 oBtn:', overwriteResult?.button);

            if (!overwriteResult?.button?.accept) {
              // 用户取消覆盖，直接返回
              console.log('[SaveAlgorithm] Step 7: User cancelled overwrite');
              return;
            }

            // 用户确认覆盖，使用update操作
            console.log('[SaveAlgorithm] Step 7: Updating algorithm...');
            await libraryService.manageAlgorithm('update', editorResult);
            console.log('[SaveAlgorithm] Step 7: Update complete');
          } else {
            // ID不存在，添加新算法
            console.log('[SaveAlgorithm] Step 7: Adding new algorithm...');
            await libraryService.manageAlgorithm('add', editorResult);
            console.log('[SaveAlgorithm] Step 7: Add complete');
          }
        } catch (e) {
          // 获取失败表示算法不存在，直接添加
          console.log('[SA] S7 getCode err:', e);
          await libraryService.manageAlgorithm('add', editorResult);
          console.log('[SaveAlgorithm] Step 7: Add complete (after error)');
        }

        // 8. 显示成功提示
        console.log('[SaveAlgorithm] Step 8: Showing success dialog...');
        const categoryLabel =
          categories.find(c => c.id === editorResult.category)?.label ||
          editorResult.category;
        await showDialog({
          title: '算法已保存',
          body: `"${editorResult.name}" 已保存至 ${categoryLabel}

ID: ${editorResult.id}`,
          buttons: [Dialog.okButton({ label: '确定' })]
        });
        console.log('[SaveAlgorithm] Step 8: Complete!');
      } catch (error: any) {
        console.error('[SaveAlgorithm] CAUGHT ERROR:', error);
        console.error('[SaveAlgorithm] Error stack:', error?.stack);
        if (loadingDialog) {
          loadingDialog.reject();
        }
        const errorMsg = error?.message || error?.toString() || '未知错误';
        await showErrorMessage('保存失败', `保存算法时发生错误：${errorMsg}`);
      }
    }

    try {
      // Create and add the algorithm library panel to the left sidebar
      const algoPanel = new AlgorithmLibraryPanel(app, tracker);
      app.shell.add(algoPanel, 'left', { rank: 103 });

      // Create the algorithm library dialog manager
      const algorithmLibraryDialogManager = new AlgorithmLibraryDialogManager(
        app
      );

      // Register the command to open the algorithm library dialog
      const algoLibraryOpenCommand = 'datafilemanager:open-algorithm-library';
      app.commands.addCommand(algoLibraryOpenCommand, {
        label: 'Open Algorithm Library',
        caption:
          'Open the algorithm library dialog to browse and insert algorithms',
        execute: async () => {
          // Get the current notebook panel
          const panel =
            tracker.currentWidget ??
            (app.shell.currentWidget as NotebookPanel | null);

          if (panel) {
            // Open the algorithm library dialog
            await algorithmLibraryDialogManager.openLibraryDialog(
              panel,
              null // No specific DataFrame name
            );
          } else {
            // Show error if no active notebook
            await showErrorMessage(
              'Algorithm Library',
              '未检测到活动的Notebook'
            );
          }
        }
      });

      // Add the command to the command palette
      palette.addItem({
        command: algoLibraryOpenCommand,
        category: 'Algorithm'
      });
    } catch (error) {
      console.error('[datafilemanager:algorithm] Activation failed:', error);
    }
  }
};

export default algorithmPlugin;
