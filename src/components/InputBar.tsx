import React, { useState } from 'react';
import type { AssistantTheme } from '../types.js';

export interface InputBarProps {
    theme: AssistantTheme;
    isProcessing: boolean;
    placeholder?: string;
    onSend: (text: string) => void;
    onStop: () => void;
}

export function InputBar({ theme, isProcessing, placeholder, onSend, onStop }: InputBarProps) {
    const [message, setMessage] = useState('');

    const handleSubmit = () => {
        if (!message.trim() || isProcessing) return;
        onSend(message);
        setMessage('');
    };

    return (
        <div className={`p-2 border-t ${theme.border || 'border-gray-700'}`}>
            <div className="flex gap-2">
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    placeholder={placeholder || 'Ask the assistant...'}
                    className={`flex-1 ${theme.bg || 'bg-gray-900'} ${theme.text || 'text-gray-100'} border ${theme.border || 'border-gray-700'} px-2 py-1.5 text-xs resize-none rounded`}
                    rows={2}
                />
                {isProcessing ? (
                    <button
                        onClick={onStop}
                        className="border border-red-600/50 text-red-400 hover:bg-red-900/30 px-3 rounded text-xs"
                        title="Stop assistant"
                    >
                        {'\u25A0'}
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={!message.trim()}
                        className={`${theme.hover || 'hover:bg-gray-800'} border ${theme.border || 'border-gray-700'} disabled:opacity-50 ${theme.text || 'text-gray-100'} px-3 rounded text-xs`}
                    >
                        {'\u25B6'}
                    </button>
                )}
            </div>
        </div>
    );
}
