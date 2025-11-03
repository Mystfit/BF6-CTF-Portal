//==============================================================================================
// EVENT DISPATCHER SYSTEM
//==============================================================================================
// A generic, type-safe event dispatcher for handling game events

/**
 * Event handler signature
 */
type EventHandler<T = any> = (data: T) => void;

/**
 * Generic EventDispatcher class that provides type-safe event handling
 * 
 * Usage example:
 * ```typescript
 * interface MyEventMap {
 *     'playerJoined': { player: Player };
 *     'scoreChanged': { score: number };
 * }
 * 
 * const events = new EventDispatcher<MyEventMap>();
 * events.on('playerJoined', (data) => console.log(data.player));
 * events.emit('playerJoined', { player: somePlayer });
 * ```
 */
class EventDispatcher<TEventMap = Record<string, any>> {
    private listeners: Map<string, Set<EventHandler>> = new Map();
    
    /**
     * Subscribe to an event
     * @param event - The event name to listen for
     * @param callback - The callback function to invoke when the event is emitted
     * @returns A function to unsubscribe from the event
     */
    on<K extends keyof TEventMap>(event: K, callback: EventHandler<TEventMap[K]>): () => void {
        const eventName = event as string;
        
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        
        this.listeners.get(eventName)!.add(callback);
        
        // Return unsubscribe function
        return () => this.off(event, callback);
    }
    
    /**
     * Unsubscribe from an event
     * @param event The event name to stop listening for
     * @param handler The callback function to remove
     */
    off<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
        const eventName = event as string;
        const handlers = this.listeners.get(eventName);
        
        if (handlers) {
            handlers.delete(handler);
            
            // Clean up empty sets
            if (handlers.size === 0) {
                this.listeners.delete(eventName);
            }
        }
    }
    
    /**
     * Subscribe to an event for a single execution (auto-unsubscribes after first emission)
     * @param event The event name to listen for
     * @param handler The callback function to execute once
     */
    once<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
        const onceWrapper: EventHandler<TEventMap[K]> = (data) => {
            handler(data);
            this.off(event, onceWrapper);
        };
        
        this.on(event, onceWrapper);
    }
    
    /**
     * Dispatch an event to all registered listeners
     * @param event The event name to emit
     * @param data The data to pass to event handlers
     */
    emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]): void {
        const eventName = event as string;
        const handlers = this.listeners.get(eventName);
        
        if (handlers) {
            // Create a copy of the handlers set to avoid issues if handlers modify the set
            const handlersCopy = Array.from(handlers);
            
            for (const handler of handlersCopy) {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for '${eventName}':`, error);
                }
            }
        }
    }
    
    /**
     * Check if an event has any listeners
     * @param event The event name to check
     * @returns True if the event has listeners
     */
    hasListeners<K extends keyof TEventMap>(event: K): boolean {
        const eventName = event as string;
        const handlers = this.listeners.get(eventName);
        return handlers ? handlers.size > 0 : false;
    }
    
    /**
     * Get the number of listeners for an event
     * @param event The event name to check
     * @returns The number of registered listeners
     */
    listenerCount<K extends keyof TEventMap>(event: K): number {
        const eventName = event as string;
        const handlers = this.listeners.get(eventName);
        return handlers ? handlers.size : 0;
    }
    
    /**
     * Remove all listeners for a specific event, or all events if no event is specified
     * @param event Optional event name to clear listeners for. If not provided, clears all listeners.
     */
    clear<K extends keyof TEventMap>(event?: K): void {
        if (event !== undefined) {
            const eventName = event as string;
            this.listeners.delete(eventName);
        } else {
            this.listeners.clear();
        }
    }
    
    /**
     * Get all event names that have listeners
     * @returns Array of event names
     */
    eventNames(): string[] {
        return Array.from(this.listeners.keys());
    }
}
