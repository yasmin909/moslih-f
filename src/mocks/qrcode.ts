// Mock stub — qrcode not used in browser build
export const toCanvas = () => Promise.resolve();
export const toDataURL = () => Promise.resolve('');
export const toString = () => Promise.resolve('');
export default { toCanvas, toDataURL, toString };
