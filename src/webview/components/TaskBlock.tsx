import * as React from 'react';
import { marked } from 'marked';
import { TextBlock } from './types';

export interface TaskBlockProps {
  content: string;
  rawContent: string;
  isEditMode: boolean;
  onToggleEdit: () => void;
  onSave: (content: string) => void;
  onCancel: () => void;
  onContentClick?: (e: React.MouseEvent) => void;
}

export const TaskBlock: React.FC<TaskBlockProps> = (props) => {
  const { content, rawContent, isEditMode, onToggleEdit, onSave, onCancel, onContentClick } = props;
  const [editValue, setEditValue] = React.useState(rawContent || content);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const LINE_HEIGHT = 32;
  const MIN_LINES = 3;
  const MAX_LINES = 15;
  const PADDING = 24;

  const calculateTextareaHeight = (text: string): string => {
    const lineCount = (text.match(/\n/g) || []).length + 1;
    const clampedLines = Math.max(MIN_LINES, Math.min(MAX_LINES, lineCount));
    return `${clampedLines * LINE_HEIGHT + PADDING}px`;
  };

  const [textareaHeight, setTextareaHeight] = React.useState(() =>
    calculateTextareaHeight(rawContent || content)
  );

  React.useEffect(() => {
    setTextareaHeight(calculateTextareaHeight(editValue));
  }, [editValue]);

  React.useEffect(() => {
    if (isEditMode) {
      setEditValue(rawContent || content);
    }
  }, [isEditMode, rawContent, content]);

  React.useEffect(() => {
    if (isEditMode && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = 0;
      textareaRef.current.selectionEnd = 0;
    }
  }, [isEditMode]);

  const handleBlur = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue) {
      onSave(trimmedValue);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmedValue = editValue.trim();
      if (trimmedValue) {
        onSave(trimmedValue);
      }
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (isEditMode) {
    return React.createElement('textarea', {
      ref: textareaRef,
      className: 'textblock-content-edit',
      value: editValue,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditValue(e.target.value),
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      style: { height: textareaHeight }
    });
  }

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  let renderedContent;
  try {
    renderedContent = marked.parse(content);
  } catch (error) {
    renderedContent = escapeHtml(content);
  }

  return React.createElement('div', {
    className: 'textblock-content',
    dangerouslySetInnerHTML: { __html: renderedContent as string },
    onClick: onContentClick,
    style: { cursor: 'text' }
  });
};

interface RenderTextBlocksProps {
  textBlocks: TextBlock[];
  textBlockEditModes: Record<string, boolean>;
  onTextBlockDoubleClick: (blockId: string) => void;
  onSaveTextBlock: (blockId: string, content: string) => void;
  onCancelTextBlockEdit: (blockId: string) => void;
  onTextBlockClick?: (e: React.MouseEvent) => void;
}

export const renderTextBlocks = (props: RenderTextBlocksProps) => {
  const { textBlocks, textBlockEditModes, onTextBlockDoubleClick, onSaveTextBlock, onCancelTextBlockEdit, onTextBlockClick } = props;

  if (!textBlocks || textBlocks.length === 0) return null;

  return React.createElement('div', { className: 'text-blocks' },
    textBlocks.map((block) => {
      const isEditMode = textBlockEditModes[block.id] || false;

      return React.createElement('div', {
        key: block.id,
        className: 'text-block',
        'data-block-id': block.id,
        onDoubleClick: () => onTextBlockDoubleClick(block.id),
        style: {
          padding: '8px 12px',
          margin: '4px 0',
          backgroundColor: '#2d2d2d',
          borderRadius: '4px',
          fontSize: '13px',
          color: '#a0a0a0',
          lineHeight: '1.5',
          cursor: 'pointer'
        }
      },
        React.createElement(TaskBlock, {
          content: block.content,
          rawContent: block.rawContent,
          isEditMode: isEditMode,
          onToggleEdit: () => onTextBlockDoubleClick(block.id),
          onSave: (content: string) => onSaveTextBlock(block.id, content),
          onCancel: () => onCancelTextBlockEdit(block.id),
          onContentClick: onTextBlockClick
        })
      );
    })
  );
};
