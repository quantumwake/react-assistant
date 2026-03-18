import React from 'react';
import type { AssistantTheme, ConfirmationMessage } from '../types.js';

export interface ConfirmationCardProps {
    msg: ConfirmationMessage;
    theme: AssistantTheme;
    onConfirm: (callId: string) => void;
    onReject: (callId: string) => void;
}

export function ConfirmationCard({ msg, theme, onConfirm, onReject }: ConfirmationCardProps) {
    const toolLabel = msg.toolName?.replace(/_/g, ' ') || 'action';
    const argsStr = msg.arguments
        ? Object.entries(msg.arguments as Record<string, unknown>)
              .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
              .join(', ')
        : '';

    return (
        <div className="border border-yellow-600/50 rounded text-xs ml-5 bg-yellow-900/10">
            <div className="px-2 py-1.5 flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5 shrink-0">{'\u26A0'}</span>
                <div className="flex-1 min-w-0">
                    <div className="text-yellow-400 font-medium mb-1">Confirm: {toolLabel}</div>
                    {argsStr && (
                        <div className={`${theme.textMuted || 'text-gray-400'} mb-2 break-all`}>
                            {argsStr}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={() => onConfirm(msg.callId)}
                            className="flex items-center gap-1 px-2 py-0.5 bg-green-800/50 hover:bg-green-700/50 text-green-400 rounded border border-green-600/50"
                        >
                            {'\u2713'} Approve
                        </button>
                        <button
                            onClick={() => onReject(msg.callId)}
                            className="flex items-center gap-1 px-2 py-0.5 bg-red-800/50 hover:bg-red-700/50 text-red-400 rounded border border-red-600/50"
                        >
                            {'\u2717'} Reject
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}