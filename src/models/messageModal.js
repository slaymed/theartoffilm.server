import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        chatId: { type: String, required: true },
        body: { type: String, required: true },
        isStatus: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
