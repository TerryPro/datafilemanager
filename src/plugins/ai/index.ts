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
import { ISettingRegistry } from '@jupyterlab/settingregistry';
// 移除菜单依赖，直接使用默认设置编辑器
import { AiSidebar } from './ai-sidebar';
// 不再使用自定义设置弹窗
import { PageConfig } from '@jupyterlab/coreutils';

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
  requires: [INotebookTracker, ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    settingRegistry: ISettingRegistry
  ) => {
    console.log('JupyterLab extension datafilemanager:ai is activated!');

    const PLUGIN_ID = 'datafilemanager:ai';
    let lastProvider: string | null = null;
    let updatingSettings = false;
    let initialized = false;

    /**
     * Load the settings for this extension
     *
     * @param settings - The setting registry settings
     */
    /**
     * 同步前端设置到后端 ConfigManager
     *
     * @param aiProvider 选中的提供商名称
     * @param apiKey 提供商的 API Key
     * @param modelName 模型名称
     * @param temperature 采样温度
     */
    async function syncBackend(
      aiProvider: string,
      apiKey: string,
      modelName: string,
      temperature: number
    ): Promise<void> {
      const baseUrl = PageConfig.getOption('baseUrl') || '/';
      const url = `${baseUrl}aiserver/config`;
      try {
        const updates = {
          default_provider: aiProvider,
          providers: {
            [aiProvider]: {
              api_key: apiKey,
              model: modelName,
              temperature,
              enabled: true
            }
          }
        };
        const resp = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        if (!resp.ok) {
          console.warn(
            '[datafilemanager:ai] Backend config sync failed:',
            resp.status,
            resp.statusText
          );
        } else {
          console.log('[datafilemanager:ai] Backend config synced');
        }
      } catch (err) {
        console.warn('[datafilemanager:ai] Backend config sync error:', err);
      }
    }

    // 移除交互式 API Key 设置命令，改为通过默认设置编辑器管理

    /**
     * 加载并处理当前插件设置
     *
     * @param settings 设置对象实例
     */
    async function fetchBackendConfig(): Promise<any> {
      const baseUrl = PageConfig.getOption('baseUrl') || '/';
      const url = `${baseUrl}aiserver/config`;
      const resp = await fetch(url, { method: 'GET' });
      const raw = await resp.text();
      try {
        return JSON.parse(raw);
      } catch {
        return raw as any;
      }
    }

    async function applyBackendToSettings(
      settings: ISettingRegistry.ISettings,
      cfg: any
    ): Promise<void> {
      const provider = (cfg?.default_provider as string) || 'deepseek';
      const pc = (cfg?.providers || {})[provider] || {};
      updatingSettings = true;
      await settings.set('ai_provider', provider);
      await settings.set('api_key', pc.api_key ?? '');
      await settings.set('model_name', pc.model ?? 'deepseek-coder');
      await settings.set('temperature', pc.temperature ?? 0.1);
      updatingSettings = false;
      lastProvider = provider;
    }

    async function onSettingsChanged(
      settings: ISettingRegistry.ISettings
    ): Promise<void> {
      if (updatingSettings) {
        return;
      }
      const aiProvider = settings.get('ai_provider').composite as string;
      const apiKey = settings.get('api_key').composite as string;
      const modelName = settings.get('model_name').composite as string;
      const temperature = settings.get('temperature').composite as number;

      if (!initialized) {
        try {
          const cfg = await fetchBackendConfig();
          await applyBackendToSettings(settings, cfg);
          initialized = true;
        } catch (err) {
          console.warn(
            '[datafilemanager:ai] Failed to init from backend:',
            err
          );
        }
        return;
      }

      if (lastProvider === null) {
        lastProvider = aiProvider;
      }
      if (lastProvider !== aiProvider) {
        lastProvider = aiProvider;
        try {
          const cfg = await fetchBackendConfig();
          const pc = (cfg?.providers || {})[aiProvider] || {};
          updatingSettings = true;
          await settings.set('api_key', pc.api_key ?? '');
          await settings.set('model_name', pc.model ?? modelName);
          await settings.set(
            'temperature',
            pc.temperature ?? temperature ?? 0.1
          );
          updatingSettings = false;
          await syncBackend(
            aiProvider,
            pc.api_key ?? '',
            pc.model ?? modelName,
            pc.temperature ?? temperature ?? 0.1
          );
        } catch (err) {
          updatingSettings = false;
          console.warn(
            '[datafilemanager:ai] Provider switch sync failed:',
            err
          );
        }
        return;
      }

      await syncBackend(aiProvider, apiKey, modelName, temperature);
    }

    // Wait for the application to be restored and
    // for the settings for this plugin to be loaded
    Promise.all([app.restored, settingRegistry.load(PLUGIN_ID)])
      .then(([, settings]) => {
        void onSettingsChanged(settings);
        settings.changed.connect(() => {
          void onSettingsChanged(settings);
        });
      })
      .catch(reason => {
        console.error(
          `Something went wrong when reading the settings for ${PLUGIN_ID}.`,
          reason
        );
      });

    // 取消自定义设置相关命令与菜单项，直接使用 JupyterLab 默认设置编辑器

    // Register command to open AI sidebar (used by Notebook toolbar)
    const COMMAND_AI_OPEN = 'datafilemanager:ai-open';
    app.commands.addCommand(COMMAND_AI_OPEN, {
      label: 'Open AI Assistant',
      execute: () => {
        app.shell.activateById('ai-sidebar');
      }
    });

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
// NOTE: The command `datafilemanager:ai-open` is registered inside the
// plugin activation function to ensure it has access to the `app` instance.
