import { Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';

interface IAlgorithm {
  id: string;
  name: string;
  description: string;
  category: string;
  template?: string;
  args?: any[];
}

class AlgorithmInfoBody extends Widget implements Dialog.IBodyWidget<void> {
  constructor(algo: IAlgorithm) {
    super();
    this.addClass('jp-AlgorithmInfoBody');
    // Remove fixed styles on the node itself to allow Dialog to manage layout
    this.node.style.overflow = 'hidden'; // Prevent body itself from scrolling
    this.node.style.display = 'flex';
    this.node.style.flexDirection = 'column';

    // Create a container for the content
    const container = document.createElement('div');
    container.style.minWidth = '600px';
    container.style.maxWidth = '800px';
    // Use a fixed height large enough to avoid outer scrollbar but small enough to fit screen
    // 600px is usually safe for most laptop screens
    container.style.height = '70vh'; 
    container.style.overflowY = 'auto'; // Allow scrolling inside if content is very long
    container.style.padding = '0 12px 12px 4px';
    container.style.boxSizing = 'border-box';
    
    this.node.appendChild(container);
    
    // Disable resize on the main node to remove the handle
    this.node.style.resize = 'none';

    // Name & Category
    const header = document.createElement('div');
    header.style.marginBottom = '16px';
    header.style.borderBottom = '1px solid var(--jp-border-color2)';
    header.style.paddingBottom = '8px';
    header.style.position = 'sticky'; // Stick to top
    header.style.top = '0';
    header.style.backgroundColor = 'var(--jp-layout-color1)'; // Opaque background for sticky
    header.style.zIndex = '1';

    const title = document.createElement('h2');
    title.textContent = algo.name;
    title.style.margin = '0 0 4px 0';
    title.style.fontSize = '18px';
    title.style.color = 'var(--jp-ui-font-color0)';
    header.appendChild(title);

    const category = document.createElement('span');
    category.textContent = `Category: ${algo.category}`;
    category.style.fontSize = '12px';
    category.style.color = 'var(--jp-ui-font-color2)';
    category.style.backgroundColor = 'var(--jp-layout-color2)';
    category.style.padding = '2px 6px';
    category.style.borderRadius = '4px';
    header.appendChild(category);

    container.appendChild(header);

    // Description
    const descHeader = document.createElement('h3');
    descHeader.textContent = 'Description';
    descHeader.style.fontSize = '14px';
    descHeader.style.marginTop = '0';
    container.appendChild(descHeader);

    const desc = document.createElement('p');
    desc.textContent = algo.description || 'No description available.';
    desc.style.color = 'var(--jp-ui-font-color1)';
    desc.style.marginBottom = '20px';
    desc.style.lineHeight = '1.6';
    container.appendChild(desc);

    // Arguments
    if (algo.args && algo.args.length > 0) {
      const argsHeader = document.createElement('h3');
      argsHeader.textContent = 'Parameters';
      argsHeader.style.fontSize = '14px';
      container.appendChild(argsHeader);

      const argsTable = document.createElement('table');
      argsTable.style.width = '100%';
      argsTable.style.borderCollapse = 'collapse';
      argsTable.style.marginBottom = '20px';
      argsTable.style.fontSize = '13px';
      argsTable.style.border = '1px solid var(--jp-border-color2)';

      // Table Header
      const thead = document.createElement('thead');
      const trHead = document.createElement('tr');
      trHead.style.backgroundColor = 'var(--jp-layout-color2)';
      ['Name', 'Type', 'Description'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        th.style.textAlign = 'left';
        th.style.padding = '8px';
        th.style.borderBottom = '1px solid var(--jp-border-color2)';
        th.style.color = 'var(--jp-ui-font-color1)';
        th.style.fontWeight = '600';
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      argsTable.appendChild(thead);

      // Table Body
      const tbody = document.createElement('tbody');
      algo.args.forEach((arg: any) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--jp-border-color2)';
        
        const tdName = document.createElement('td');
        tdName.textContent = arg.name;
        tdName.style.padding = '8px';
        tdName.style.fontWeight = '500';
        tdName.style.color = 'var(--jp-ui-font-color0)';
        tr.appendChild(tdName);

        const tdType = document.createElement('td');
        tdType.textContent = arg.type || 'any';
        tdType.style.padding = '8px';
        tdType.style.fontFamily = 'var(--jp-code-font-family)';
        tdType.style.fontSize = '12px';
        tr.appendChild(tdType);

        const tdDesc = document.createElement('td');
        tdDesc.textContent = arg.description || arg.label || '-';
        tdDesc.style.padding = '8px';
        tdDesc.style.color = 'var(--jp-ui-font-color2)';
        tr.appendChild(tdDesc);

        tbody.appendChild(tr);
      });
      argsTable.appendChild(tbody);
      container.appendChild(argsTable);
    }

    // Template Preview (Optional)
    if (algo.template) {
        const tplHeader = document.createElement('h3');
        tplHeader.textContent = 'Code Template';
        tplHeader.style.fontSize = '14px';
        container.appendChild(tplHeader);

        const pre = document.createElement('pre');
        pre.textContent = algo.template;
        pre.style.backgroundColor = 'var(--jp-layout-color2)';
        pre.style.padding = '12px';
        pre.style.borderRadius = '4px';
        pre.style.overflowX = 'auto';
        pre.style.fontSize = '12px';
        pre.style.fontFamily = 'var(--jp-code-font-family)';
        pre.style.color = 'var(--jp-ui-font-color1)';
        pre.style.border = '1px solid var(--jp-border-color2)';
        pre.style.whiteSpace = 'pre-wrap'; // Wrap text to avoid horizontal scroll issues
        pre.style.wordBreak = 'break-all';
        pre.style.lineHeight = '1.5';
        pre.style.minHeight = '100px'; 
        pre.style.maxHeight = '300px'; 
        pre.style.overflowY = 'auto';
        pre.style.resize = 'none';
        pre.style.margin = '0'; // Reset margin
        container.appendChild(pre);
    }
  }

  getValue(): void {
    return;
  }
}

export class AlgorithmInfoDialogManager {
  async showAlgorithmInfo(algo: IAlgorithm): Promise<void> {
    const dialog = new Dialog({
      title: 'Algorithm Details',
      body: new AlgorithmInfoBody(algo),
      buttons: [Dialog.okButton({ label: 'Close' })]
    });
    const content = dialog.node.querySelector('.jp-Dialog-content') as HTMLElement | null;
    const bodyEl = dialog.node.querySelector('.jp-Dialog-body') as HTMLElement | null;
    dialog.node.style.resize = 'none';
    dialog.node.style.overflow = 'hidden';
    if (content) {
      content.style.resize = 'none';
      content.style.overflow = 'hidden';
      content.style.maxHeight = 'none';
    }
    if (bodyEl) {
      bodyEl.style.overflow = 'visible';
    }
    await dialog.launch();
  }
}
