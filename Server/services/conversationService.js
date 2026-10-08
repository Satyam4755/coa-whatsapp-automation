import mongoose from "mongoose";
import Lead from "../models/Lead.js";

class ConversationService {
  constructor() {
    this.activeConversations = new Map(); // userNumber -> { docId, chat: Array, lastActivity, processedMessageIds: Set }
    this.sessionTtlMs = 24 * 60 * 60 * 1000; // 24-hour continuous conversation window
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
    let chat = [];

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
          chat = Array.isArray(latestDoc.chat) ? latestDoc.chat : [];
        }
      } catch (err) {
        console.warn("MongoDB check for active conversation warning:", err.message);
      }
    }

    const session = {
      docId,
      chat,
      lastActivity: now,
      processedMessageIds: new Set(),
    };

    this.activeConversations.set(cleanNumber, session);
    return session;
  }

  /**
   * Atomically append a message to the user's conversation document
   * Formats:
   * - Incoming user message: { user: messageText }
   * - Outgoing COA message: { coa: messageText }
   */
  async logMessage({ userNumber, sender, message, messageId = null }) {
    if (!userNumber || !message) return null;

    try {
      const cleanNumber = userNumber.toString().trim();
      const messageText = typeof message === "string" ? message : JSON.stringify(message);
      const isUser = sender === "User" || sender === "user";
      const chatEntry = isUser ? { user: messageText } : { coa: messageText };

      const session = await this.getOrCreateActiveSession(cleanNumber);

      // Check messageId deduplication within this active session
      if (messageId && session.processedMessageIds.has(messageId)) {
        return {
          docId: session.docId,
          chatEntry,
          chat: session.chat,
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

      session.chat.push(chatEntry);
      session.lastActivity = Date.now();

      // Persist to MongoDB if connected
      if (mongoose.connection.readyState === 1) {
        if (!session.docId) {
          // Create new document with only _id, chat, chatDate, userNumber
          const newDoc = new Lead({
            userNumber: cleanNumber,
            chatDate: new Date(),
            chat: [chatEntry],
          });
          const savedDoc = await newDoc.save();
          session.docId = savedDoc._id;
        } else {
          // Atomically append new entry into chat array
          await Lead.updateOne(
            { _id: session.docId },
            { $push: { chat: chatEntry } }
          );
        }
      }

      return {
        docId: session.docId,
        chatEntry,
        chat: session.chat,
      };
    } catch (error) {
      // Non-blocking: log error safely without credentials and never crash application
      console.error("ConversationService logMessage error:", error.message);
      return null;
    }
  }

  /**
   * Log incoming user message: { user: messageText }
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
   * Log outgoing COA response message: { coa: messageText }
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
