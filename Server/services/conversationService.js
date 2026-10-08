import mongoose from "mongoose";
import Lead from "../models/Lead.js";

class ConversationService {
  constructor() {
    this.activeConversations = new Map(); // userNumber -> { docId, coaCount, userCount, lastActivity, processedMessageIds: Set }
    this.sessionTtlMs = 24 * 60 * 60 * 1000; // 24-hour continuous conversation window
  }

  /**
   * Helper to count max numeric suffix for a prefix (e.g. "coa" or "user") in a chat object
   */
  getMaxIndex(chatObj, prefix) {
    if (!chatObj || typeof chatObj !== "object") return 0;
    let max = 0;
    const prefixWithUnderscore = `${prefix}_`;
    for (const key of Object.keys(chatObj)) {
      if (key.startsWith(prefixWithUnderscore)) {
        const num = parseInt(key.replace(prefixWithUnderscore, ""), 10);
        if (!isNaN(num) && num > max) {
          max = num;
        }
      }
    }
    return max;
  }

  /**
   * Get active session info for a user or initialize from MongoDB / create new
   */
  async getOrCreateActiveSession(cleanNumber) {
    const now = Date.now();
    const cached = this.activeConversations.get(cleanNumber);

    if (cached && now - cached.lastActivity < this.sessionTtlMs) {
      cached.lastActivity = now;
      return cached;
    }

    let docId = null;
    let coaCount = 0;
    let userCount = 0;
    let chat = {};

    if (mongoose.connection.readyState === 1) {
      try {
        const cutoff = new Date(now - this.sessionTtlMs);
        const latestDoc = await Lead.findOne({
          userNumber: cleanNumber,
          chatDate: { $gte: cutoff },
        })
          .sort({ chatDate: -1 })
          .lean();

        if (latestDoc && latestDoc._id) {
          docId = latestDoc._id;
          chat = latestDoc.chat || {};
          coaCount = this.getMaxIndex(chat, "coa");
          userCount = this.getMaxIndex(chat, "user");
        }
      } catch (err) {
        console.warn("MongoDB check for active conversation warning:", err.message);
      }
    }

    const session = {
      docId,
      coaCount,
      userCount,
      chat,
      lastActivity: now,
      processedMessageIds: new Set(),
    };

    this.activeConversations.set(cleanNumber, session);
    return session;
  }

  /**
   * Atomically append a message to the user's conversation document
   * Keys: coa_1, coa_2... for COA; user_1, user_2... for User
   */
  async logMessage({ userNumber, sender, message, messageId = null }) {
    if (!userNumber || !message) return null;

    try {
      const cleanNumber = userNumber.toString().trim();
      const messageText = typeof message === "string" ? message : JSON.stringify(message);
      const isUser = sender === "User" || sender === "user";
      const prefix = isUser ? "user" : "coa";

      const session = await this.getOrCreateActiveSession(cleanNumber);

      // Check messageId deduplication within this active session
      if (messageId && session.processedMessageIds.has(messageId)) {
        return {
          docId: session.docId,
          key: null,
          message: messageText,
          deduplicated: true,
        };
      }

      if (messageId) {
        session.processedMessageIds.add(messageId);
        // Keep set size bounded
        if (session.processedMessageIds.size > 200) {
          const first = session.processedMessageIds.values().next().value;
          session.processedMessageIds.delete(first);
        }
      }

      // Calculate next key index
      if (isUser) {
        session.userCount += 1;
      } else {
        session.coaCount += 1;
      }

      const nextIndex = isUser ? session.userCount : session.coaCount;
      const keyName = `${prefix}_${nextIndex}`;
      session.chat[keyName] = messageText;
      session.lastActivity = Date.now();

      // Persist to MongoDB if connected
      if (mongoose.connection.readyState === 1) {
        if (!session.docId) {
          // Create new document with only _id, chat, chatDate, userNumber
          const newDoc = new Lead({
            userNumber: cleanNumber,
            chatDate: new Date(),
            chat: {
              [keyName]: messageText,
            },
          });
          const savedDoc = await newDoc.save();
          session.docId = savedDoc._id;
        } else {
          // Append new key into chat object
          await Lead.updateOne(
            { _id: session.docId },
            { $set: { [`chat.${keyName}`]: messageText } }
          );
        }
      }

      return {
        docId: session.docId,
        key: keyName,
        message: messageText,
        chat: session.chat,
      };
    } catch (error) {
      // Non-blocking: log error safely without credentials and never crash application
      console.error("ConversationService logMessage error:", error.message);
      return null;
    }
  }

  /**
   * Log incoming user message
   */
  async logUserMessage({ userNumber, message, messageId = null }) {
    return this.logMessage({
      userNumber,
      sender: "User",
      message,
      messageId,
    });
  }

  /**
   * Log outgoing COA response message
   */
  async logCoaMessage({ userNumber, message, messageId = null }) {
    return this.logMessage({
      userNumber,
      sender: "COA",
      message,
      messageId,
    });
  }

  /**
   * Retrieve conversation document by _id
   */
  async getConversationById(id) {
    if (!id || mongoose.connection.readyState !== 1) return null;
    try {
      return await Lead.findById(id).lean();
    } catch (err) {
      console.error("ConversationService getConversationById error:", err.message);
      return null;
    }
  }

  /**
   * Retrieve latest conversation for user
   */
  async getLatestConversationForUser(userNumber) {
    if (!userNumber || mongoose.connection.readyState !== 1) return null;
    try {
      return await Lead.findOne({ userNumber: userNumber.toString().trim() })
        .sort({ chatDate: -1 })
        .lean();
    } catch (err) {
      console.error("ConversationService getLatestConversationForUser error:", err.message);
      return null;
    }
  }
}

export const conversationService = new ConversationService();
export default conversationService;
