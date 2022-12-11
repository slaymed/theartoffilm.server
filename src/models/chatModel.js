import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
    {
        seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
        messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message", required: true }],
        readBy: [{ type: String }],
    },
    {
        timestamps: true,
    }
);

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;
