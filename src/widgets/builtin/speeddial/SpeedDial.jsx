import { useState, useEffect } from 'react';
import { MdClose, MdCheck } from 'react-icons/md';
import useStore from '../../../store/useStore';
import { useWidgetStyles } from '../../core/widgetStyles';

// QWERTY 键盘布局
const KEYBOARD_LAYOUT = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

/**
 * SpeedDial Widget - 键盘快捷访问
 * 每个字母键可以绑定一个网站，按键快速跳转
 * @param {string} instanceId - 实例 ID (可选，用于多实例)
 * @param {object} config - Widget 配置 (从新架构传入)
 * @param {object} manifest - Widget manifest 信息
 */
function SpeedDial({ instanceId, config, manifest }) {
  const { widgets, updateWidget, updateWidgetInstance, isEditMode: globalEditMode } = useStore();

  // 获取背景样式配置（从 config 或 manifest）
  const showBackground = config?.showBackground ?? manifest?.defaultBackground ?? true;
  const widgetStyles = useWidgetStyles(useStore, { showBackground });
  const [isEditing, setIsEditing] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editingUrl, setEditingUrl] = useState('');
  const [pressedKey, setPressedKey] = useState(null); // 当前按下的按键

  // 优先使用传入的 config，否则使用旧架构的配置（兼容性）
  const speedDialConfig = config || widgets.speeddial || { bindings: {} };
  const bindings = speedDialConfig.bindings || {};

  // 同步全局编辑模式和 SpeedDial 的编辑模式
  useEffect(() => {
    if (globalEditMode) {
      // 全局编辑模式开启时，自动进入编辑模式
      setIsEditing(true);
    } else {
      // 全局编辑模式退出时，自动退出编辑模式
      setIsEditing(false);
      setEditingKey(null);
      setEditingUrl('');
    }
  }, [globalEditMode]);

  // ESC 键关闭编辑弹窗
  useEffect(() => {
    if (!editingKey) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cancelEdit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingKey]);

  // 计算按键大小
  const [keySize, setKeySize] = useState(40);

  useEffect(() => {
    const container = document.getElementById('speeddial-container');
    if (!container) return;

    const updateKeySize = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // QWERTY 布局尺寸：4行，最宽10个键
      // 宽度需要：10个键 + 9个间隙
      // 高度需要：4个键 + 3个间隙
      const gap = 8; // 间隙大小
      const padding = 12; // 容器内边距

      // 根据宽度计算按键大小
      const availableWidth = containerWidth - padding * 2;
      const keySizeByWidth = (availableWidth - gap * 9) / 10;

      // 根据高度计算按键大小
      const availableHeight = containerHeight - padding * 2;
      const keySizeByHeight = (availableHeight - gap * 3) / 4;

      // 取较小值，确保按键不会溢出
      const calculatedSize = Math.floor(Math.min(keySizeByWidth, keySizeByHeight));
      setKeySize(Math.max(30, Math.min(80, calculatedSize))); // 限制在 30-80px 之间
    };

    // 使用 ResizeObserver 监听容器尺寸变化
    const resizeObserver = new ResizeObserver(() => {
      updateKeySize();
    });

    resizeObserver.observe(container);

    // 初始计算
    updateKeySize();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 全局键盘事件监听
  useEffect(() => {
    if (isEditing) return; // 编辑模式下不监听

    const handleKeyDown = (e) => {
      // 忽略在输入框中的按键
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      if (/^[a-z0-9]$/.test(key)) {
        e.preventDefault();
        // 设置按下的按键以显示高亮
        setPressedKey(key);
      }
    };

    const handleKeyUp = (e) => {
      // 忽略在输入框中的按键
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      if (/^[a-z0-9]$/.test(key)) {
        // 清除按下状态
        setPressedKey(null);

        // 如果有绑定的 URL，打开它
        if (bindings[key]) {
          window.location.href = bindings[key];
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [bindings, isEditing]);

  // 获取域名用于显示
  const getDomain = (url) => {
    if (!url) return '';
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // 开始编辑某个按键
  const startEditKey = (key) => {
    const lowerKey = key.toLowerCase();
    setEditingKey(key);
    setEditingUrl(bindings[lowerKey] || '');
  };

  // 保存按键绑定
  const saveKeyBinding = () => {
    if (!editingKey) return;

    const newBindings = { ...bindings };
    if (editingUrl.trim()) {
      // 确保 URL 有协议
      let url = editingUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      newBindings[editingKey.toLowerCase()] = url;
    } else {
      // 如果 URL 为空，删除绑定
      delete newBindings[editingKey.toLowerCase()];
    }

    // 使用新架构或旧架构的更新方法
    if (instanceId) {
      updateWidgetInstance(instanceId, { bindings: newBindings });
    } else {
      updateWidget('speeddial', { bindings: newBindings });
    }

    setEditingKey(null);
    setEditingUrl('');
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingKey(null);
    setEditingUrl('');
  };

  // 删除绑定
  const removeBinding = (key) => {
    const newBindings = { ...bindings };
    delete newBindings[key.toLowerCase()];

    // 使用新架构或旧架构的更新方法
    if (instanceId) {
      updateWidgetInstance(instanceId, { bindings: newBindings });
    } else {
      updateWidget('speeddial', { bindings: newBindings });
    }
  };

  // 渲染单个按键
  const renderKey = (key, keySize) => {
    const lowerKey = key.toLowerCase();
    const hasBinding = !!bindings[lowerKey];
    const isCurrentlyEditing = editingKey === key;
    const isPressed = pressedKey === lowerKey; // 检查是否正在被按下

    return (
      <div
        key={key}
        className={`
          relative flex flex-col items-center justify-center
          rounded-lg
          transition-all duration-150 ease-out
          ${hasBinding
            ? 'bg-sky-400 dark:bg-sky-500 text-white cursor-pointer'
            : `bg-gray-100 dark:bg-gray-700 ${isEditing ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600' : ''}`
          }
          ${isCurrentlyEditing ? 'ring-2 ring-primary-500' : ''}
          ${isPressed ? 'scale-110' : ''}
        `}
        style={{
          width: `${keySize}px`,
          height: `${keySize}px`,
        }}
        onClick={() => {
          if (isEditing) {
            startEditKey(key);
          } else if (hasBinding) {
            window.location.href = bindings[lowerKey];
          }
        }}
      >
        {/* 字母 */}
        <div
          className={`font-bold ${hasBinding ? 'text-white' : widgetStyles.textPrimary
            }`}
          style={{ fontSize: `${Math.max(12, keySize * 0.35)}px` }}
        >
          {key}
        </div>

        {/* 已绑定的域名 */}
        {hasBinding && !isEditing && (
          <div
            className="text-white/90 truncate max-w-full px-1"
            style={{ fontSize: `${Math.max(8, keySize * 0.2)}px` }}
          >
            {getDomain(bindings[lowerKey])}
          </div>
        )}

        {/* 编辑模式下的删除按钮 */}
        {isEditing && hasBinding && !isCurrentlyEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeBinding(key);
            }}
            className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            title="删除绑定"
          >
            <MdClose size={12} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className={`${widgetStyles.containerClass} flex flex-col h-full relative group`}
      style={widgetStyles.containerStyle}
    >
      {/* 键盘布局 */}
      <div id="speeddial-container" className="flex-1 flex items-center justify-center overflow-hidden w-full">
        {/* 键盘区域 */}
        <div className="flex flex-col gap-2">
          {KEYBOARD_LAYOUT.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="flex gap-2"
              style={{
                marginLeft: rowIndex === 2 ? `${keySize * 0.5}px` : rowIndex === 3 ? `${keySize * 1}px` : '0'
              }}
            >
              {row.map((key) => renderKey(key, keySize))}
            </div>
          ))}
        </div>

        {/* 提示文字 - 绝对定位在底部 */}
        {isEditing && (
          <div className={`absolute bottom-2 left-0 right-0 text-center ${widgetStyles.textMuted} text-xs`}>
            点击按键配置网址
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      {editingKey && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20">
          <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 w-80 shadow-2xl ${widgetStyles.textPrimary}`}>
            <h3 className="text-lg font-bold mb-4">
              配置按键 <span className="text-primary-500">{editingKey}</span>
            </h3>

            <input
              type="text"
              value={editingUrl}
              onChange={(e) => setEditingUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  saveKeyBinding();
                } else if (e.key === 'Escape') {
                  cancelEdit();
                }
              }}
              placeholder="输入网址，如：x.com 或 https://example.com"
              className={`w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 ${widgetStyles.textPrimary} focus:outline-none focus:border-primary-500`}
              autoFocus
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={saveKeyBinding}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                <MdCheck size={18} />
                保存
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                <MdClose size={18} />
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpeedDial;
