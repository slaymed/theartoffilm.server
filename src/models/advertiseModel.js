import mongoose from "mongoose";

const advertiseSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            enum: ["banner", "sponsor", "advertorial"],
        },
        title: { type: String, required: true },
        link: { type: String, required: true },
        image: { type: String, required: true },
        paragraphs: { type: Array, default: [] },
        images: { type: Array, default: [] },
        active: { type: Boolean, default: false },
        activated_at: { type: Number, default: null },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        private_key: { type: String, required: true, unique: true },
        period_time: { type: Number, required: true },
        payment_record: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentRecord" },
        approved: { type: Boolean, default: true },
        show_until: { type: Number, default: null },
        inQueue: { type: Boolean, default: true },
        visible: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);
const Advertise = mongoose.model("Advertise", advertiseSchema);

advertiseSchema.set("toJSON", {
    transform: (doc, advertise, options) => {
        delete advertise.show_until;
        delete advertise.inQueue;
        delete advertise.visible;

        if (advertise.type !== "advertorial") {
            delete advertise.paragraphs;
            delete advertise.images;
        }

        return advertise;
    },
});

export default Advertise;
