/**
 * Save Algorithm Handler
 *
 * Handles saving notebook cell code as algorithm to library.
 */

import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel } from '@jupyterlab/notebook';
import { showErrorMessage, showDialog, Dialog } from '@jupyterlab/apputils';
import { AlgorithmEditorDialogManager } from '../../component/algorithm/algorithm-editor-dialog';
import { LibraryService } from '../../services/library-service';

/**
 * 处理保存算法的完整流程
 */
export async function handleSaveAlgorithm(
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
    const categories = await fetchCategories(libraryService);

    // 6. 打开算法编辑器对话框
    console.log('[SaveAlgorithm] Step 6: Opening editor dialog...');
    console.log('[SaveAlgorithm] Step 6: metadata =', metadata);

    // 使用清理后的代码（如果有）
    const codeToEdit = metadata.code || cellCode;
    const hasTestCode = metadata.has_test_code || false;

    if (hasTestCode) {
      console.log('[SaveAlgorithm] Step 6: Test code detected and cleaned');
    }

    const editorManager = new AlgorithmEditorDialogManager();
    const editorResult = await editorManager.showEditor(
      {
        ...metadata,
        code: codeToEdit
      },
      categories
    );
    console.log('[SaveAlgorithm] Step 6: editorResult =', editorResult);

    if (!editorResult) {
      // 用户取消
      console.log('[SaveAlgorithm] Step 6: User cancelled editor');
      return;
    }

    // 7. 检查ID冲突并保存
    console.log('[SaveAlgorithm] Step 7: Checking ID and saving...');
    await checkAndSaveAlgorithm(libraryService, editorResult);

    // 8. 重载Kernel中的算法模块
    console.log(
      '[SaveAlgorithm] Step 8: Reloading algorithm modules in Kernel...'
    );
    await reloadKernelModules(panel);

    // 9. 显示成功提示
    console.log('[SaveAlgorithm] Step 9: Showing success dialog...');
    const categoryLabel =
      categories.find(c => c.id === editorResult.category)?.label ||
      editorResult.category;
    await showDialog({
      title: '算法已保存',
      body: `"${editorResult.name}" 已保存至 ${categoryLabel}

ID: ${editorResult.id}`,
      buttons: [Dialog.okButton({ label: '确定' })]
    });
    console.log('[SaveAlgorithm] Step 9: Complete!');
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

/**
 * Fetch algorithm categories
 */
async function fetchCategories(
  libraryService: LibraryService
): Promise<Array<{ id: string; label: string }>> {
  console.log('[SaveAlgorithm] Step 5: Fetching categories...');
  try {
    const prompts = await libraryService.getAlgorithmPrompts();
    const categories = Object.keys(prompts).map(id => ({
      id: id,
      label: prompts[id].label
    }));
    console.log('[SaveAlgorithm] Step 5: categories =', categories);
    return categories;
  } catch (e) {
    console.warn('[SaveAlgorithm] Step 5: Fetch failed', e);
    // 使用默认分类
    return [
      { id: 'uncategorized', label: '未分类' },
      { id: 'data_operation', label: '数据操作' },
      { id: 'data_preprocessing', label: '数据预处理' },
      { id: 'eda', label: '探索式分析' }
    ];
  }
}

/**
 * Check for ID conflicts and save algorithm
 */
async function checkAndSaveAlgorithm(
  libraryService: LibraryService,
  editorResult: any
): Promise<void> {
  console.log('[SaveAlgorithm] Step 7: ID check', editorResult.id);
  try {
    const existingCode = await libraryService.getAlgorithmCode(editorResult.id);
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
}

/**
 * Reload algorithm modules in Jupyter Kernel
 */
async function reloadKernelModules(panel: NotebookPanel): Promise<void> {
  try {
    const session = panel.sessionContext;
    if (session.isReady && session.session?.kernel) {
      // 构造重载命令（递归清除所有algorithm子模块缓存）
      const reloadCode = `
import sys

# 清除algorithm相关所有模块缓存（除了widgets）
modules_to_remove = []
for name in list(sys.modules.keys()):
    # 清除algorithm主模块和所有子模块（递归，除了widgets相关）
    if (name == 'algorithm' or name.startswith('algorithm.')) and 'widgets' not in name:
        modules_to_remove.append(name)

# 删除缓存
for name in modules_to_remove:
    del sys.modules[name]

if modules_to_remove:
    print(f'[JuServer] 已清除 {len(modules_to_remove)} 个算法模块缓存，请重新执行 import 语句')
`;

      // 执行重载命令
      const future = session.session.kernel.requestExecute({
        code: reloadCode,
        store_history: false,
        silent: true
      });

      await future.done;
      console.log('[SaveAlgorithm] Step 8: Kernel reload complete');
    }
  } catch (reloadError: any) {
    console.warn('[SaveAlgorithm] Step 8: Kernel reload failed:', reloadError);
    // 重载失败不影响保存流程，继续执行
  }
}
