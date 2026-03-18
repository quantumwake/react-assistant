/**
 * AssistantChat — drop-in chat UI component.
 *
 * Must be rendered inside an <AssistantProvider>. Uses useAssistantContext()
 * to access state and actions. Fully customizable via props and theme.
 *
 * If you need a completely custom UI, skip this component and use
 * useAssistantContext() directly.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useAssistantContext } from '../AssistantProvider.js';
import { MessageBubble } from './MessageBubble.js';
import { InputBar } from './InputBar.js';
import type { AssistantTheme, CompletionRequest, ModelInfo } from '../types.js';

export interface AssistantChatProps {
    /** Title shown in the header. */
    title?: string;
    /** Placeholder text for the input textarea. */
    placeholder?: string;
    /** Custom welcome content shown when there are no messages. */
    welcomeMessage?: React.ReactNode;
    /** Additional CSS classes for the root container. */
    className?: string;
}

export function AssistantChat({
    title = 'Assistant',
    placeholder,
    welcomeMessage,
    className,
}: AssistantChatProps) {
    const {
        messages,
        isProcessing,
        model,
        autoConfirm,
        debugMode,
        pendingDebugPayload,
        sendMessage,
        stop,
        clearHistory,
        setModel,
        setAutoConfirm,
        setDebugMode,
        confirmToolCall,
        rejectToolCall,
        approveDebugPayload,
        rejectDebugPayload,
        config,
        theme,
    } = useAssistantContext();

    const [showSettings, setShowSettings] = useState(false);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Fetch available models on mount
    useEffect(() => {
        if (!config.fetchModels) return;
        config
            .fetchModels()
            .then((data) => {
                if (Array.isArray(data)) {
                    setModels(data);
                    if (data.length > 0 && !data.find((m) => m.id === model)) {
                        setModel(data[0].id);
                    }
                }
            })
            .catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-scroll to latest message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className={`flex flex-col h-full ${theme.bg || 'bg-gray-900'} ${className || ''}`}>
            {/* Header */}
            <div
                className={`flex items-center justify-between p-2 border-b ${theme.border || 'border-gray-700'}`}
            >
                <div className="flex items-center gap-2">
                    <span className={theme.textAccent || 'text-blue-400'}>{'*'}</span>
                    <span className={`${theme.text || 'text-gray-100'} font-medium text-sm`}>
                        {title}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`${theme.hover || 'hover:bg-gray-800'} ${theme.text || 'text-gray-100'} p-1 rounded text-xs`}
                        title="Settings"
                    >
                        {'\u2699'}
                    </button>
                    {messages.length > 0 && (
                        <button
                            onClick={clearHistory}
                            className={`${theme.hover || 'hover:bg-gray-800'} ${theme.text || 'text-gray-100'} p-1 rounded text-xs`}
                            title="Clear history"
                        >
                            {'\u2715'}
                        </button>
                    )}
                </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
                <div className={`p-2 border-b ${theme.border || 'border-gray-700'} space-y-2`}>
                    {models.length > 0 && (
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className={`w-full ${theme.bg || 'bg-gray-900'} ${theme.text || 'text-gray-100'} border ${theme.border || 'border-gray-700'} px-2 py-1 text-xs rounded`}
                        >
                            {models.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name || m.id} {m.provider ? `(${m.provider})` : ''}
                                </option>
                            ))}
                        </select>
                    )}
                    <label className={`flex items-center gap-2 text-xs ${theme.text || 'text-gray-100'}`}>
                        <input
                            type="checkbox"
                            checked={autoConfirm}
                            onChange={(e) => setAutoConfirm(e.target.checked)}
                        />
                        Auto-confirm destructive actions
                    </label>
                    <label className={`flex items-center gap-2 text-xs ${theme.text || 'text-gray-100'}`}>
                        <input
                            type="checkbox"
                            checked={debugMode}
                            onChange={(e) => setDebugMode(e.target.checked)}
                        />
                        Debug mode
                    </label>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-auto p-2 space-y-2">
                {messages.length === 0 && !isProcessing && (
                    welcomeMessage || (
                        <div className={`${theme.textMuted || 'text-gray-400'} text-xs p-2`}>
                            <p className="font-medium">{title}</p>
                            <p className="mt-1">Send a message to get started.</p>
                        </div>
                    )
                )}

                {messages.map((msg, i) => (
                    <MessageBubble
                        key={i}
                        msg={msg}
                        theme={theme}
                        onConfirm={confirmToolCall}
                        onReject={rejectToolCall}
                    />
                ))}

                {isProcessing && (
                    <div className="flex items-center gap-2 py-1">
                        <span className={`text-xs animate-pulse ${theme.textAccent || 'text-blue-400'}`}>
                            ...
                        </span>
                        <span className={`text-xs ${theme.textMuted || 'text-gray-400'}`}>Thinking...</span>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <InputBar
                theme={theme}
                isProcessing={isProcessing}
                placeholder={placeholder}
                onSend={sendMessage}
                onStop={stop}
            />

            {/* Debug payload dialog */}
            {pendingDebugPayload && (
                <DebugDialog
                    requestBody={pendingDebugPayload.requestBody}
                    theme={theme}
                    onAccept={approveDebugPayload}
                    onReject={rejectDebugPayload}
                />
            )}
        </div>
    );
}

