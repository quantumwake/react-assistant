import React, { useState } from 'react';
import type { AssistantTheme, ToolCallMessage } from '../types.js';

export interface ToolCallCardProps {
    msg: ToolCallMessage;
    theme: AssistantTheme;
}

export function ToolCallCard({ msg, theme }: ToolCallCardProps) {
    const [expanded, setExpanded] = useState(false);

    const statusColors: Record<string, string> = {
        running: theme.textAccent || 'text-blue-400',
        success: 'text-green-400',
        error: 'text-red-400',
        rejected: 'text-yellow-400',
    };

    const statusSymbols: Record<string, string> = {
        running: '\u25CB',  // ○
        success: '\u2713',  // ✓
        error: '\u2717',    // ✗
        rejected: '\u26A0', // ⚠
    };

    const toolLabel = msg.toolName?.replace(/_/g, ' ') || 'tool';

    return (
        <div className={`border ${theme.border || 'border-gray-700'} rounded text-xs ml-5`}>
            <button
                onClick={() => setExpanded(!expanded)}
                className={`w-full flex items-center gap-2 px-2 py-1 ${theme.hover || 'hover:bg-gray-800'} rounded text-left`}
            >
                <span className={theme.textMuted || 'text-gray-400'}>{'🔧'}</span>
                <span className={`${statusColors[msg.status] || theme.textMuted || 'text-gray-400'} flex items-center gap-1`}>
                    <span>{statusSymbols[msg.status] || ''}</span>
                    {msg.status === 'running' && <span className="animate-pulse">...</span>}
                    {toolLabel}
                </span>
                <span className="flex-1" />
                <span className={theme.textMuted || 'text-gray-400'}>
                    {expanded ? '\u25BC' : '\u25B6'}
                </span>
            </button>
            {expanded && (
                <div className={`px-2 py-1 border-t ${theme.border || 'border-gray-700'} space-y-1`}>
                    {msg.arguments != null && (
                        <div>
                            <span className={theme.textMuted || 'text-gray-400'}>Args: </span>
                            <pre className={`${theme.text || 'text-gray-100'} whitespace-pre-wrap break-all`}>
                                {JSON.stringify(msg.arguments as Record<string, unknown>, null, 2)}
                            </pre>
                        </div>
                    )}
                    {msg.result !== undefined && (
                        <div>
                            <span className={theme.textMuted || 'text-gray-400'}>Result: </span>
                            <pre
                                className={`${
                                    (msg.result as Record<string, unknown>)?.success === false
                                        ? 'text-red-400'
                                        : 'text-green-400'
                                } whitespace-pre-wrap break-all`}
                            >
                                {JSON.stringify(msg.result, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}