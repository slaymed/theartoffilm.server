import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
    {
        commission: { type: Number, default: 0 },
        stripe_private_key: { type: String, default: "" },
        site_logo: { type: String, default: "" },
        site_favicon: { type: String, default: "" },
        site_keywords: { type: String, default: "" },
        min_withdraw_amount: { type: Number, default: 5 },
        auto_release_orders_time: { type: Number, default: 1000 * 60 * 60 * 24 * 14 },
        commission_percentage_on_sold_posters: { type: Number, default: 6 },
        sponsor_price_for_day: { type: Number, default: 0.8 },
        banner_price_for_day: { type: Number, default: 1.25 },
        advertorial_price_for_day: { type: Number, default: 2 },
        ads_duration: { type: Number, default: 1000 * 60 * 3 },
    },
    {
        timestamps: true,
    }
);
const Setting = mongoose.model("Setting", settingSchema);

settingSchema.set("toJSON", {
    transform: (doc, setting, options) => {
        delete setting.stripe_private_key;

        return setting;
    },
});

export default Setting;
