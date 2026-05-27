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
  findFormulaFromTarget(target: EventTarget | null): DeepSeekFormula | null;
  markFormulaElements(): number;
  getInput(): HTMLElement | null;
  getSidebarMountPoint(): HTMLElement | null;
  enableSidebarConversationDragging(): () => void;
  openConversation(conversation: ConversationRef): void;
  scrollToMessage(id: string): void;
};

export type DeepSeekFormula = {
  element: HTMLElement;
  latex: string;
  display: boolean;
};
