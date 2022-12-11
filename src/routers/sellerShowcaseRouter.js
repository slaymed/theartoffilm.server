import express from "express";
import expressAsyncHandler from "express-async-handler";

import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import { getUser, is_subscribed } from "../utils.js";

const sellerShowcaseRouter = express.Router();

sellerShowcaseRouter.get(
    "/seller/:sellerId",
    expressAsyncHandler(async (req, res) => {
        try {
            const { sellerId } = req.params;

            const seller = await User.findById(sellerId);
            if (!seller) return res.status(404).json({ message: "Showcase not found" });
            const subscribed = await is_subscribed(seller);

            const user = await getUser(req.cookies.access_token);

            if (!subscribed) {
                if (user && sellerId === user._id.toString())
                    return res.status(401).json({
                        message: "Require Subscription, please subscribe so you can see your showcase",
                        redirect: "/page/subscriptions",
                    });

                return res.status(404).json({ message: "Showcase not found" });
            }

            const products = await Product.find({ seller: seller._id, visible: true })
                .populate("seller")
                .populate("directors")
                .populate("casts")
                .populate("artists");

            if (products.length === 0) {
                if (sellerId === user._id.toString())
                    return res.status(401).json({
                        message: "Your showcase is empty, Wanna Create Posters?",
                        redirect: "/posters/create",
                    });

                return res.status(404).json({
                    message: "Showcase not found",
                });
            }

            return res.status(200).json({ seller, products });
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

sellerShowcaseRouter.get(
    "/list/top",
    expressAsyncHandler(async (_, res) => {
        try {
            const topSellers = await User.find().sort({ rating: -1 });

            const showcaseList = [];

            for (const seller of topSellers) {
                const subscribed = await is_subscribed(seller);
                const count = await Product.find({ seller: seller._id, visible: true }).count();
                if (subscribed && count > 0) showcaseList.push({ seller });
                if (showcaseList.length === 3) break;
            }

            return res.status(200).json(showcaseList);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

sellerShowcaseRouter.get(
    "/list",
    expressAsyncHandler(async (_, res) => {
        try {
            const sellers = await User.find().sort({ sellerName: 1 });

            const showcaseList = [];

            for (const seller of sellers) {
                const subscribed = await is_subscribed(seller);
                const count = await Product.find({ seller: seller._id, visible: true }).count();
                if (subscribed && count > 0) showcaseList.push({ seller });
            }

            return res.status(200).json(showcaseList);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

export default sellerShowcaseRouter;
