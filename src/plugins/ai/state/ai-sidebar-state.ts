/**
 * State Management
 * 
 * Defines application state structure,
 * provides state update methods,
 * and manages state subscriptions.
 */

import { VariableInfo, AlgorithmInfo, ChatMessage, GenerateMode } from './types';

/**
 * AI Sidebar state interface
 */
export interface AiSidebarState {
  selectedVariable?: VariableInfo;
  selectedAlgorithm?: AlgorithmInfo;
  chatHistory: ChatMessage[];
  isGenerating: boolean;
  intentText: string;
  mode: GenerateMode;
}

/**
 * State listener callback type
 */
export type StateListener = (state: AiSidebarState) => void;

/**
 * StateManager class for managing AI sidebar state
 * 
 * This class provides centralized state management for the AI sidebar,
 * implementing a simple observer pattern for state updates. It ensures
 * that all state changes are tracked and listeners are notified consistently.
 * 
 * @example
 * ```typescript
 * const stateManager = new StateManager();
 * 
 * // Subscribe to state changes
 * const unsubscribe = stateManager.subscribe((state) => {
 *   console.log('State updated:', state);
 * });
 * 
 * // Update state
 * stateManager.setSelectedVariable({ name: 'df', type: 'DataFrame', shape: [100, 5] });
 * 
 * // Unsubscribe when done
 * unsubscribe();
 * ```
 */
export class StateManager {
  /** Current state of the AI sidebar */
  private state: AiSidebarState;
  
  /** Set of listener functions to be notified on state changes */
  private listeners: Set<StateListener>;

  /**
   * Creates a new StateManager with default initial state
   */
  constructor() {
    this.state = {
      chatHistory: [],
      isGenerating: false,
      intentText: '',
      mode: 'create'
    };
    this.listeners = new Set();
  }

  /**
   * Get the current state
   * 
   * Returns a shallow copy of the current state to prevent direct mutations.
   * 
   * @returns A copy of the current AI sidebar state
   * 
   * @example
   * ```typescript
   * const currentState = stateManager.getState();
   * console.log(currentState.isGenerating); // false
   * ```
   */
  getState(): AiSidebarState {
    return { ...this.state };
  }

  /**
   * Update state with partial changes
   * 
   * Merges the provided partial state with the current state and notifies
   * all subscribed listeners of the change. This method ensures immutability
   * by creating a new state object.
   * 
   * @param partial - Partial state object containing properties to update
   * 
   * @example
   * ```typescript
   * stateManager.setState({ isGenerating: true });
   * stateManager.setState({ 
   *   selectedVariable: { name: 'df', type: 'DataFrame', shape: [100, 5] },
   *   intentText: 'Analyze this data'
   * });
   * ```
   */
  setState(partial: Partial<AiSidebarState>): void {
    // Create new state object by merging current state with partial update
    this.state = {
      ...this.state,
      ...partial
    };
    
    // Notify all listeners of the state change
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   * 
   * Registers a listener function that will be called whenever the state changes.
   * Returns an unsubscribe function that can be called to remove the listener.
   * 
   * @param listener - Callback function to be invoked on state changes
   * @returns Unsubscribe function to remove the listener
   * 
   * @example
   * ```typescript
   * const unsubscribe = stateManager.subscribe((state) => {
   *   console.log('New state:', state);
   * });
   * 
   * // Later, when you want to stop listening
   * unsubscribe();
   * ```
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all subscribed listeners of state changes
   * 
   * This is a private method called internally whenever the state is updated.
   * It passes a copy of the current state to each listener to prevent mutations.
   */
  private notifyListeners(): void {
    const stateCopy = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(stateCopy);
      } catch (error) {
        console.error('[StateManager] Error in listener:', error);
      }
    });
  }

  /**
   * Set selected variable
   * 
   * Convenience method to update the selected variable in the state.
   * Pass undefined to clear the selection.
   * 
   * @param variable - Variable information or undefined to clear
   * 
   * @example
   * ```typescript
   * // Select a variable
   * stateManager.setSelectedVariable({ 
   *   name: 'df', 
   *   type: 'DataFrame', 
   *   shape: [100, 5] 
   * });
   * 
   * // Clear selection
   * stateManager.setSelectedVariable(undefined);
   * ```
   */
  setSelectedVariable(variable?: VariableInfo): void {
    this.setState({ selectedVariable: variable });
  }

  /**
   * Set selected algorithm
   * 
   * Convenience method to update the selected algorithm in the state.
   * Pass undefined to clear the selection.
   * 
   * @param algorithm - Algorithm information or undefined to clear
   * 
   * @example
   * ```typescript
   * // Select an algorithm
   * stateManager.setSelectedAlgorithm({ 
   *   id: 'linear-regression',
   *   name: 'Linear Regression',
   *   category: 'Regression'
   * });
   * 
   * // Clear selection
   * stateManager.setSelectedAlgorithm(undefined);
   * ```
   */
  setSelectedAlgorithm(algorithm?: AlgorithmInfo): void {
    this.setState({ selectedAlgorithm: algorithm });
  }

  /**
   * Add a chat message
   * 
   * Convenience method to append a new message to the chat history.
   * Creates a new array to ensure immutability.
   * 
   * @param message - Chat message to add to the history
   * 
   * @example
   * ```typescript
   * stateManager.addChatMessage({
   *   id: '1',
   *   sender: 'user',
   *   content: 'Generate a plot',
   *   timestamp: new Date()
   * });
   * ```
   */
  addChatMessage(message: ChatMessage): void {
    this.setState({
      chatHistory: [...this.state.chatHistory, message]
    });
  }

  /**
   * Clear chat history
   * 
   * Convenience method to remove all messages from the chat history.
   * 
   * @example
   * ```typescript
   * stateManager.clearChatHistory();
   * ```
   */
  clearChatHistory(): void {
    this.setState({ chatHistory: [] });
  }

  /**
   * Set generating state
   * 
   * Convenience method to update the isGenerating flag, which indicates
   * whether the AI is currently processing a request.
   * 
   * @param isGenerating - Whether code generation is in progress
   * 
   * @example
   * ```typescript
   * // Start generating
   * stateManager.setGenerating(true);
   * 
   * // Finish generating
   * stateManager.setGenerating(false);
   * ```
   */
  setGenerating(isGenerating: boolean): void {
    this.setState({ isGenerating });
  }

  /**
   * Set intent text
   * 
   * Convenience method to update the user's intent text (the prompt input).
   * 
   * @param intentText - The user's input text
   * 
   * @example
   * ```typescript
   * stateManager.setIntentText('Create a scatter plot');
   * ```
   */
  setIntentText(intentText: string): void {
    this.setState({ intentText });
  }

  /**
   * Set generation mode
   * 
   * Convenience method to update the code generation mode.
   * 
   * @param mode - The generation mode to use
   * 
   * @example
   * ```typescript
   * stateManager.setMode('refactor');
   * ```
   */
  setMode(mode: GenerateMode): void {
    this.setState({ mode });
  }
}
