/**
 * Message passing service for communication between
 * content scripts, background worker, and popup.
 */

import browser from 'webextension-polyfill';
import { Logger } from './LoggerService';

const TAG = 'Message';

/** Message types exchanged between extension components */
export type MessageType =
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'SETTINGS_CHANGED'
  | 'GET_TAB_INFO'
  | 'FEATURE_TOGGLE';

/** Message payload structure */
export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

/** Response structure */
export interface ExtensionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

type MessageHandler = (
  message: ExtensionMessage,
  sender: browser.Runtime.MessageSender,
) => Promise<ExtensionResponse> | ExtensionResponse | undefined;

class MessageServiceImpl {
  private handlers = new Map<MessageType, MessageHandler>();

  /** Register a handler for a specific message type */
  on(type: MessageType, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  /** Remove a handler */
  off(type: MessageType): void {
    this.handlers.delete(type);
  }

  /** Start listening for messages (call once in background/content) */
  listen(): void {
    browser.runtime.onMessage.addListener(
      (rawMessage: unknown, sender: browser.Runtime.MessageSender) => {
        const message = rawMessage as ExtensionMessage;
        if (!message?.type) return undefined;

        const handler = this.handlers.get(message.type);
        if (!handler) {
          Logger.debug(TAG, `No handler for message type: ${message.type}`);
          return undefined;
        }

        // Return a promise for async handlers
        try {
          const result = handler(message, sender);
          if (result instanceof Promise) {
            return result.catch((err: unknown) => {
              Logger.error(TAG, `Handler error for ${message.type}`, err);
              return { success: false, error: String(err) };
            });
          }
          return Promise.resolve(result);
        } catch (err) {
          Logger.error(TAG, `Handler error for ${message.type}`, err);
          return Promise.resolve({ success: false, error: String(err) });
        }
      },
    );
    Logger.info(TAG, 'Message listener started');
  }

  /** Send a message to the background script */
  async send(message: ExtensionMessage): Promise<ExtensionResponse> {
    try {
      const response = (await browser.runtime.sendMessage(message)) as ExtensionResponse;
      return response ?? { success: true };
    } catch (err) {
      Logger.error(TAG, `Send failed for ${message.type}`, err);
      return { success: false, error: String(err) };
    }
  }

  /** Send a message to a specific tab's content script */
  async sendToTab(tabId: number, message: ExtensionMessage): Promise<ExtensionResponse> {
    try {
      const response = (await browser.tabs.sendMessage(tabId, message)) as ExtensionResponse;
      return response ?? { success: true };
    } catch (err) {
      Logger.error(TAG, `SendToTab(${tabId}) failed for ${message.type}`, err);
      return { success: false, error: String(err) };
    }
  }
}

/** Singleton message service */
export const Messaging = new MessageServiceImpl();
