import mongoose from "mongoose";

export const issueSchema = new mongoose.Schema(
    {
        order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        solved: { type: Boolean, required: true, default: false },
        becauseOf: { type: String, required: true },
        solvedAt: { type: Number, default: null },
    },
    {
        timestamps: true,
    }
);

const Issue = mongoose.model("Issue", issueSchema);

export default Issue;
