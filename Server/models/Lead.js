import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    chat: {
      type: [mongoose.Schema.Types.Mixed],
      default: () => [],
    },
    chatDate: {
      type: Date,
      default: Date.now,
    },
    userNumber: {
      type: String,
      required: true,
      index: true,
    },

    // Backwards-compatible legacy lead fields
    email: { type: String },
    CandidateName: { type: String },
    CandidateEmail: { type: String },
    CandidatePhone: { type: String },
    CandidateRegName: { type: String },
    CandidateDOB: { type: String },
    Status: { type: String },
    Validity: { type: String },
    conversationId: { type: String },
    ConversationId: { type: String },
  },
  {
    timestamps: false,
    versionKey: false,
    strict: false,
    collection: "leads",
  }
);

leadSchema.index({ userNumber: 1, chatDate: -1 });

// Partial unique indexes: only enforce uniqueness when value is a non-empty string.
// Documents without email or conversationId (or with null/empty values) will never collide!
leadSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string", $gt: "" } },
    name: "email_1_partial",
  }
);

leadSchema.index(
  { conversationId: 1 },
  {
    unique: true,
    partialFilterExpression: { conversationId: { $type: "string", $gt: "" } },
    name: "conversationId_1_partial",
  }
);

export const Lead = mongoose.model("Lead", leadSchema, "leads");
export default Lead;
