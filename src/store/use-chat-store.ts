import { create } from "zustand";
import { ChatMessage, ChatSession } from "@/types";

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isGenerating: boolean;
  
  createSession: (title?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSessionId: (id: string | null) => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  clearActiveSession: () => void;
  setIsGenerating: (isGenerating: boolean) => void;
  appendLastMessageContent: (content: string) => void;
  cleanEmptyMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  activeSessionId: null,
  isGenerating: false,

  createSession: (title) => {
    const id = Math.random().toString(36).substring(7);
    const newSession: ChatSession = {
      id,
      title: title || "New Research Session",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({
      sessions: [newSession, ...state.sessions],
      activeSessionId: id,
    }));
    return id;
  },

  deleteSession: (id) =>
    set((state) => {
      const nextSessions = state.sessions.filter((s) => s.id !== id);
      let nextActiveId = state.activeSessionId;
      if (state.activeSessionId === id) {
        nextActiveId = nextSessions.length > 0 ? nextSessions[0].id : null;
      }
      return {
        sessions: nextSessions,
        activeSessionId: nextActiveId,
      };
    }),

  setActiveSessionId: (id) => set({ activeSessionId: id }),

  addMessage: (message) =>
    set((state) => {
      const activeId = state.activeSessionId;
      if (!activeId) return {};

      const newMessage: ChatMessage = {
        ...message,
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
      };

      return {
        sessions: state.sessions.map((session) => {
          if (session.id === activeId) {
            return {
              ...session,
              messages: [...session.messages, newMessage],
              updatedAt: Date.now(),
            };
          }
          return session;
        }),
      };
    }),

  clearActiveSession: () =>
    set((state) => {
      const activeId = state.activeSessionId;
      if (!activeId) return {};
      return {
        sessions: state.sessions.map((session) => {
          if (session.id === activeId) {
            return {
              ...session,
              messages: [],
              updatedAt: Date.now(),
            };
          }
          return session;
        }),
      };
    }),

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  appendLastMessageContent: (content) =>
    set((state) => {
      const activeId = state.activeSessionId;
      if (!activeId) return {};

      return {
        sessions: state.sessions.map((session) => {
          if (session.id === activeId) {
            const messages = [...session.messages];
            if (messages.length === 0) {
              messages.push({
                id: Math.random().toString(36).substring(7),
                role: "assistant",
                content,
                timestamp: Date.now(),
              });
            } else {
              const last = messages[messages.length - 1];
              if (last.role === "assistant") {
                messages[messages.length - 1] = {
                  ...last,
                  content: last.content + content,
                  timestamp: Date.now(),
                };
              } else {
                messages.push({
                  id: Math.random().toString(36).substring(7),
                  role: "assistant",
                  content,
                  timestamp: Date.now(),
                });
              }
            }
            return {
              ...session,
              messages,
              updatedAt: Date.now(),
            };
          }
          return session;
        }),
      };
    }),

  cleanEmptyMessages: () =>
    set((state) => {
      const activeId = state.activeSessionId;
      if (!activeId) return {};

      return {
        sessions: state.sessions.map((session) => {
          if (session.id === activeId) {
            const messages = session.messages.filter(
              (m) => !(m.role === "assistant" && m.content.trim() === "")
            );
            return {
              ...session,
              messages,
              updatedAt: Date.now(),
            };
          }
          return session;
        }),
      };
    }),
}));
