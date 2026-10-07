import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
        index: true
    },
    password: {
        type: String,
        required: true
    },
    security: {
        question: {
            type: String
        },
        answer: {
            type: String
        }
    },
    refreshTokenVersion: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

export default mongoose.model("Admin", adminSchema);
