import Stripe from "stripe";

import Setting from "../models/settingModel.js";

const getStripe = async () => {
    const { stripe_private_key } = await Setting.findOne();
    return new Stripe(stripe_private_key);
};

export default getStripe;
