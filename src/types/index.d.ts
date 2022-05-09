export {};

declare var window: {
  webkitAudioContext: typeof AudioContext;
} & Window & typeof globalThis;

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext
  }
}
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
