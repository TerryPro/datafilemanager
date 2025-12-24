import React, { Suspense } from 'react';
import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { ReactWidget } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';

// Lazy load TableWalker to prevent bundle loading issues
const TableWalker = React.lazy(() => import('@kanaries/graphic-walker').then(module => ({ default: module.TableWalker as any }))) as any;

/**
 * The MIME type for TableWalker.
 */
export const MIME_TYPE = 'application/vnd.kanaries.tablewalker+json';

/**
 * A widget for rendering TableWalker.
 */
export class TableWalkerWidget extends ReactWidget implements IRenderMime.IRenderer {
  constructor(options: IRenderMime.IRendererOptions) {
    super();
    this._mimeType = options.mimeType;
  }

  async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const data = model.data[this._mimeType] as any;
    this._data = data?.data || [];
    this._fields = data?.fields || [];
    this.update();
  }

  protected render(): React.ReactElement {
    if (!this._data || !this._fields) {
      return <div>No data available</div>;
    }

    return (
      <div style={{ width: '100%', height: '600px', overflow: 'hidden' }}>
        <Suspense fallback={<div>Loading TableWalker...</div>}>
          <TableWalker 
              data={this._data} 
              rawFields={this._fields}
              fields={this._fields} 
              themeKey="g2"
          />
        </Suspense>
      </div>
    );
  }

  private _mimeType: string;
  private _data: any[] = [];
  private _fields: any[] = [];
}

/**
 * A mime renderer factory for TableWalker.
 */
export const rendererFactory: IRenderMime.IRendererFactory = {
  safe: true,
  mimeTypes: [MIME_TYPE],
  createRenderer: options => new TableWalkerWidget(options)
};

/**
 * The plugin registration.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'datafilemanager:tablewalker-renderer',
  autoStart: true,
  requires: [IRenderMimeRegistry],
  activate: (app: JupyterFrontEnd, rendermime: IRenderMimeRegistry) => {
    console.log('DataFileManager: Activating TableWalker renderer...');
    rendermime.addFactory(rendererFactory);
    console.log('DataFileManager: TableWalker renderer activated for', MIME_TYPE);
  }
};

export default plugin;
