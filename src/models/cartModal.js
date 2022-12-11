import mongoose from "mongoose";

export const defaultShippingAddress = {
    address: "",
    city: "",
    postalCode: "",
    country: "",
    code: "",
};

const cartSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
        items: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }],
        shippingAddress: {
            type: Object,
            default: defaultShippingAddress,
        },
        paymentMethod: { type: String, required: true, default: "Stripe" },
        itemsPrice: { type: Number, required: true, default: 0 },
        totalPrice: { type: Number, required: true, default: 0 },
        currentSellerId: { type: String, default: null },
        lastPosterType: { type: String },
    },
    {
        timestamps: true,
    }
);

cartSchema.set("toJSON", {
    transform: (doc, cart, options) => {
        delete cart.user;
        delete cart.currentSellerId;
        delete cart.lastPosterType;

        return cart;
    },
});

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;
