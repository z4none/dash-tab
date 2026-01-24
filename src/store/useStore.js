import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 辅助函数：查找空闲位置
const findEmptyPosition = (state, w, h) => {
  const { cols } = state.gridConfig;
  const occupied = new Set();

  // 标记所有被占用的格子
  state.layout.forEach((item) => {
    for (let y = item.y; y < item.y + item.h; y++) {
      for (let x = item.x; x < item.x + item.w; x++) {
        occupied.add(`${x},${y}`);
      }
    }
  });

  // 从第 5 行开始查找（为 widgets 预留空间）
  for (let y = 5; y < 100; y++) {
    for (let x = 0; x <= cols - w; x++) {
      let canPlace = true;
      for (let dy = 0; dy < h && canPlace; dy++) {
        for (let dx = 0; dx < w && canPlace; dx++) {
          if (occupied.has(`${x + dx},${y + dy}`)) {
            canPlace = false;
          }
        }
      }
      if (canPlace) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: 5 }; // 默认位置
};

const useStore = create(
  persist(
    (set) => ({
      // 主题设置
      theme: 'light',
      setTheme: (theme) => set({ theme }),

      // 字体源设置
      fontSource: 'google', // 'google' | 'china'
      setFontSource: (source) => set({ fontSource: source }),

      // 网站快捷方式
      shortcuts: [],
      addShortcut: (shortcut) =>
        set((state) => {
          const id = Date.now();
          const newShortcut = { ...shortcut, id };

          const position = findEmptyPosition(state, 1, 1);

          return {
            shortcuts: [...state.shortcuts, newShortcut],
            layout: [
              ...state.layout,
              { id: `shortcut-${id}`, x: position.x, y: position.y, w: 1, h: 1 },
            ],
          };
        }),
      removeShortcut: (id) =>
        set((state) => ({
          shortcuts: state.shortcuts.filter((s) => s.id !== id),
          layout: state.layout.filter((item) => item.id !== `shortcut-${id}`),
        })),
      updateShortcut: (id, updates) =>
        set((state) => ({
          shortcuts: state.shortcuts.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
      reorderShortcuts: (shortcuts) => set({ shortcuts }),

      // Widget 实例配置（新架构）
      widgetInstances: [],
      // 格式：{ id: 'clock-xxx', type: 'clock', config: {...}, createdAt: '', updatedAt: '' }

      // 旧的 Widget 配置（保留用于兼容和迁移）
      widgets: {
        clock: { enabled: false, format24h: true },
        weather: {
          enabled: false,
          unit: 'celsius', // 'celsius' | 'fahrenheit'
          location: {
            latitude: null,
            longitude: null,
            name: '', // 城市名称（用于显示）
            timezone: 'auto',
          },
          savedCities: [], // 保存的常用城市列表
        },
        search: { enabled: false, engine: 'google' },
        todo: {
          enabled: false, // 启用待办事项
          items: [], // 待办事项列表
        },
        notes: {
          enabled: false, // 笔记功能总开关
          instances: {}, // 笔记实例：{ 'note-xxx': { id, title, content, createdAt, updatedAt, isEditing } }
          settings: {
            defaultTitle: '新笔记',
          },
        },
        speeddial: {
          enabled: false, // SpeedDial 功能开关（默认禁用）
          bindings: {}, // 键位绑定：{ 'a': 'https://example.com', 'x': 'https://x.com', ... }
        },
      },
      updateWidget: (widgetName, config) =>
        set((state) => ({
          widgets: {
            ...state.widgets,
            [widgetName]: { ...state.widgets[widgetName], ...config },
          },
        })),

      // 笔记实例管理
      addNoteInstance: (config = {}) =>
        set((state) => {
          const id = `note-${Date.now()}`;

          // 确保 notes 配置存在
          const notesConfig = state.widgets.notes || {
            enabled: true,
            instances: {},
            settings: { defaultTitle: '新笔记' },
          };

          const defaultConfig = {
            id,
            title: notesConfig.settings.defaultTitle,
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isEditing: true, // 新建时默认编辑模式
          };

          const newInstance = { ...defaultConfig, ...config };

          // 查找空位置（默认尺寸 4x4）
          const position = findEmptyPosition(state, 4, 4);

          return {
            widgets: {
              ...state.widgets,
              notes: {
                ...notesConfig,
                instances: {
                  ...notesConfig.instances,
                  [id]: newInstance,
                },
              },
            },
            layout: [
              ...state.layout,
              { id, x: position.x, y: position.y, w: 4, h: 4 },
            ],
          };
        }),

      updateNoteInstance: (instanceId, updates) =>
        set((state) => {
          // 确保 notes 配置存在
          if (!state.widgets.notes?.instances?.[instanceId]) {
            console.warn(`[Store] 笔记实例 ${instanceId} 不存在`);
            return state;
          }

          return {
            widgets: {
              ...state.widgets,
              notes: {
                ...state.widgets.notes,
                instances: {
                  ...state.widgets.notes.instances,
                  [instanceId]: {
                    ...state.widgets.notes.instances[instanceId],
                    ...updates,
                    updatedAt: new Date().toISOString(),
                  },
                },
              },
            },
          };
        }),

      removeNoteInstance: (instanceId) =>
        set((state) => {
          // 确保 notes 配置存在
          if (!state.widgets.notes?.instances) {
            console.warn(`[Store] notes.instances 不存在`);
            return state;
          }

          const { [instanceId]: removed, ...remainingInstances } = state.widgets.notes.instances;

          return {
            widgets: {
              ...state.widgets,
              notes: {
                ...state.widgets.notes,
                instances: remainingInstances,
              },
            },
            layout: state.layout.filter((item) => item.id !== instanceId),
          };
        }),

      // ==================== 新的 Widget 实例管理方法 ====================

      // 添加 Widget 实例
      addWidgetInstance: (type, config = {}, size = {}) =>
        set((state) => {
          const id = `${type}-${Date.now()}`;
          const now = new Date().toISOString();

          // 创建新的 widget 实例
          const newInstance = {
            id,
            type,
            config,
            createdAt: now,
            updatedAt: now,
          };

          // 查找空位置（使用 size 或默认尺寸）
          const { w = 4, h = 4 } = size;
          const position = findEmptyPosition(state, w, h);

          return {
            widgetInstances: [...state.widgetInstances, newInstance],
            layout: [
              ...state.layout,
              { id, x: position.x, y: position.y, w, h },
            ],
          };
        }),

      // 更新 Widget 实例配置
      updateWidgetInstance: (id, configUpdates) =>
        set((state) => {
          const instanceIndex = state.widgetInstances.findIndex((inst) => inst.id === id);
          if (instanceIndex === -1) {
            console.warn(`[Store] Widget 实例 ${id} 不存在`);
            return state;
          }

          const newInstances = [...state.widgetInstances];
          newInstances[instanceIndex] = {
            ...newInstances[instanceIndex],
            config: {
              ...newInstances[instanceIndex].config,
              ...configUpdates,
            },
            updatedAt: new Date().toISOString(),
          };

          return { widgetInstances: newInstances };
        }),

      // 删除 Widget 实例
      removeWidgetInstance: (id) =>
        set((state) => ({
          widgetInstances: state.widgetInstances.filter((inst) => inst.id !== id),
          layout: state.layout.filter((item) => item.id !== id),
        })),

      // 获取 Widget 实例
      getWidgetInstance: (id) => (state) => {
        return state.widgetInstances.find((inst) => inst.id === id);
      },

      // Widget 统一样式配置
      widgetStyles: {
        // 背景样式
        background: {
          color: '#ffffff',        // 浅色模式背景颜色 (RGB hex)
          colorDark: '#1f2937',    // 深色模式背景颜色 (RGB hex)
          opacity: 80,             // 背景透明度 (0-100)
          blur: 'md',              // 背景模糊: 'none' | 'sm' | 'md' | 'lg' | 'xl'
        },
        // 圆角
        borderRadius: '2xl',       // 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'
        // 阴影
        shadow: 'lg',              // 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
        // 内边距
        padding: 4,                // 1-12 (对应 p-1 到 p-12)
        // 边框
        border: {
          enabled: false,
          width: 1,                // 1-8
          color: 'gray-200',       // 浅色模式
          colorDark: 'gray-700',   // 深色模式
        },
        // 主题色 (用于按钮、高亮等)
        primaryColor: 'primary-500',
        primaryColorHover: 'primary-600',
        // 文字颜色
        text: {
          primary: 'gray-800',     // 主要文字 (浅色)
          primaryDark: 'white',    // 主要文字 (深色)
          secondary: 'gray-600',   // 次要文字 (浅色)
          secondaryDark: 'gray-300', // 次要文字 (深色)
          muted: 'gray-500',       // 弱化文字 (浅色)
          mutedDark: 'gray-400',   // 弱化文字 (深色)
        },
        // 交互元素样式
        interactive: {
          hoverBg: 'gray-100',     // 悬停背景 (浅色)
          hoverBgDark: 'gray-700', // 悬停背景 (深色)
          activeBg: 'gray-200',    // 激活背景 (浅色)
          activeBgDark: 'gray-600', // 激活背景 (深色)
        },
      },
      setWidgetStyles: (styles) =>
        set((state) => ({
          widgetStyles: { ...state.widgetStyles, ...styles },
        })),

      // 背景设置
      background: {
        type: 'color', // 'color' | 'gradient' | 'image' | 'unsplash'
        value: '#f3f4f6',
        blur: 0, // 0-20
        brightness: 100, // 0-200
        opacity: 100, // 0-100
      },
      setBackground: (background) => set({ background }),

      // 编辑模式
      isEditMode: false,
      setEditMode: (isEditMode) => set({ isEditMode }),

      // 网格布局配置
      gridConfig: {
        cols: 12, // 列数
        rows: 8, // 行数
        cellSize: 96, // 单元格大小（px，正方形）
        gap: 16, // 网格间隙（px）
        position: 'c', // 9宫格位置: 'lt' | 't' | 'rt' | 'l' | 'c' | 'r' | 'lb' | 'b' | 'rb'
      },
      setGridConfig: (config) =>
        set((state) => ({
          gridConfig: { ...state.gridConfig, ...config },
        })),

      // 网格布局（存储每个元素的位置和大小）
      layout: [],
      updateLayout: (id, position) =>
        set((state) => {
          const existingIndex = state.layout.findIndex((item) => item.id === id);
          if (existingIndex >= 0) {
            // 更新现有项
            const newLayout = [...state.layout];
            newLayout[existingIndex] = { ...newLayout[existingIndex], ...position };
            return { layout: newLayout };
          } else {
            // 添加新项
            return { layout: [...state.layout, { id, ...position }] };
          }
        }),
      removeFromLayout: (id) =>
        set((state) => ({
          layout: state.layout.filter((item) => item.id !== id),
        })),
      setLayout: (layout) => set({ layout }),
    }),
    {
      name: 'dash-tab-storage',
      version: 1,
      partializeState: (state) => ({
        // 排除 isEditMode，不持久化到 localStorage
        // 每次刷新页面都会重置为 false
        theme: state.theme,
        fontSource: state.fontSource,
        shortcuts: state.shortcuts,
        widgets: state.widgets,
        widgetInstances: state.widgetInstances,
        background: state.background,
        gridConfig: state.gridConfig,
        layout: state.layout,
        widgetStyles: state.widgetStyles,
      }),
      // 合并策略：从 localStorage 恢复数据时，确保 isEditMode 始终为 false
      merge: (persistedState, currentState) => {
        // 删除持久化状态中的 isEditMode（如果存在）
        const { isEditMode, ...restPersistedState } = persistedState;
        // 合并，但保持 isEditMode 为初始值 false
        return {
          ...currentState,
          ...restPersistedState,
          isEditMode: false, // 强制重置为 false
        };
      },
      migrate: (persistedState, version) => {
        // 删除旧的 isEditMode（如果存在）
        // 确保每次刷新都是预览模式
        delete persistedState.isEditMode;

        // 迁移旧的天气配置格式
        if (persistedState.widgets?.weather) {
          const weather = persistedState.widgets.weather;

          // 如果没有 location 对象，创建一个空的
          if (!weather.location) {
            weather.location = {
              latitude: null,
              longitude: null,
              name: '',
              timezone: 'auto',
            };
          }

          // 如果没有 savedCities，创建一个空数组
          if (!weather.savedCities) {
            weather.savedCities = [];
          }

          // 迁移旧的温度单位格式 'c'/'f' -> 'celsius'/'fahrenheit'
          if (weather.unit === 'c') {
            weather.unit = 'celsius';
          } else if (weather.unit === 'f') {
            weather.unit = 'fahrenheit';
          }

          // 删除旧的字段
          delete weather.apiKey;
          delete weather.city;
        }

        // 迁移旧的网格配置格式（改为固定 px 方案）
        if (persistedState.gridConfig) {
          const grid = persistedState.gridConfig;

          // 删除旧的 width 和 height 字段
          delete grid.width;
          delete grid.height;

          // 如果没有 cellSize，设置默认值
          if (!grid.cellSize) {
            grid.cellSize = 96;
          }
        }

        // 初始化笔记配置（如果不存在）
        if (!persistedState.widgets?.notes) {
          if (!persistedState.widgets) {
            persistedState.widgets = {};
          }
          persistedState.widgets.notes = {
            enabled: true,
            instances: {},
            settings: {
              defaultTitle: '新笔记',
            },
          };
        }

        // 迁移旧的 speedDial 到 speeddial（统一命名）
        if (persistedState.widgets?.speedDial) {
          persistedState.widgets.speeddial = persistedState.widgets.speedDial;
          delete persistedState.widgets.speedDial;
        }

        // 初始化 SpeedDial 配置（如果不存在）
        if (!persistedState.widgets?.speeddial) {
          if (!persistedState.widgets) {
            persistedState.widgets = {};
          }
          persistedState.widgets.speeddial = {
            enabled: false, // 默认禁用，需要用户手动启用
            bindings: {},
          };
        }

        // 迁移 widgetStyles 背景配置（从 base/baseDark 到 color/colorDark）
        if (persistedState.widgetStyles?.background) {
          const bg = persistedState.widgetStyles.background;

          // 如果使用旧格式 (base/baseDark)，转换为新格式 (color/colorDark)
          if (bg.base && !bg.color) {
            // 将 Tailwind 类名转换为 hex 颜色
            const colorMap = {
              'white': '#ffffff',
              'gray-800': '#1f2937',
              'gray-900': '#111827',
            };
            bg.color = colorMap[bg.base] || '#ffffff';
            delete bg.base;
          }

          if (bg.baseDark && !bg.colorDark) {
            const colorMap = {
              'white': '#ffffff',
              'gray-800': '#1f2937',
              'gray-900': '#111827',
            };
            bg.colorDark = colorMap[bg.baseDark] || '#1f2937';
            delete bg.baseDark;
          }
        }

        return persistedState;
      },
    }
  )
);

export default useStore;
