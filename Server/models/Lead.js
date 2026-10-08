import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["User", "COA", "user", "coa"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    messageId: {
      type: String,
      index: true,
    },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userNumber: {
      type: String,
      required: true,
      index: true,
    },
    chatDate: {
      type: Date,
      default: Date.now,
    },
    chat: [chatMessageSchema],

    // Backwards-compatible legacy lead fields
    CandidateName: { type: String },
    CandidateEmail: { type: String },
    CandidatePhone: { type: String },
    CandidateRegName: { type: String },
    CandidateDOB: { type: String },
    Status: { type: String },
    Validity: { type: String },
    ConversationId: { type: String },
  },
  {
    timestamps: true,
    strict: false,
    collection: "leads",
  }
);

// Add compound indexes for query efficiency
leadSchema.index({ userNumber: 1, createdAt: -1 });
leadSchema.index({ conversationId: 1 });
leadSchema.index({ "chat.messageId": 1 });

export const Lead = mongoose.model("Lead", leadSchema, "leads");
export default Lead;
