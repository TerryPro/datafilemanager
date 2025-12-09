/**
 * ModelSelector Component
 *
 * A dropdown component for selecting the AI model.
 */

import { Widget } from '@lumino/widgets';
import { AiService } from '../../../services/ai-service';

export interface IModelSelectorProps {
  aiService: AiService;
  onModelChange?: (modelId: string) => void;
}

export class ModelSelector extends Widget {
  private props: IModelSelectorProps;
  private selectElement: HTMLSelectElement;

  constructor(props: IModelSelectorProps) {
    super();
    this.props = props;
    // Use the same wrapper class as the intent selector to match styling
    this.addClass('ai-sidebar-select-wrapper');
    // Add a specific class for potential future customization
    this.addClass('ai-model-selector');

    // Create select element with the same class as the intent selector
    this.selectElement = document.createElement('select');
    this.selectElement.className = 'ai-sidebar-mode-select';
    this.selectElement.title = '切换 AI 模型';
    
    // Listen for changes
    this.selectElement.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      const modelId = target.value;
      if (modelId) {
        // Optimistically update UI or waiting for confirm? 
        // For now, trigger API and callback
        const success = await this.props.aiService.setModel(modelId);
        if (success) {
          if (this.props.onModelChange) {
            this.props.onModelChange(modelId);
          }
        } else {
          // Revert if failed (simple reload)
          this.loadModels();
        }
      }
    });

    this.node.appendChild(this.selectElement);

    // Initial load
    this.loadModels();
  }

  private async loadModels() {
    const data = await this.props.aiService.getModels();
    
    // Clear existing options
    this.selectElement.innerHTML = '';
    
    if (data.models && data.models.length > 0) {
      data.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id; // or model.name if available/better
        option.selected = model.id === data.current;
        this.selectElement.appendChild(option);
      });
    } else {
      const option = document.createElement('option');
      option.text = '无可用模型';
      this.selectElement.appendChild(option);
      this.selectElement.disabled = true;
    }
  }
}
