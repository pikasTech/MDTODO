import * as React from 'react';

// 执行模式类型
export type ExecutionMode = 'claude' | 'opencode';

interface SettingsPanelProps {
  isOpen: boolean;
  executionMode: ExecutionMode;
  model?: string;
  models: ModelInfo[];
  onClose: () => void;
  onChange: (mode: ExecutionMode) => void;
  onModelChange: (model: string) => void;
  onFetchModels: () => void;
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

// 面板宽度（px）
const PANEL_WIDTH = 280;
// 面板内边距（px）
const PANEL_PADDING = 16;

const SettingsPanel: React.FC<SettingsPanelProps> = (props) => {
  const { isOpen, executionMode, model, models: externalModels, onClose, onChange, onModelChange, onFetchModels } = props;
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [show, setShow] = React.useState(false);
  const [models, setModels] = React.useState<ModelInfo[]>(externalModels || []);
  const [loadingModels, setLoadingModels] = React.useState(false);
  const [modelError, setModelError] = React.useState<string | null>(null);

  // 当外部 models 更新时同步到内部状态
  React.useEffect(() => {
    if (externalModels && externalModels.length > 0) {
      console.log('[SettingsPanel] Syncing external models:', externalModels.length);
      setModels(externalModels);
    }
  }, [externalModels]);

  // 处理刷新模型列表
  const handleFetchModels = React.useCallback(() => {
    setLoadingModels(true);
    onFetchModels();
  }, [onFetchModels]);

  // 处理显示动画
  React.useEffect(() => {
    if (isOpen) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [isOpen]);

  // 面板渲染
  if (!show && !isOpen) {
    return null;
  }

  return React.createElement('div', {
    ref: panelRef,
    className: 'settings-panel',
    style: {
      position: 'fixed',
      zIndex: 10000,
      top: '50%',
      left: '50%',
      transform: show ? 'translate(-50%, -50%)' : 'translate(-50%, -40%)',
      opacity: show ? 1 : 0,
      transition: 'opacity 0.15s ease, transform 0.15s ease',
      backgroundColor: '#2d2d2d',
      border: '1px solid #3c3c3c',
      borderRadius: '8px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
      minWidth: PANEL_WIDTH,
      padding: PANEL_PADDING,
      pointerEvents: show ? 'auto' : 'none',
    }
  },
    // 标题栏
    React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid #3c3c3c',
      }
    },
      React.createElement('span', {
        style: {
          fontSize: '14px',
          fontWeight: 600,
          color: '#ffffff',
        }
      }, '执行设置'),
      React.createElement('div', {
        onClick: onClose,
        style: {
          cursor: 'pointer',
          fontSize: '18px',
          padding: '4px 8px',
          color: '#888',
        },
        title: '关闭'
      }, '×')
    ),
    // 执行模式选择
    React.createElement('div', null,
      React.createElement('label', {
        style: {
          display: 'block',
          fontSize: '12px',
          color: '#888',
          marginBottom: '8px',
        }
      }, '执行模式'),
      React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }
      },
        // Claude 选项
        React.createElement('div', {
          onClick: () => onChange('claude'),
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            backgroundColor: executionMode === 'claude' ? 'rgba(0, 122, 204, 0.15)' : '#252526',
            border: `1px solid ${executionMode === 'claude' ? '#007acc' : '#3c3c3c'}`,
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }
        },
          React.createElement('div', {
            style: {
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              border: `2px solid ${executionMode === 'claude' ? '#007acc' : '#3c3c3c'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }
          },
            executionMode === 'claude' && React.createElement('div', {
              style: {
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#007acc',
              }
            })
          ),
          React.createElement('div', null,
            React.createElement('div', {
              style: {
                fontSize: '13px',
                color: '#d4d4d4',
                fontWeight: 500,
              }
            }, 'Claude'),
            React.createElement('div', {
              style: {
                fontSize: '11px',
                color: '#888',
                marginTop: '2px',
              }
            }, '使用 Claude Code CLI 执行任务')
          )
        ),
        // OpenCode 选项
        React.createElement('div', {
          onClick: () => onChange('opencode'),
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            backgroundColor: executionMode === 'opencode' ? 'rgba(0, 122, 204, 0.15)' : '#252526',
            border: `1px solid ${executionMode === 'opencode' ? '#007acc' : '#3c3c3c'}`,
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }
        },
          React.createElement('div', {
            style: {
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              border: `2px solid ${executionMode === 'opencode' ? '#007acc' : '#3c3c3c'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }
          },
            executionMode === 'opencode' && React.createElement('div', {
              style: {
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#007acc',
              }
            })
          ),
          React.createElement('div', null,
            React.createElement('div', {
              style: {
                fontSize: '13px',
                color: '#d4d4d4',
                fontWeight: 500,
              }
            }, 'OpenCode'),
            React.createElement('div', {
              style: {
                fontSize: '11px',
                color: '#888',
                marginTop: '2px',
              }
            }, '使用 OpenCode CLI 执行任务')
          )
        )
      )
    ),
    // OpenCode 模式下的模型选择
    executionMode === 'opencode' && React.createElement('div', {
      style: {
        marginTop: '16px',
      }
    },
      React.createElement('label', {
        style: {
          display: 'block',
          fontSize: '12px',
          color: '#888',
          marginBottom: '8px',
        }
      }, '模型选择'),
      React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }
      },
        // 刷新按钮
        React.createElement('button', {
          onClick: handleFetchModels,
          style: {
            padding: '8px 12px',
            backgroundColor: '#252526',
            border: '1px solid #3c3c3c',
            borderRadius: '4px',
            color: '#d4d4d4',
            fontSize: '12px',
            cursor: 'pointer',
            textAlign: 'left',
          }
        }, loadingModels ? '加载中...' : '刷新模型列表'),
        // 模型下拉选择
        models.length > 0 && React.createElement('select', {
          value: model || '',
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onModelChange(e.target.value),
          style: {
            padding: '8px 12px',
            backgroundColor: '#252526',
            border: '1px solid #3c3c3c',
            borderRadius: '4px',
            color: '#d4d4d4',
            fontSize: '12px',
            cursor: 'pointer',
            width: '100%',
          }
        },
          React.createElement('option', { value: '' }, '选择模型...'),
          models.map((m) =>
            React.createElement('option', {
              key: m.id,
              value: m.id
            }, `${m.provider}/${m.name}`)
          )
        ),
        // 当前选择的模型
        model && React.createElement('div', {
          style: {
            fontSize: '11px',
            color: '#666',
            marginTop: '4px',
          }
        }, `当前: ${model}`)
      )
    ),
    // 底部说明
    React.createElement('div', {
      style: {
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid #3c3c3c',
        fontSize: '11px',
        color: '#666',
        lineHeight: 1.5,
      }
    }, '选择执行命令时使用的 CLI 工具。确保对应的 CLI 已安装在系统 PATH 中。')
  );
};

export { SettingsPanel };
export type { SettingsPanelProps };
