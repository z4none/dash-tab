/**
 * 壁纸缓存工具
 * 使用 IndexedDB 存储壁纸图片数据
 */

const DB_NAME = 'DashTabWallpapers';
const STORE_NAME = 'wallpapers';
const DB_VERSION = 1;
const CACHE_EXPIRY_DAYS = 7; // 缓存有效期 7 天

/**
 * 初始化 IndexedDB
 */
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('category', 'category', { unique: false });
      }
    };
  });
};

/**
 * 从 URL 下载图片并转换为 Blob
 */
const downloadImageAsBlob = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  return await response.blob();
};

/**
 * 保存壁纸到缓存
 * @param {string} url - 壁纸 URL
 * @param {string} category - 壁纸分类 (general/anime)
 * @returns {Promise<string>} - 返回可用的 Data URL
 */
export const cacheWallpaper = async (url, category = 'general') => {
  try {
    // 下载图片
    const blob = await downloadImageAsBlob(url);

    // 转换为 Data URL（用于立即显示）
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

    // 保存到 IndexedDB
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const cacheData = {
      url,
      category,
      blob,
      dataUrl,
      timestamp: Date.now(),
    };

    await new Promise((resolve, reject) => {
      const request = store.put(cacheData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`[WallpaperCache] 壁纸已缓存: ${url.substring(0, 50)}...`);
    return dataUrl;
  } catch (error) {
    console.error('[WallpaperCache] 缓存壁纸失败:', error);
    // 如果缓存失败，返回原始 URL
    return url;
  }
};

/**
 * 从缓存获取壁纸
 * @param {string} url - 壁纸 URL
 * @returns {Promise<string|null>} - 返回 Data URL 或 null
 */
export const getCachedWallpaper = async (url) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const cacheData = await new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!cacheData) {
      return null;
    }

    // 检查缓存是否过期
    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (now - cacheData.timestamp > expiryTime) {
      console.log(`[WallpaperCache] 缓存已过期: ${url.substring(0, 50)}...`);
      await deleteCachedWallpaper(url);
      return null;
    }

    console.log(`[WallpaperCache] 使用缓存壁纸: ${url.substring(0, 50)}...`);
    return cacheData.dataUrl;
  } catch (error) {
    console.error('[WallpaperCache] 读取缓存失败:', error);
    return null;
  }
};

/**
 * 删除指定缓存
 */
export const deleteCachedWallpaper = async (url) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.delete(url);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`[WallpaperCache] 已删除缓存: ${url.substring(0, 50)}...`);
  } catch (error) {
    console.error('[WallpaperCache] 删除缓存失败:', error);
  }
};

/**
 * 清理所有过期缓存
 */
export const cleanExpiredCache = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    const allCaches = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    let deletedCount = 0;
    for (const cache of allCaches) {
      if (now - cache.timestamp > expiryTime) {
        await deleteCachedWallpaper(cache.url);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[WallpaperCache] 已清理 ${deletedCount} 个过期缓存`);
    }
  } catch (error) {
    console.error('[WallpaperCache] 清理过期缓存失败:', error);
  }
};

/**
 * 获取缓存统计信息
 */
export const getCacheStats = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const allCaches = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    let totalSize = 0;
    allCaches.forEach((cache) => {
      if (cache.blob) {
        totalSize += cache.blob.size;
      }
    });

    return {
      count: allCaches.length,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    };
  } catch (error) {
    console.error('[WallpaperCache] 获取缓存统计失败:', error);
    return { count: 0, totalSize: 0, totalSizeMB: '0.00' };
  }
};

/**
 * 清空所有缓存
 */
export const clearAllCache = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('[WallpaperCache] 已清空所有缓存');
  } catch (error) {
    console.error('[WallpaperCache] 清空缓存失败:', error);
  }
};
