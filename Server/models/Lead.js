import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
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

    // Backwards-compatible legacy lead fields (if present in existing leads collection)
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
    timestamps: false,
    versionKey: false,
    strict: false,
    collection: "leads",
  }
);

leadSchema.index({ userNumber: 1, chatDate: -1 });

export const Lead = mongoose.model("Lead", leadSchema, "leads");
export default Lead;
