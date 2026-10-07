import mongoose from "mongoose";

const candidateDetailsSchema = new mongoose.Schema({
    CandidateName: {
        type: String,
        required: true
    },
    CandidateEmail: {
        type: String,
        required: true
    },
    CandidatePhone: {
        type: String,
        required: true
    },
    CandidateRegName: {
        type: String,
        required: true
    },
    CandidateDOB: {
        type: String,
        required: true
    },
    Status: {
        type: String,
        required: true
    },
    Validity: {
        type: String,
        required: true
    },
    ConversationId: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

export default mongoose.model("CandidateDetails", candidateDetailsSchema);