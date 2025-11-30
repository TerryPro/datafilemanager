import { ServiceManager } from '@jupyterlab/services';
import { IColumn } from '../types';

export class MetadataService {
  private serviceManager: ServiceManager | undefined;

  constructor(serviceManager?: ServiceManager) {
    this.serviceManager = serviceManager;
  }

  public setServiceManager(manager: ServiceManager) {
    this.serviceManager = manager;
  }

  /**
   * Fetch columns from a CSV file using the backend API.
   */
  async fetchCSVColumns(filepath: string): Promise<IColumn[]> {
    if (!filepath) return [];

    try {
      const response = await fetch('/aiserver/get-csv-columns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filepath }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSV columns: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Assume backend returns list of strings for now
      return (data.columns || []).map((name: string) => ({ name, type: 'unknown' }));
    } catch (err) {
      console.error('MetadataService: Error fetching CSV columns', err);
      return [];
    }
  }

  /**
   * Fetch columns from a DataFrame variable in the active kernel.
   */
  async fetchVariableColumns(variableName: string): Promise<IColumn[]> {
    if (!this.serviceManager || !variableName) return [];

    try {
      // Find an active session
      const sessions = Array.from(this.serviceManager.sessions.running());
      const sessionModel = sessions[0]; // Use first available session

      if (!sessionModel) {
        console.warn('MetadataService: No active kernel session found.');
        return [];
      }

      const sessionConnection = this.serviceManager.sessions.connectTo({ model: sessionModel });
      
      if (!sessionConnection.kernel) {
        console.warn('MetadataService: Session has no kernel.');
        return [];
      }

      // Code to inspect DataFrame columns and types
      const code = `
import json
import pandas as pd
try:
    if '${variableName}' in globals() and isinstance(${variableName}, pd.DataFrame):
        _cols = [{'name': str(c), 'type': str(t)} for c, t in zip(${variableName}.columns, ${variableName}.dtypes)]
        print(json.dumps(_cols))
    else:
        print("[]")
except Exception as e:
    print("[]")
`;
      
      const future = sessionConnection.kernel.requestExecute({ code });
      
      return new Promise<IColumn[]>((resolve) => {
        let result: IColumn[] = [];
        
        future.onIOPub = (msg: any) => {
          if (msg.header.msg_type === 'stream' && msg.content.name === 'stdout') {
            try {
              const text = msg.content.text;
              // Handle cases where output might be split or contain other logs?
              // For now assume clean JSON output
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed)) {
                result = parsed;
              }
            } catch (e) {
              console.error("MetadataService: Failed to parse variable columns", e);
            }
          }
        };

        future.done.then(() => {
          resolve(result);
        });
      });

    } catch (err) {
      console.error('MetadataService: Error fetching variable columns', err);
      return [];
    }
  }
}

// Singleton instance
export const metadataService = new MetadataService();
