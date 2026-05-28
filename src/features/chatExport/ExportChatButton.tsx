import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Download, X } from 'lucide-react';

import {
  getSettings,
  updateSettings,
  type ChatExportButtonPosition,
} from '@/src/core/settings';
import { logger } from '@/src/core/logger';
import type { DeepSeekAdapter } from '@/src/platform/deepseek/types';

import {
  chatExportFilename,
  downloadChatExport,
  formatChatExport,
  toChatExportTurns,
  type ChatExportMode,
  type ChatExportTurn,
} from './ChatExportService';

type ExportChatButtonProps = {
  adapter: DeepSeekAdapter;
};

const log = logger.child('ChatExport');
const SUCCESS_TIMEOUT_MS = 1800;
const BUTTON_MARGIN_PX = 8;
const BUTTON_DRAG_THRESHOLD_PX = 4;
const DEFAULT_BUTTON_RIGHT_PX = 18;
const DEFAULT_BUTTON_TOP_PX = 152;

type ButtonDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetY: number;
  offsetRight: number;
  width: number;
  height: number;
  lastPosition: ChatExportButtonPosition;
};

export function ExportChatButton({ adapter }: ExportChatButtonProps) {
  const [dialogTurns, setDialogTurns] = useState<ChatExportTurn[] | null>(null);
  const [selectedTurnIds, setSelectedTurnIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ChatExportMode>('all');
  const [status, setStatus] = useState('');
  const [buttonPosition, setButtonPosition] = useState<ChatExportButtonPosition>(() =>
    clampChatExportButtonPosition(DEFAULT_CHAT_EXPORT_BUTTON_POSITION, { width: 92, height: 36 }),
  );
  const [isDraggingButton, setIsDraggingButton] = useState(false);
  const dragStateRef = useRef<ButtonDragState | null>(null);
  const buttonDraggedRef = useRef(false);

  const previewTurns = useMemo(() => [...(dialogTurns ?? [])].reverse(), [dialogTurns]);
  const selectedExportableCount = useMemo(
    () =>
      (dialogTurns ?? []).filter(
        (turn) => selectedTurnIds.has(turn.id) && hasMessageForMode(turn, mode),
      ).length,
    [dialogTurns, mode, selectedTurnIds],
  );

  useEffect(() => {
    let cancelled = false;

    void getSettings()
      .then((settings) => {
        if (!cancelled && settings.chatExportButtonPosition) {
          setButtonPosition(
            clampChatExportButtonPosition(settings.chatExportButtonPosition, {
              width: 92,
              height: 36,
            }),
          );
        }
      })
      .catch((error) => log.warn('Failed to load chat export button position', { error }));

    return () => {
      cancelled = true;
    };
  }, []);

  function openDialog(): void {
    try {
      const turns = toChatExportTurns(adapter.getTurns()).filter((turn) => turn.user || turn.assistant);
      if (turns.length === 0) {
        setStatus('无可导出消息');
        return;
      }

      setDialogTurns(turns);
      setSelectedTurnIds(new Set(turns.map((turn) => turn.id)));
      setMode('all');
      setStatus('');
      log.info('Chat export dialog opened', { count: turns.length });
    } catch (error) {
      log.error('Failed to open chat export dialog', { error });
      setStatus('导出失败');
    }
  }

  function toggleTurn(turnId: string): void {
    setSelectedTurnIds((current) => {
      const next = new Set(current);
      if (next.has(turnId)) next.delete(turnId);
      else next.add(turnId);
      return next;
    });
  }

  function setAllSelected(selected: boolean): void {
    setSelectedTurnIds(selected ? new Set(dialogTurns?.map((turn) => turn.id) ?? []) : new Set());
  }

  function exportSelected(): void {
    if (!dialogTurns) return;

    try {
      const conversation = adapter.getCurrentConversation();
      const content = formatChatExport(dialogTurns, {
        conversation,
        mode,
        selectedTurnIds,
      });
      downloadChatExport(content, chatExportFilename(conversation));
      setDialogTurns(null);
      setStatus('已导出');
      window.setTimeout(() => setStatus(''), SUCCESS_TIMEOUT_MS);
      log.info('Chat exported', { mode, selectedCount: selectedTurnIds.size });
    } catch (error) {
      log.error('Chat export failed', { error, mode });
      setStatus(error instanceof Error ? error.message : '导出失败');
    }
  }

  function startButtonDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const position = clampChatExportButtonPosition(
      {
        top: rect.top,
        right: window.innerWidth - rect.right,
      },
      { width: rect.width, height: rect.height },
    );

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetY: event.clientY - rect.top,
      offsetRight: rect.right - event.clientX,
      width: rect.width,
      height: rect.height,
      lastPosition: position,
    };
    buttonDraggedRef.current = false;
    setIsDraggingButton(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveButton(event: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = Math.abs(event.clientX - drag.startX);
    const deltaY = Math.abs(event.clientY - drag.startY);
    if (deltaX > BUTTON_DRAG_THRESHOLD_PX || deltaY > BUTTON_DRAG_THRESHOLD_PX) {
      buttonDraggedRef.current = true;
    }

    if (!buttonDraggedRef.current) return;

    const nextPosition = clampChatExportButtonPosition(
      {
        top: event.clientY - drag.offsetY,
        right: window.innerWidth - event.clientX - drag.offsetRight,
      },
      { width: drag.width, height: drag.height },
    );
    drag.lastPosition = nextPosition;
    setButtonPosition(nextPosition);
  }

  function finishButtonDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragStateRef.current = null;
    setIsDraggingButton(false);
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (!buttonDraggedRef.current) return;

    void updateSettings({ chatExportButtonPosition: drag.lastPosition }).catch((error) =>
      log.warn('Failed to save chat export button position', { error }),
    );
  }

  function clickExportButton(event: ReactMouseEvent<HTMLButtonElement>): void {
    if (buttonDraggedRef.current) {
      event.preventDefault();
      buttonDraggedRef.current = false;
      return;
    }

    openDialog();
  }

  const allSelected = dialogTurns !== null && selectedTurnIds.size === dialogTurns.length;
  const partiallySelected =
    dialogTurns !== null && selectedTurnIds.size > 0 && selectedTurnIds.size < dialogTurns.length;

  return (
    <>
      <button
        className="dse-chat-export-button"
        data-dse-dragging={isDraggingButton ? 'true' : undefined}
        type="button"
        title="拖动调整位置，点击导出聊天记录"
        style={{ top: `${buttonPosition.top}px`, right: `${buttonPosition.right}px` }}
        onClick={clickExportButton}
        onPointerCancel={finishButtonDrag}
        onPointerDown={startButtonDrag}
        onPointerMove={moveButton}
        onPointerUp={finishButtonDrag}
      >
        <Download size={16} />
        <span>{status || '导出'}</span>
      </button>

      {dialogTurns ? (
        <div className="dse-chat-export-dialog" data-dse-root="true">
          <section className="dse-chat-export-dialog__panel" role="dialog" aria-modal="true">
            <header className="dse-chat-export-dialog__header">
              <div>
                <h2>导出聊天记录</h2>
                <p>界面按最新消息在前展示，导出文件按原始对话顺序排列。</p>
              </div>
              <button
                className="dse-chat-export-dialog__icon-button"
                type="button"
                title="关闭"
                onClick={() => setDialogTurns(null)}
              >
                <X size={17} />
              </button>
            </header>

            <div className="dse-chat-export-dialog__toolbar">
              <div className="dse-chat-export-dialog__modes">
                <ModeOption mode="all" currentMode={mode} label="全部" onChange={setMode} />
                <ModeOption mode="user" currentMode={mode} label="只提问" onChange={setMode} />
                <ModeOption
                  mode="assistant"
                  currentMode={mode}
                  label="只回复"
                  onChange={setMode}
                />
              </div>

              <label className="dse-chat-export-dialog__select-all">
                <input
                  ref={(input) => {
                    if (input) input.indeterminate = partiallySelected;
                  }}
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => setAllSelected(event.currentTarget.checked)}
                />
                <span>全选</span>
              </label>
            </div>

            <div className="dse-chat-export-dialog__list">
              {previewTurns.map((turn) => (
                <TurnOption
                  key={turn.id}
                  checked={selectedTurnIds.has(turn.id)}
                  disabled={!hasMessageForMode(turn, mode)}
                  turn={turn}
                  onToggle={() => toggleTurn(turn.id)}
                />
              ))}
            </div>

            <footer className="dse-chat-export-dialog__footer">
              <span>{selectedExportableCount} 条可导出</span>
              <div>
                <button className="dse-button" type="button" onClick={() => setDialogTurns(null)}>
                  取消
                </button>
                <button
                  className="dse-button dse-button--primary"
                  type="button"
                  disabled={selectedExportableCount === 0}
                  onClick={exportSelected}
                >
                  导出
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

export const DEFAULT_CHAT_EXPORT_BUTTON_POSITION: ChatExportButtonPosition = {
  top: DEFAULT_BUTTON_TOP_PX,
  right: DEFAULT_BUTTON_RIGHT_PX,
};

export function clampChatExportButtonPosition(
  position: ChatExportButtonPosition,
  buttonSize: { width: number; height: number },
  viewport: { width: number; height: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): ChatExportButtonPosition {
  const maxTop = Math.max(BUTTON_MARGIN_PX, viewport.height - buttonSize.height - BUTTON_MARGIN_PX);
  const maxRight = Math.max(BUTTON_MARGIN_PX, viewport.width - buttonSize.width - BUTTON_MARGIN_PX);

  return {
    top: clamp(Math.round(position.top), BUTTON_MARGIN_PX, maxTop),
    right: clamp(Math.round(position.right), BUTTON_MARGIN_PX, maxRight),
  };
}

function ModeOption(props: {
  mode: ChatExportMode;
  currentMode: ChatExportMode;
  label: string;
  onChange: (mode: ChatExportMode) => void;
}) {
  return (
    <label className="dse-chat-export-dialog__mode">
      <input
        type="radio"
        checked={props.mode === props.currentMode}
        onChange={() => props.onChange(props.mode)}
      />
      <span>{props.label}</span>
    </label>
  );
}

function TurnOption(props: {
  checked: boolean;
  disabled: boolean;
  turn: ChatExportTurn;
  onToggle: () => void;
}) {
  const userPreview = compactMiddle(props.turn.user?.previewText ?? '', 88);
  const assistantPreview = compactAssistantPreview(props.turn.assistant?.previewText ?? '', 78);

  return (
    <label className="dse-chat-export-turn">
      <input
        type="checkbox"
        checked={props.checked && !props.disabled}
        disabled={props.disabled}
        onChange={props.onToggle}
      />
      <span className="dse-chat-export-turn__content">
        <span className="dse-chat-export-turn__title">Turn {props.turn.index + 1}</span>
        {userPreview ? <span className="dse-chat-export-turn__line">{userPreview}</span> : null}
        {assistantPreview.length > 0 ? (
          <span className="dse-chat-export-turn__reply">
            {assistantPreview.map((line, index) => (
              <span key={index}>{line}</span>
            ))}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function hasMessageForMode(turn: ChatExportTurn, mode: ChatExportMode): boolean {
  if (mode === 'user') return Boolean(turn.user);
  if (mode === 'assistant') return Boolean(turn.assistant);
  return Boolean(turn.user || turn.assistant);
}

function compactMiddle(text: string, maxLength: number): string {
  const normalized = normalizePreview(text);
  if (normalized.length <= maxLength) return normalized;

  const marker = '......';
  const available = Math.max(maxLength - marker.length, 8);
  const headLength = Math.ceil(available / 2);
  const tailLength = available - headLength;
  return `${normalized.slice(0, headLength)}${marker}${normalized.slice(-tailLength)}`;
}

export function compactAssistantPreview(text: string, lineLength: number): string[] {
  const normalized = normalizePreview(text);
  if (!normalized) return [];
  if (normalized.length <= lineLength) return [normalized];
  if (normalized.length <= lineLength * 2) {
    return [normalized.slice(0, lineLength), normalized.slice(lineLength)];
  }

  const marker = '...';
  const contentLength = Math.max(lineLength - marker.length, 4);
  return [
    `${normalized.slice(0, contentLength)}${marker}`,
    `${marker}${normalized.slice(-contentLength)}`,
  ];
}

function normalizePreview(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
