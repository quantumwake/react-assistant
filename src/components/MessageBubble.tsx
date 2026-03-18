import React, { useState } from 'react';
import type { AssistantTheme, DisplayMessage } from '../types.js';
import { ToolCallCard } from './ToolCallCard.js';
import { ConfirmationCard } from './ConfirmationCard.js';

export interface MessageBubbleProps {
    msg: DisplayMessage;
    theme: AssistantTheme;
    onConfirm: (callId: string) => void;
    onReject: (callId: string) => void;
}

export function MessageBubble({ msg, theme, onConfirm, onReject }: MessageBubbleProps) {
    const [copied, setCopied] = useState(false);

    const copyContent = (content: string) => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // User message
    if (msg.role === 'user') {
        return (
            <div className="flex gap-2">
                <span className={`mt-0.5 shrink-0 ${theme.textMuted || 'text-gray-400'}`}>{'>'}</span>
                <div className={`text-xs ${theme.text || 'text-gray-100'}`}>
                    <pre className="whitespace-pre-wrap">{msg.content}</pre>
                </div>
            </div>
        );
    }

    // Assistant text message
    if (msg.role === 'assistant') {
        return (
            <div className="flex gap-2">
                <span className={`mt-0.5 shrink-0 ${theme.textAccent || 'text-blue-400'}`}>{'*'}</span>
                <div className="flex-1 min-w-0">
                    <div
                        className={`text-xs ${
                            msg.isError
                                ? 'text-red-400'
                                : msg.isWarning
                                  ? 'text-yellow-400'
                                  : theme.text || 'text-gray-100'
                        }`}
                    >
                        <pre className="whitespace-pre-wrap break-words">{msg.content}</pre>
                    </div>
                    {msg.content && (
                        <button
                            onClick={() => copyContent(msg.content)}
                            className={`mt-1 ${theme.hover || 'hover:bg-gray-800'} ${theme.textMuted || 'text-gray-400'} p-0.5 rounded text-xs`}
                            title="Copy"
                        >
                            {copied ? '\u2713' : '\u2398'}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Tool call card
    if (msg.role === 'tool_call') {
        return <ToolCallCard msg={msg} theme={theme} />;
    }

    // Confirmation card
    if (msg.role === 'confirmation') {
        return <ConfirmationCard msg={msg} theme={theme} onConfirm={onConfirm} onReject={onReject} />;
    }

    // Memory indicator
    if (msg.role === 'memory') {
        if (!msg.summary) return null;
        return (
            <div
                className={`flex items-center gap-1.5 ml-5 text-[10px] ${theme.textMuted || 'text-gray-400'}`}
            >
                <span>{'[M]'}</span>
                <span>{msg.summary}</span>
            </div>
        );
    }

    return null;
}
