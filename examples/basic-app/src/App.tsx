/**
 * Example app using @quantumwake/react-assistant with Zustand.
 *
 * Demonstrates:
 *  - Zustand store as toolContext (tools read/write app state)
 *  - Tool registration with store access
 *  - Drop-in AssistantChat component
 */
import React from 'react';
import {
    AssistantProvider,
    AssistantChat,
    ToolRegistry,
} from '@quantumwake/react-assistant';
import type { AssistantConfig, ModelInfo } from '@quantumwake/react-assistant';
import { useAppStore } from './store.js';
import type { Note } from './store.js';

// ─── API base URL ────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:8010';

// ─── Tool Registry ───────────────────────────────────────────────────────────

const registry = new ToolRegistry();

registry.register({
    name: 'get_current_time',
    description: 'Get the current date and time',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({
        success: true,
        time: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
});

registry.register({
    name: 'calculate',
    description: 'Evaluate a math expression',
    parameters: {
        type: 'object',
        properties: {
            expression: { type: 'string', description: 'Math expression, e.g. "2 + 2"' },
        },
        required: ['expression'],
    },
    execute: async (params) => {
        try {
            const expr = String(params.expression).replace(/[^0-9+\-*/().%\s]/g, '');
            const result = Function(`"use strict"; return (${expr})`)();
            return { success: true, expression: params.expression, result };
        } catch {
            return { success: false, error: `Cannot evaluate: ${params.expression}` };
        }
    },
});

// Tools that interact with the Zustand store via toolContext
registry.register({
    name: 'search_notes',
    description: 'Search through user notes by keyword',
    parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
    },
    execute: async (params, ctx) => {
        const store = ctx as ReturnType<typeof useAppStore.getState>;
        const results = store.searchNotes(String(params.query));
        return { success: true, query: params.query, count: results.length, results };
    },
});

registry.register({
    name: 'create_note',
    description: 'Create a new note',
    parameters: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Note title' },
            content: { type: 'string', description: 'Note content' },
        },
        required: ['title', 'content'],
    },
    execute: async (params, ctx) => {
        const store = ctx as ReturnType<typeof useAppStore.getState>;
        const note = store.addNote(String(params.title), String(params.content));
        return { success: true, note };
    },
});

registry.register({
    name: 'list_notes',
    description: 'List all notes',
    parameters: { type: 'object', properties: {} },
    execute: async (_params, ctx) => {
        const store = ctx as ReturnType<typeof useAppStore.getState>;
        return { success: true, notes: store.notes };
    },
});

registry.register({
    name: 'delete_note',
    description: 'Delete a note by title or ID (destructive)',
    confirm: true,
    parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: 'Title or ID of the note to delete' } },
        required: ['title'],
    },
    execute: async (params, ctx) => {
        const store = ctx as ReturnType<typeof useAppStore.getState>;
        const deleted = store.deleteNote(String(params.title));
        if (!deleted) return { success: false, error: `Note not found: ${params.title}` };
        return { success: true, deleted };
    },
});

// ─── Assistant Config ────────────────────────────────────────────────────────

const config: AssistantConfig = {
    defaultModel: 'gpt-4o-mini',

    fetchCompletion: async (request) => {
        const body = { ...request, tools: registry.getToolSchemas() };
        const resp = await fetch(`${API_BASE}/api/assistant/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error(`API returned ${resp.status}`);
        return resp.json();
    },

    fetchModels: async (): Promise<ModelInfo[]> => {
        const resp = await fetch(`${API_BASE}/api/assistant/models`);
        if (!resp.ok) return [];
        return resp.json();
    },

    onToolExecute: (name, _params, result) => {
        console.log(`[tool] ${name}:`, result);
    },
};

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
    // Pass the Zustand store's getState as toolContext so tools always read fresh state
    const storeState = useAppStore.getState;
    const notes = useAppStore((s) => s.notes);

    return (
        <div className="h-screen w-full flex">
            {/* Sidebar: live note list (updates when tools mutate store) */}
            <div className="w-64 border-r border-gray-700 bg-gray-900 p-3 overflow-auto">
                <h2 className="text-gray-300 text-sm font-medium mb-2">Notes ({notes.length})</h2>
                {notes.map((n: Note) => (
                    <div key={n.id} className="text-xs text-gray-400 border-b border-gray-800 py-2">
                        <div className="text-gray-200 font-medium">{n.title}</div>
                        <div className="truncate">{n.content}</div>
                    </div>
                ))}
            </div>

            {/* Chat panel */}
            <div className="flex-1">
                <AssistantProvider config={config} registry={registry} toolContext={storeState()}>
                    <AssistantChat
                        title="Notes Assistant"
                        placeholder="Try: 'List my notes', 'Search for meetings', 'Create a note about...'"
                        welcomeMessage={
                            <div className="text-gray-400 text-xs space-y-2 p-2">
                                <p className="font-medium">Notes Assistant</p>
                                <p>I can manage your notes. Try:</p>
                                <ul className="space-y-1 ml-2 text-blue-400">
                                    <li>"List all my notes"</li>
                                    <li>"Search for meetings"</li>
                                    <li>"Create a note about grocery shopping"</li>
                                    <li>"Delete the Shopping List note"</li>
                                    <li>"What time is it?"</li>
                                    <li>"Calculate 123 * 456"</li>
                                </ul>
                            </div>
                        }
                    />
                </AssistantProvider>
            </div>
        </div>
    );
}
