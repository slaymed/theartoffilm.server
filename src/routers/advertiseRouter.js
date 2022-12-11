import express from "express";
import expressAsyncHandler from "express-async-handler";

import Advertise from "../models/advertiseModel.js";
import Session from "../models/sessionModel.js";
import { getUser } from "../utils.js";
import getStripe from "../helpers/get-stripe.js";
import getSettings from "../helpers/getSettings.js";
import hasErrors from "../helpers/has-errors.js";
import voucher from "voucher-code-generator";
import get_or_create_stripe_customer from "../helpers/get-or-create-stripe-customer.js";
import PaymentRecord from "../models/paymentRecordModal.js";
import mapAdvertisement from "../helpers/map-advertisement.js";
import shuffleArray from "../helpers/randomize.js";
import { toFixed } from "../helpers/toFixed.js";

const advertiseRouter = express.Router();

advertiseRouter.get(
    "/all-advertisements",
    expressAsyncHandler(async (req, res) => {
        try {
            const advertisements = await Advertise.find({ active: true });
            const user = await getUser(req.cookies.access_token);

            const now_time = new Date().getTime();
            const active = [];

            for (const ad of advertisements) {
                if (now_time < ad.activated_at + ad.period_time) {
                    active.push(mapAdvertisement(ad, user));
                    continue;
                }

                ad.active = true;
                await ad.save();
            }

            return res.status(200).json(active);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

advertiseRouter.get(
    "/home-page-banner",
    expressAsyncHandler(async (req, res) => {
        try {
            const banners = await Advertise.find({ type: "banner", active: true });
            if (banners.length === 0) return res.status(200).json(null);
            if (banners.length === 1) return res.status(200).json(banners[0]);

            const now_time = new Date().getTime();

            const currentBanner = await Advertise.findOne({
                visible: true,
                inQueue: false,
                type: "banner",
                active: true,
            });

            if (currentBanner) {
                if (now_time < currentBanner.show_until) return res.status(200).json(currentBanner);

                currentBanner.visible = false;
                currentBanner.show_until = null;
                await currentBanner.save();
            }

            const { ads_duration } = await getSettings();
            const show_until = now_time + ads_duration;

            const bannersInQueue = await Advertise.find({
                type: "banner",
                inQueue: true,
                active: true,
            });

            if (bannersInQueue.length === 0) {
                for (const banner of banners) {
                    banner.visible = false;
                    banner.show_until = null;
                    banner.inQueue = true;
                    await banner.save();
                }

                const random_banner = banners[Math.floor(Math.random() * banners.length)];
                random_banner.visible = true;
                random_banner.inQueue = false;
                random_banner.show_until = show_until;
                await random_banner.save();

                return res.status(200).json(random_banner);
            }

            const random_banner = bannersInQueue[Math.floor(Math.random() * bannersInQueue.length)];
            random_banner.visible = true;
            random_banner.inQueue = false;
            random_banner.show_until = show_until;
            await random_banner.save();

            return res.status(200).json(random_banner);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

advertiseRouter.get(
    "/visible-sponsored-links",
    expressAsyncHandler(async (req, res) => {
        try {
            const advertorailsCount = await Advertise.find({ type: "advertorial" }).count();
            const max_size = advertorailsCount > 0 ? 2 : 3;

            const links = await Advertise.find({ type: "sponsor", active: true });
            if (links.length <= max_size) return res.status(200).json(links);

            const now_time = new Date().getTime();

            let currentVisibleLinks = await Advertise.find({
                type: "sponsor",
                active: true,
                visible: true,
                inQueue: false,
            });

            if (currentVisibleLinks.length > 0) {
                for (const link of currentVisibleLinks) {
                    if (link.show_until < now_time) {
                        link.visible = false;
                        link.show_until = null;
                        await link.save();
                    }
                }

                currentVisibleLinks = await Advertise.find({
                    type: "sponsor",
                    active: true,
                    visible: true,
                    inQueue: false,
                });

                if (currentVisibleLinks.length > 0) return res.status(200).json(shuffleArray(currentVisibleLinks));
            }

            const { ads_duration } = await getSettings();
            const show_until = now_time + ads_duration;

            const linksInQueue = await Advertise.find({
                type: "sponsor",
                inQueue: true,
                active: true,
            });

            if (linksInQueue.length === 0) {
                for (const link of links) {
                    link.visible = false;
                    link.show_until = null;
                    link.inQueue = true;
                    await link.save();
                }

                const clone = Array.from(links);
                const collected_links = [];

                for (let i = 0; i < max_size; i += 1) {
                    const random_link_index = Math.floor(Math.random() * clone.length);
                    const random_link = clone[random_link_index];
                    if (random_link) {
                        random_link.visible = true;
                        random_link.inQueue = false;
                        random_link.show_until = show_until;
                        await random_link.save();
                        clone.splice(random_link_index, 1);
                        collected_links.push(random_link);
                    }
                }

                return res.status(200).json(collected_links);
            }

            if (linksInQueue.length < max_size) {
                const watchedLinks = await Advertise.find({ type: "sponsor", inQueue: false });

                for (let i = 0; i < max_size - linksInQueue.length; i += 1) {
                    const random_link = watchedLinks[Math.floor(Math.random() * watchedLinks.length)];
                    random_link.visible = false;
                    random_link.inQueue = true;
                    random_link.show_until = null;
                    await random_link.save();
                    linksInQueue.push(random_link);
                }
            }

            const clone = [...linksInQueue];
            const collected_links = [];

            for (let i = 0; i < max_size; i += 1) {
                const random_link_index = Math.floor(Math.random() * clone.length);
                const random_link = clone[random_link_index];
                if (random_link) {
                    random_link.visible = true;
                    random_link.inQueue = false;
                    random_link.show_until = show_until;
                    await random_link.save();
                    clone.splice(random_link_index, 1);
                    collected_links.push(random_link);
                }
            }

            return res.status(200).json(collected_links);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

advertiseRouter.get(
    "/visible-advertorials",
    expressAsyncHandler(async (req, res) => {
        try {
            const sponsoredLinksCount = await Advertise.find({ type: "sponsor" }).count();
            const max_size = sponsoredLinksCount > 0 ? (sponsoredLinksCount === 1 ? 2 : 1) : 3;

            const advertorials = await Advertise.find({ type: "advertorial", active: true });
            if (advertorials.length <= max_size) return res.status(200).json(advertorials);

            const now_time = new Date().getTime();

            let currentVisibleAdvertorials = await Advertise.find({
                type: "advertorial",
                active: true,
                visible: true,
                inQueue: false,
            });

            if (currentVisibleAdvertorials.length > 0) {
                for (const advertorial of currentVisibleAdvertorials) {
                    if (advertorial.show_until < now_time) {
                        advertorial.visible = false;
                        advertorial.show_until = null;
                        await advertorial.save();
                    }
                }

                currentVisibleAdvertorials = await Advertise.find({
                    type: "advertorial",
                    active: true,
                    visible: true,
                    inQueue: false,
                });
                if (currentVisibleAdvertorials.length > 0)
                    return res.status(200).json(shuffleArray(currentVisibleAdvertorials));
            }

            const { ads_duration } = await getSettings();
            const show_until = now_time + ads_duration;

            const advertorialsInQueue = await Advertise.find({
                type: "advertorial",
                inQueue: true,
                active: true,
            });

            if (advertorialsInQueue.length === 0) {
                for (const advertorial of advertorials) {
                    advertorial.visible = false;
                    advertorial.show_until = null;
                    advertorial.inQueue = true;
                    await advertorial.save();
                }

                const clone = Array.from(advertorials);
                const collected_advertorials = [];

                for (let i = 0; i < max_size; i += 1) {
                    const random_advertorial_index = Math.floor(Math.random() * clone.length);
                    const random_advertorial = clone[random_advertorial_index];
                    if (random_advertorial) {
                        random_advertorial.visible = true;
                        random_advertorial.inQueue = false;
                        random_advertorial.show_until = show_until;
                        await random_advertorial.save();
                        clone.splice(random_advertorial_index, 1);
                        collected_advertorials.push(random_advertorial);
                    }
                }

                return res.status(200).json(collected_advertorials);
            }

            if (advertorialsInQueue.length < max_size) {
                const watchedAdvertorials = await Advertise.find({ type: "advertorial", inQueue: false });

                for (let i = 0; i < max_size - advertorialsInQueue.length; i += 1) {
                    const random_advertorial =
                        watchedAdvertorials[Math.floor(Math.random() * watchedAdvertorials.length)];
                    random_advertorial.visible = false;
                    random_advertorial.inQueue = true;
                    random_advertorial.show_until = null;
                    await random_advertorial.save();
                    advertorialsInQueue.push(random_advertorial);
                }
            }

            const clone = [...advertorialsInQueue];
            const collected_advertorials = [];

            for (let i = 0; i < max_size; i += 1) {
                const random_advertorial_index = Math.floor(Math.random() * clone.length);
                const random_advertorial = clone[random_advertorial_index];
                if (random_advertorial) {
                    random_advertorial.visible = true;
                    random_advertorial.inQueue = false;
                    random_advertorial.show_until = show_until;
                    await random_advertorial.save();
                    clone.splice(random_advertorial_index, 1);
                    collected_advertorials.push(random_advertorial);
                }
            }

            return res.status(200).json(collected_advertorials);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

advertiseRouter.get(
    "/advertisement/:advertisementId",
    expressAsyncHandler(async (req, res) => {
        try {
            const { advertisementId } = req.params;

            if (typeof advertisementId !== "string" || advertisementId.length !== 24)
                return res.status(401).json({ message: "Invalid Advertisement Id" });

            const advertisement = await Advertise.findById(advertisementId);
            if (!advertisement) return res.status(404).json({ message: "Advertisement not found" });

            const user = await getUser(req.cookies.access_token);

            return res.status(200).json(mapAdvertisement(advertisement, user));
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

advertiseRouter.post(
    "/update-advertise",
    expressAsyncHandler(async (req, res) => {
        try {
            let { title, image, type, link, paragraphs, images, private_key, advertisementId } = req.body;

            const advertisement = await Advertise.findById(advertisementId);
            if (!advertisement) return res.status(404).json({ message: "Advertisement not found" });

            if (type !== "sponsor" && type !== "banner" && type !== "advertorial")
                return res.status(401).json({ message: "Advertisement type not supported" });

            const errors = {};

            if (typeof title !== "string" || !title.trim()) errors.title = "Must not be empty";
            if (typeof image !== "string" || !image.trim()) errors.image = "Image Must not be empty";
            if (typeof link !== "string" || !link.trim()) errors.link = "Must not be empty";

            if (hasErrors(errors)) return res.status(401).json(errors);

            if (!Array.isArray(paragraphs)) paragraphs = [];
            if (!Array.isArray(images)) images = [];

            if (advertisement.private_key !== private_key)
                return res.status(401).json({ message: "Invalid Private Key" });

            advertisement.title = title;
            advertisement.link = link;
            advertisement.image = image;
            advertisement.paragraphs = paragraphs;
            advertisement.images = images;

            const savedAdvertisement = await advertisement.save();
            const user = await getUser(req.cookies.access_token);

            return res.status(200).json(mapAdvertisement(savedAdvertisement, user));
        } catch (error) {
            console.log(error);

            return res.status(500).json(error);
        }
    })
);

advertiseRouter.post(
    "/create-advertise",
    expressAsyncHandler(async (req, res) => {
        try {
            let { title, image, type, link, paragraphs, images, period_days } = req.body;
            if (type !== "sponsor" && type !== "banner" && type !== "advertorial")
                return res.status(401).json({ message: "Advertisement type not supported" });

            const errors = {};

            if (typeof title !== "string" || !title.trim()) errors.title = "Must not be empty";
            if (typeof image !== "string" || !image.trim()) errors.image = "Image Must not be empty";
            if (typeof link !== "string" || !link.trim()) errors.link = "Must not be empty";
            if (typeof period_days !== "string" || !period_days.trim()) errors.period_days = "Must not be empty";

            let days = parseInt(period_days);

            if (isNaN(days)) errors.period_days = "Must be a valid period days";
            if (type === "advertorial" && days < 60) errors.period_days = "Must be at least a period of 60 days";
            if (type !== "advertorial" && days < 30) errors.period_days = "Must be at least a period of 30 days";

            if (hasErrors(errors)) return res.status(401).json(errors);

            if (!Array.isArray(paragraphs)) paragraphs = [];
            if (!Array.isArray(images)) images = [];

            const user = await getUser(req.cookies.access_token);

            const codes = voucher.generate({ length: 16, count: 5 });

            const day_time = 1000 * 60 * 60 * 24;

            const advertise = await Advertise.create({
                user: user || null,
                title,
                image,
                type,
                link,
                paragraphs,
                images,
                period_time: day_time * days,
                private_key: codes.join("_"),
            });

            return res.status(200).json(await advertise.save());
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

advertiseRouter.post(
    "/create-checkout-session",
    expressAsyncHandler(async (req, res) => {
        try {
            const { advertiseId, socketId } = req.body;

            const advertise = await Advertise.findById(advertiseId);
            if (!advertise) return res.status(404).json({ message: "Advertise Not Found, Please Try Again" });
            if (advertise.active) return res.status(401).json({ message: "Advertise Already Has Been Activated" });

            const user = await getUser(req.cookies.access_token);

            const { banner_price_for_day, sponsor_price_for_day, advertorial_price_for_day } = await getSettings();
            let price_for_day = 0;

            switch (advertise.type) {
                case "sponsor":
                    price_for_day = sponsor_price_for_day;
                    break;
                case "banner":
                    price_for_day = banner_price_for_day;
                    break;
                case "advertorial":
                    price_for_day = advertorial_price_for_day;
                    break;
            }

            const day_time = 1000 * 60 * 60 * 24;
            const days = advertise.period_time / day_time;
            const totalPrice = toFixed(days >= 365 ? price_for_day * (days - 60) : days * price_for_day);

            const stripe = await getStripe();

            const customer = user ? await get_or_create_stripe_customer(user) : undefined;

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: "gbp",
                            product_data: {
                                name: advertise.title,
                            },
                            unit_amount: Math.round(totalPrice * 100),
                        },
                        quantity: 1,
                    },
                ],
                metadata: {
                    ref: advertise._id.toString(),
                    socketId,
                },
                payment_intent_data: {
                    metadata: {
                        ref: advertise._id.toString(),
                        socketId,
                    },
                },
                customer: customer && !customer.deleted ? customer.id : undefined,
                mode: "payment",
                success_url: `${process.env.WEB_APP}/payment/success`,
                cancel_url: `${process.env.WEB_APP}/payment/canceled`,
            });

            await Session.deleteMany({ ref: advertise._id, status: "unpaid" });
            const new_session = new Session({
                id: session.id.toString(),
                url: session.url,
                type: "advertisement",
                ref: advertise._id.toString(),
                status: session.payment_status,
                user: user || null,
            });

            await PaymentRecord.deleteMany({ ref: advertise._id.toString(), status: "pending", collected: false });
            const advertisePayment = await new PaymentRecord({
                by: user ? user : undefined,
                total_collected_amount: totalPrice,
                commission_percentage: 0,
                total_commission_fee: 0,
                total_release_amount_after_fee: totalPrice,
                session: new_session._id,
                type: "advertise",
                ref: advertise._id.toString(),
            }).save();

            advertise.payment_record = advertisePayment._id;
            await advertise.save();
            new_session.payment_record = advertisePayment._id;

            return res.status(200).json(await new_session.save());
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

export default advertiseRouter;
