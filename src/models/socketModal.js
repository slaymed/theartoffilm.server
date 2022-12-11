import mongoose from "mongoose";

export const socketSchema = new mongoose.Schema(
    {
        socketId: { type: String, required: true, unique: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    },
    {
        timestamps: true,
    }
);

const Socket = mongoose.model("Socket", socketSchema);

export default Socket;
