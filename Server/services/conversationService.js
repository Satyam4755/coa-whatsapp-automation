import mongoose from "mongoose";
import Lead from "../models/Lead.js";

class ConversationService {
  constructor() {
    this.activeConversations = new Map(); // userNumber -> { conversationId, lastActivity }
    this.sessionTtlMs = 24 * 60 * 60 * 1000; // 24-hour continuous conversation window
  }

  /**
   * Get active conversationId for a user, or create a new one
   */
  async getOrCreateActiveConversationId(userNumber) {
    if (!userNumber) return `conv_unknown_${Date.now()}`;

    const cleanNumber = userNumber.toString().trim();
    const now = Date.now();

    // 1. Check in-memory active conversations cache
    const cached = this.activeConversations.get(cleanNumber);
    if (cached && now - cached.lastActivity < this.sessionTtlMs) {
      cached.lastActivity = now;
      return cached.conversationId;
    }

    // 2. Query MongoDB for latest conversation within the session window if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const cutoff = new Date(now - this.sessionTtlMs);
        const latestDoc = await Lead.findOne({
          userNumber: cleanNumber,
          createdAt: { $gte: cutoff },
        })
          .sort({ createdAt: -1 })
          .select("conversationId createdAt")
          .lean();

        if (latestDoc && latestDoc.conversationId) {
          this.activeConversations.set(cleanNumber, {
            conversationId: latestDoc.conversationId,
            lastActivity: now,
          });
          return latestDoc.conversationId;
        }
      } catch (err) {
        console.warn("MongoDB check for active conversation warning:", err.message);
      }
    }

    // 3. Generate a new unique conversation ID
    const newConvId = `conv_${cleanNumber}_${now}_${Math.random().toString(36).substring(2, 7)}`;
    this.activeConversations.set(cleanNumber, {
      conversationId: newConvId,
      lastActivity: now,
    });

    return newConvId;
  }

  /**
   * Atomically append a message to the user's conversation document
   */
  async logMessage({ userNumber, sender, message, messageId = null, conversationId = null }) {
    if (!userNumber || !message) return null;

    try {
      const cleanNumber = userNumber.toString().trim();
      const activeConvId = conversationId || (await this.getOrCreateActiveConversationId(cleanNumber));
      const messageText = typeof message === "string" ? message : JSON.stringify(message);
      const timestamp = new Date();

      const normalizedSender = sender === "User" || sender === "user" ? "User" : "COA";
      const finalMessageId = messageId || `${normalizedSender.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const chatEntry = {
        sender: normalizedSender,
        message: messageText,
        timestamp: timestamp,
        messageId: finalMessageId,
      };

      // Only write to MongoDB if connected
      if (mongoose.connection.readyState === 1) {
        const filter = {
          conversationId: activeConvId,
          "chat.messageId": { $ne: finalMessageId },
        };

        const update = {
          $setOnInsert: {
            conversationId: activeConvId,
            userNumber: cleanNumber,
            chatDate: timestamp,
            createdAt: timestamp,
          },
          $set: {
            updatedAt: timestamp,
          },
          $push: {
            chat: chatEntry,
          },
        };

        await Lead.updateOne(filter, update, { upsert: true });
      }

      return { conversationId: activeConvId, chatEntry };
    } catch (error) {
      // Non-blocking: log error safely without credentials and never crash application
      console.error("ConversationService logMessage error:", error.message);
      return null;
    }
  }

  /**
   * Log incoming user message
   */
  async logUserMessage({ userNumber, message, messageId = null, conversationId = null }) {
    return this.logMessage({
      userNumber,
      sender: "User",
      message,
      messageId,
      conversationId,
    });
  }

  /**
   * Log outgoing COA response message
   */
  async logCoaMessage({ userNumber, message, messageId = null, conversationId = null }) {
    return this.logMessage({
      userNumber,
      sender: "COA",
      message,
      messageId,
      conversationId,
    });
  }

  /**
   * Retrieve conversation history by conversationId
   */
  async getConversation(conversationId) {
    if (!conversationId || mongoose.connection.readyState !== 1) return null;
    try {
      return await Lead.findOne({ conversationId }).lean();
    } catch (err) {
      console.error("ConversationService getConversation error:", err.message);
      return null;
    }
  }

  /**
   * Retrieve latest conversation for user
   */
  async getLatestConversationForUser(userNumber) {
    if (!userNumber || mongoose.connection.readyState !== 1) return null;
    try {
      return await Lead.findOne({ userNumber }).sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.error("ConversationService getLatestConversationForUser error:", err.message);
      return null;
    }
  }
}

export const conversationService = new ConversationService();
export default conversationService;
