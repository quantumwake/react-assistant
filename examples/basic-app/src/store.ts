/**
 * Example Zustand store — app-level state that tools can read/write.
 *
 * This demonstrates how to pass a Zustand store as `toolContext` to the
 * assistant, so tools can interact with your app's state.
 */
import { create } from 'zustand';

export interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: string;
}

interface AppState {
    notes: Note[];
    addNote: (title: string, content: string) => Note;
    deleteNote: (id: string) => Note | null;
    searchNotes: (query: string) => Note[];
}

export const useAppStore = create<AppState>((set, get) => ({
    notes: [
        { id: '1', title: 'Meeting Notes', content: 'Discussed Q2 roadmap priorities and team allocation.', createdAt: '2026-03-15' },
        { id: '2', title: 'Project Ideas', content: 'Explore react-assistant integration for the dashboard.', createdAt: '2026-03-16' },
        { id: '3', title: 'Shopping List', content: 'Milk, eggs, bread, coffee beans.', createdAt: '2026-03-17' },
    ],

    addNote: (title, content) => {
        const note: Note = {
            id: crypto.randomUUID(),
            title,
            content,
            createdAt: new Date().toISOString().slice(0, 10),
        };
        set((s) => ({ notes: [...s.notes, note] }));
        return note;
    },

    deleteNote: (id) => {
        const note = get().notes.find((n) => n.id === id || n.title === id);
        if (!note) return null;
        set((s) => ({ notes: s.notes.filter((n) => n.id !== note.id) }));
        return note;
    },

    searchNotes: (query) => {
        const q = query.toLowerCase();
        return get().notes.filter(
            (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
        );
    },
}));
