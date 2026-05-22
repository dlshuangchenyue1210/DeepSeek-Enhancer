export type MessageRole = 'user' | 'assistant';

export type ConversationRef = {
  id: string;
  title: string;
  url: string;
  updatedAt?: number;
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  markdown?: string;
  element: HTMLElement;
  index: number;
};

export type ChatTurn = {
  id: string;
  user?: ChatMessage;
  assistant?: ChatMessage;
};

export type DeepSeekAdapter = {
  isConversationPage(): boolean;
  getCurrentConversation(): ConversationRef | null;
  getRecentConversations(): ConversationRef[];
  getMessages(): ChatMessage[];
  getTurns(): ChatTurn[];
  getInput(): HTMLElement | null;
  getSidebarMountPoint(): HTMLElement | null;
  scrollToMessage(id: string): void;
};
