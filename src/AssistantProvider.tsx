/**
 * AssistantProvider — React context provider for the assistant.
 *
 * Wraps the useAssistant hook in a context so that AssistantChat and custom
 * components can access assistant state and actions via useAssistantContext().
 */
import React, { createContext, useContext } from 'react';
import { useAssistant } from './useAssistant.js';
import type { UseAssistantReturn } from './useAssistant.js';
import type { AssistantConfig, AssistantTheme } from './types.js';
import type { ToolRegistry } from './ToolRegistry.js';

interface AssistantContextValue extends UseAssistantReturn {
    config: AssistantConfig;
    registry: ToolRegistry;
    theme: AssistantTheme;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export interface AssistantProviderProps {
    config: AssistantConfig;
    registry: ToolRegistry;
    /** Opaque context passed to tool execute() as the second argument. */
    toolContext?: unknown;
    /** CSS class names for theming built-in components. */
    theme?: AssistantTheme;
    children: React.ReactNode;
}

export function AssistantProvider({
    config,
    registry,
    toolContext,
    theme,
    children,
}: AssistantProviderProps) {
    const assistant = useAssistant(config, registry, toolContext);

    const resolvedTheme: AssistantTheme = theme || {
        bg: 'bg-gray-900',
        text: 'text-gray-100',
        textMuted: 'text-gray-400',
        textAccent: 'text-blue-400',
        border: 'border-gray-700',
        hover: 'hover:bg-gray-800',
    };

    return (
        <AssistantContext.Provider value={{ ...assistant, config, registry, theme: resolvedTheme }}>
            {children}
        </AssistantContext.Provider>
    );
}

/**
 * Access assistant state and actions from within an AssistantProvider.
 * @throws if called outside of AssistantProvider.
 */
export function useAssistantContext(): AssistantContextValue {
    const ctx = useContext(AssistantContext);
    if (!ctx) {
        throw new Error('useAssistantContext must be used within an <AssistantProvider>');
    }
    return ctx;
}