// ─── Debug Dialog ────────────────────────────────────────────────────────────

function DebugDialog({
    requestBody,
    theme,
    onAccept,
    onReject,
}: {
    requestBody: CompletionRequest;
    theme: AssistantTheme;
    onAccept: () => void;
    onReject: () => void;
}) {
    const [activeTab, setActiveTab] = useState<'messages' | 'raw'>('messages');
    const messages = (requestBody?.messages || []) as Array<Record<string, unknown>>;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div
                className={`${theme.bg || 'bg-gray-900'} border ${theme.border || 'border-gray-700'} rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col`}
            >
                <div className={`p-3 border-b ${theme.border || 'border-gray-700'} flex items-center justify-between`}>
                    <span className={`${theme.text || 'text-gray-100'} text-sm font-medium`}>
                        DEBUG: OUTGOING REQUEST
                    </span>
                    <span className={`text-xs ${theme.textMuted || 'text-gray-400'}`}>
                        Model: {requestBody?.model} | ~{Math.round(JSON.stringify(requestBody).length / 4)} chars
                    </span>
                </div>

                <div className={`flex gap-1 px-3 pt-2 border-b ${theme.border || 'border-gray-700'}`}>
                    {(['messages', 'raw'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1.5 text-xs rounded-t ${
                                activeTab === tab
                                    ? `${theme.textAccent || 'text-blue-400'} border-b-2 border-current`
                                    : theme.textMuted || 'text-gray-400'
                            }`}
                        >
                            {tab === 'messages' ? `Messages (${messages.length})` : 'Raw'}
                        </button>
                    ))}
                </div>

                <div className={`flex-1 overflow-auto p-3 ${theme.text || 'text-gray-100'} text-xs`}>
                    {activeTab === 'messages' && (
                        <div className="space-y-2">
                            {messages.map((msg, i) => (
                                <div key={i} className={`border-b ${theme.border || 'border-gray-700'} pb-2`}>
                                    <span
                                        className={`font-medium ${
                                            msg.role === 'user'
                                                ? 'text-blue-400'
                                                : msg.role === 'assistant'
                                                  ? 'text-green-400'
                                                  : 'text-yellow-400'
                                        }`}
                                    >
                                        [{String(msg.role)}]
                                    </span>
                                    <pre className="whitespace-pre-wrap break-words mt-1">
                                        {typeof msg.content === 'string'
                                            ? msg.content
                                            : JSON.stringify(msg.content, null, 2)}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    )}
                    {activeTab === 'raw' && (
                        <pre className="whitespace-pre-wrap break-words">
                            {JSON.stringify(requestBody, null, 2)}
                        </pre>
                    )}
                </div>

                <div className={`p-3 border-t ${theme.border || 'border-gray-700'} flex justify-end gap-2`}>
                    <button
                        onClick={onReject}
                        className={`px-3 py-1 text-xs ${theme.text || 'text-gray-100'} border ${theme.border || 'border-gray-700'} rounded ${theme.hover || 'hover:bg-gray-800'}`}
                    >
                        Discard
                    </button>
                    <button
                        onClick={onAccept}
                        className="px-3 py-1 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
