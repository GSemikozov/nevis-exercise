import '@testing-library/jest-dom/vitest';
import { MotionGlobalConfig } from 'motion/react';

// Finish every animation instantly, so leaving rows unmount without waiting 300ms.
MotionGlobalConfig.skipAnimations = true;

// jsdom lacks layout APIs that popover/list components commonly rely on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};

// jsdom ships HTMLDialogElement with `open` but without showModal()/close().
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  if (!this.open) return;
  this.open = false;
  this.dispatchEvent(new Event('close'));
};
