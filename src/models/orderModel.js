import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
    {
        orderItems: [
            {
                name: { type: String, required: true },
                qty: { type: Number, required: true },
                image: { type: String, required: true },
                price: { type: Number, required: true },
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true,
                },
            },
        ],
        shippingAddress: {
            address: { type: String, required: true },
            city: { type: String, required: true },
            postalCode: { type: String, required: true },
            country: { type: String, required: true },
            lat: Number,
            lng: Number,
        },
        paymentMethod: { type: String, required: true },
        paymentResult: {
            id: String,
            status: String,
            update_time: String,
            email_address: String,
        },
        itemsPrice: { type: Number, required: true },
        taxPrice: { type: Number, required: true },
        shippingCost: { type: Number, required: false },
        totalPrice: { type: Number, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        seller: { type: mongoose.Schema.Types.ObjectID, ref: "User", required: true },
        isPaid: { type: Boolean, default: false },
        paidAt: { type: Number, default: null },
        isDelivered: { type: Boolean, default: false },
        deliveredAt: { type: Number, default: null },
        isRecieved: { type: Boolean, default: false },
        recievedAt: { type: Number, default: null },
        issueId: { type: String, default: null },
        haveIssue: { type: Boolean, default: false },
        chatId: { type: String },
        payment_record: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentRecord" },
    },
    {
        timestamps: true,
    }
);
const Order = mongoose.model("Order", orderSchema);
export default Order;
