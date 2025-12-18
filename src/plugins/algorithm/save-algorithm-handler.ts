/**
 * Save Algorithm Handler
 *
 * Handles saving notebook cell code as algorithm to library.
 */

import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel } from '@jupyterlab/notebook';
import { showErrorMessage, showDialog, Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
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
    await showErrorMessage('\u4fdd\u5b58\u7b97\u6cd5', '\u4ee3\u7801\u5355\u5143\u683c\u4e3a\u7a7a\uff0c\u65e0\u6cd5\u4fdd\u5b58');
    return;
  }
  
  // 3. \u683c\u5f0f\u68c0\u67e5\u548c\u9a8c\u8bc1
  console.log('[SaveAlgorithm] Step 3: Validating code format...');
  try {
    const validationResult = await libraryService.validateCode(cellCode);
    console.log('[SaveAlgorithm] Step 3: Validation result =', validationResult);
      
    // \u5982\u679c\u6709\u9519\u8bef\u6216\u8b66\u544a,\u663e\u793a\u9a8c\u8bc1\u7ed3\u679c\u5bf9\u8bdd\u6848
    if (validationResult.issues && validationResult.issues.length > 0) {
      const shouldContinue = await showValidationDialog(validationResult);
      if (!shouldContinue) {
        console.log('[SaveAlgorithm] Step 3: User cancelled due to validation issues');
        return;
      }
    }
  } catch (validationError: any) {
    console.warn('[SaveAlgorithm] Step 3: Validation failed:', validationError);
    // \u9a8c\u8bc1\u5931\u8d25\u4e0d\u963b\u6b62\u6d41\u7a0b,\u7ee7\u7eed\u6267\u884c
  }
  
  // 4. \u663e\u793a\u52a0\u8f7d\u63d0\u793a
  console.log('[SaveAlgorithm] Step 4: Creating loading dialog');
  let loadingDialog: Dialog<void> | null = new Dialog({
    title: '正在解析算法代码...',
    body: '请稍候',
    buttons: [Dialog.okButton({ label: '取消' })]
  });
  loadingDialog.launch();
  console.log('[SaveAlgorithm] Step 4: Loading dialog launched');
  
  try {
    // 5. \u8c03\u7528\u540e\u7aef\u89e3\u6790\u4ee3\u7801
    console.log('[SaveAlgorithm] Step 5: Parsing code...');
    let metadata: any;
    try {
      metadata = await libraryService.parseCode(cellCode);
      console.log('[SaveAlgorithm] Step 5: Parse OK', metadata);
    } catch (parseError: any) {
      console.log('[SaveAlgorithm] Step 5: Parse failed:', parseError);
      if (loadingDialog) {
        loadingDialog.reject();
        loadingDialog = null;
        console.log('[SaveAlgorithm] Step 5: Loading dialog closed');
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
    // \u91cd\u8f7d\u5931\u8d25\u4e0d\u5f71\u54cd\u4fdd\u5b58\u6d41\u7a0b\uff0c\u7ee7\u7eed\u6267\u884c
  }
}

/**
 * 显示验证结果对话框
 */
async function showValidationDialog(
  validationResult: any
): Promise<boolean> {
  const { issues } = validationResult;

  const errorIssues = issues.filter((i: any) => i.level === 'error');
  const warningIssues = issues.filter((i: any) => i.level === 'warning');
  const suggestionIssues = issues.filter((i: any) => i.level === 'suggestion');

  // 创建HTML内容
  const createIssueList = (
    title: string,
    issues: any[],
    color: string,
    icon: string
  ): string => {
    if (issues.length === 0) return '';
    let html = `<div style="margin-bottom: 20px;">`;
    html += `<div style="color: ${color}; font-weight: bold; font-size: 14px; margin-bottom: 10px; display: flex; align-items: center;">`;
    html += `<span style="margin-right: 8px;">${icon}</span>`;
    html += `<span>${title} (${issues.length} 个)</span>`;
    html += `</div>`;
    html += `<ul style="margin: 0; padding-left: 30px; list-style: decimal;">`;
    issues.forEach((issue: any) => {
      html += `<li style="margin-bottom: 8px; line-height: 1.5;">`;
      html += `<span>${issue.message}</span>`;
      if (issue.line) {
        html += ` <span style="color: #999; font-size: 12px;">(行 ${issue.line})</span>`;
      }
      html += `</li>`;
    });
    html += `</ul>`;
    html += `</div>`;
    return html;
  };

  let bodyHtml = '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.6; padding: 10px;">';
  
  bodyHtml += createIssueList('错误', errorIssues, '#d32f2f', '❌');
  bodyHtml += createIssueList('警告', warningIssues, '#f57c00', '⚠️');
  bodyHtml += createIssueList('建议', suggestionIssues, '#1976d2', '💡');

  if (errorIssues.length > 0) {
    bodyHtml += '<div style="margin-top: 20px; padding: 12px; background-color: #ffebee; border-left: 4px solid #d32f2f; border-radius: 4px;">';
    bodyHtml += '<strong>⚠️ 发现严重错误，请修复后再保存。</strong>';
    bodyHtml += '</div>';
  } else {
    bodyHtml += '<div style="margin-top: 20px; padding: 12px; background-color: #e3f2fd; border-left: 4px solid #1976d2; border-radius: 4px;">';
    bodyHtml += '<strong>❓ 是否继续保存？</strong>';
    bodyHtml += '</div>';
  }
  
  bodyHtml += '</div>';

  // 创建Widget来显示HTML内容
  const bodyWidget = new Widget();
  bodyWidget.node.innerHTML = bodyHtml;

  if (errorIssues.length > 0) {
    await showDialog({
      title: '代码格式检查',
      body: bodyWidget,
      buttons: [Dialog.okButton({ label: '确定' })]
    });
    return false;
  }

  const result = await showDialog({
    title: '代码格式检查',
    body: bodyWidget,
    buttons: [
      Dialog.cancelButton({ label: '取消' }),
      Dialog.okButton({ label: '继续保存' })
    ]
  });

  return result.button.accept;
}
