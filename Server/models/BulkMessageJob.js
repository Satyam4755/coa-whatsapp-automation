import mongoose from "mongoose";

const BulkMessageJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageTemplate', required: true },
  totalRecipients: { type: Number, required: true },
  processedRecipients: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'paused'], 
    default: 'pending' 
  },
  recipients: [{
    architect: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'success', 'failed'], 
      default: 'pending' 
    },
    error: String,
    sentAt: Date,
    phone: String
  }],
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: Date,
  lastProcessedIndex: { type: Number, default: 0 },
  error: String // For job-level errors
});

// Add indexes for better query performance
BulkMessageJobSchema.index({ status: 1, createdAt: 1 });
BulkMessageJobSchema.index({ jobId: 1 });

export default mongoose.model('BulkMessageJob', BulkMessageJobSchema);
