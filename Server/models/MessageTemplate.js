import mongoose from "mongoose";

const componentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // HEADER, BODY, FOOTER, BUTTONS
    format: { type: String }, // For HEADER: TEXT, IMAGE, VIDEO, DOCUMENT
    text: { type: String }, // For HEADER/BODY/FOOTER
    example: { type: mongoose.Schema.Types.Mixed }, // Example values for variables
    buttons: [
      {
        type: { type: String }, // QUICK_REPLY, URL, PHONE_NUMBER, OTP, etc.
        text: { type: String },
        phone_number: { type: String },
        url: { type: String },
        payload: { type: String },
        otp_type: { type: String },
      },
    ],
    parameters: { type: [mongoose.Schema.Types.Mixed] }, // For sending messages
  },
  { _id: false }
);

const messageTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 512 }, // WhatsApp template name
    category: {
      type: String,
      enum: ["AUTHENTICATION", "MARKETING", "UTILITY"],
      required: true,
    },
    language: { type: String, required: true }, // e.g., en_US
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "MISSING_ON_META"],
      default: "PENDING",
    },
    rejection_reason: { type: String },
    components: [componentSchema],
    message_send_ttl_seconds: { type: Number }, // Optional TTL
    wa_template_id: { type: String },
    // For legacy support
    templateName: { type: String },
    message: { type: String },
    attachmentStatus: { type: Boolean, default: false },
    attachment: {
      public_id: { type: String },
      secure_url: { type: String },
    },
    variableMap: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.model("MessageTemplate", messageTemplateSchema);
