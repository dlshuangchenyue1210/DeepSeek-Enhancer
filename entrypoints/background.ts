import { browser } from 'wxt/browser';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info('[DeepSeek Enhancer][Background] installed');
  });
});
