import { isObject } from "./isObject.js";
import { toFixed } from "./toFixed.js";

export const mapGiftSub = (giftSub) => {
    if (!isObject(giftSub)) return {};

    const day_time = 1000 * 60 * 60 * 24;

    const now_time = new Date().getTime();
    const used_time = now_time - giftSub.start_date;
    const rest_time = giftSub.cancel_at - now_time;

    const period_days = Math.round(giftSub.period_time / day_time);
    const used_days = Math.floor(used_time / day_time);
    const rest_days = Math.ceil(rest_time / day_time);

    const progress_percentage = toFixed((used_time * 100) / giftSub.period_time);

    const mappedGiftSub = {
        user: giftSub.user,
        start_date: giftSub.start_date,
        cancel_at: giftSub.cancel_at,
        gift: giftSub.gift,
        targeted_sub: giftSub.targeted_sub,
        period: giftSub.period,
        period_time: giftSub.period_time,
        active: giftSub.active,
        progress_percentage,
        period_days,
        used_days,
        rest_days,
    };

    return { giftSub: mappedGiftSub };
};
