import express from "express";
import expressAsyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import cookie from "cookie";

import User from "../models/userModel.js";
import { generateToken, isAuth } from "../utils.js";
import crypto from "crypto";
import Cart from "../models/cartModal.js";
import Socket from "../models/socketModal.js";
import { passwordResetEmail } from "../mail/passwordResetEmail.js";
import get_or_create_user_stripe_info from "../helpers/get_or_create_user_stripe_info.js";
import { sendEmail } from "../mail/sendEmail.js";
import { isEmail } from "../helpers/isEmail.js";
import hasErrors from "../helpers/has-errors.js";

const userRouter = express.Router();

userRouter.get(
    "/authenticated",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            return res.status(200).json(req.user);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

userRouter.post(
    "/register-socket",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const { socketId } = req.body;

            const found = await Socket.findOne({ socketId });
            if (!found) await new Socket({ socketId: req.body.socketId, user: req.user._id }).save();
            return res.status(200).json("done");
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

userRouter.post(
    "/signin",
    expressAsyncHandler(async (req, res) => {
        try {
            const user = await User.findOne({ email: req.body.email });
            if (!user || !bcrypt.compare(req.body.password, user.password))
                res.status(401).json({ message: "Invalid email or password" });

            const token = generateToken(user._id.toString());

            res.set(
                "Set-Cookie",
                cookie.serialize("access_token", token, {
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "none",
                    maxAge: 60 * 60 * 24 * 30,
                    path: "/",
                })
            );

            if (req.body.socketId) {
                const found = await Socket.findOne({ socketId: req.body.socketId });
                if (!found) await new Socket({ socketId: req.body.socketId, user: user._id }).save();
            }

            return res.status(200).json(user);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

userRouter.post(
    "/signout",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            res.set(
                "Set-Cookie",
                cookie.serialize("access_token", "", {
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "none",
                    expires: new Date(0),
                    path: "/",
                })
            );

            if (req.body.socketId) {
                const socket = await Socket.findOne({ socketId: req.body.socketId });
                if (socket) await socket.remove();
            }

            return res.status(200).json(null);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

userRouter.post(
    "/update",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const {
                name,
                sellerName,
                logo,
                description,
                address,
                city,
                country,
                code,
                postalCode,
                rolled_folded_shipping_cost,
            } = req.body;

            const user = await User.findById(req.user._id);

            if (name && user.name !== name) user.name = name;
            if (sellerName && user.sellerName !== sellerName) user.sellerName = sellerName;
            if (logo && user.logo !== logo) user.logo = logo;
            if (description && user.description !== description) user.description = description;
            if (address && user.address !== address) user.address = address;
            if (city && user.city !== city) user.city = city;
            if (country && user.country !== country) user.country = country;
            if (code && user.code !== code) user.code = code;
            if (postalCode && user.postalCode !== postalCode) user.postalCode = postalCode;
            if (rolled_folded_shipping_cost && user.rolled_folded_shipping_cost !== rolled_folded_shipping_cost)
                user.rolled_folded_shipping_cost = rolled_folded_shipping_cost;

            return res.status(200).json(await user.save());
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

userRouter.post(
    "/register",
    expressAsyncHandler(async (req, res) => {
        try {
            const { email, password, sellerName, name, socketId } = req.body;

            const errors = {};

            if (!isEmail(email)) errors.email = "Must be Valid Email address";
            if (typeof password !== "string" || password.length < 6) errors.password = "Must be at least 6 char long";
            if (typeof name !== "string" || !name.trim()) errors.name = "Must not be empty";
            if (typeof sellerName !== "string" || !sellerName.trim()) errors.sellerName = "Must not be empty";

            if (hasErrors(errors)) return res.status(401).json(errors);

            const userFound = await User.findOne({ email: email });
            if (userFound) return res.status(401).json({ message: "Email Already Taken" });

            const user = new User({
                name,
                email,
                password: bcrypt.hashSync(password, 8),
                sellerName: sellerName.toLowerCase(),
            });

            const userStripeInfo = await get_or_create_user_stripe_info(user);
            if (!userStripeInfo) throw new Error("Something went wrong");

            const cart = new Cart({
                items: [],
                user: user._id,
            });

            await cart.save();

            user.cart = cart._id;
            await user.save();

            const createdUser = await user.save();

            const token = generateToken(createdUser._id.toString());

            res.set(
                "Set-Cookie",
                cookie.serialize("access_token", token, {
                    sameSite: "none",
                    secure: process.env.NODE_ENV === "production",
                    maxAge: 60 * 60 * 24 * 30,
                    path: "/",
                })
            );

            if (socketId) {
                const found = await Socket.findOne({ socketId: socketId });
                if (!found) await new Socket({ socketId: socketId, user: user._id }).save();
            }

            return res.status(200).json(createdUser);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

// reset password route
userRouter.post(
    "/reset-password",
    expressAsyncHandler(async (req, res) => {
        try {
            const user = await User.findOne({ email: req.body.email });
            if (!user) return res.status(200).json({ message: "Check your email for the link to reset your password" });

            const token = crypto.randomBytes(20).toString("hex");
            user.resetPasswordToken = token;
            user.resetPasswordExpires = new Date().getTime() + 3600000; // 1 hour
            await user.save();

            const onSuccess = () => res.json({ message: "Check your email for the link to reset your password" });
            const onError = () => res.status(500).json({ message: "Error in sending email" });
            sendEmail(passwordResetEmail({ email: user.email, token }), onSuccess, onError);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

// complete password reset route
userRouter.post(
    "/reset-password/:token",
    expressAsyncHandler(async (req, res) => {
        try {
            const user = await User.findOne({
                resetPasswordToken: req.params.token,
                resetPasswordExpires: { $gt: new Date().getTime() },
            });
            if (!user) return res.status(401).json({ message: "Password reset token is invalid or has been expired." });

            user.password = bcrypt.hashSync(req.body.password, 8);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            const updatedUser = await user.save();

            return res.status(200).json({
                ...updatedUser,
                token: generateToken(updatedUser),
                message: "Password reset successfully",
            });
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

export default userRouter;
