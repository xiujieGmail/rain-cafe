// 静态预览只使用浏览器内的演示剧情，服务密钥始终由本地后端管理。
export const staticPreview = process.env.NEXT_PUBLIC_STATIC_PREVIEW === 'true';
export const assetPath = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${path}`;
