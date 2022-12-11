import express from "express";
import expressAsyncHandler from "express-async-handler";

import { isEmail } from "../helpers/isEmail.js";
import { isObject } from "../helpers/isObject.js";
import { sendEmail } from "../mail/sendEmail.js";
import { withdrawRequestCanceledEmail, withdrawRequestCreatedEmail } from "../mail/withdrawRequestsEmails.js";
import Setting from "../models/settingModel.js";
import User from "../models/userModel.js";
import WithdrawRequest from "../models/withdrawRequestModal.js";
import { isAuth } from "../utils.js";

const withdrawRequestsRouter = express.Router();

const mapWithdrawRequests = (requests) => {
    const pending = [];
    const paid = [];
    const rejected = [];

    for (const request of requests) {
        switch (request.status) {
            case "pending":
                pending.push(request);
                break;
            case "paid":
                paid.push(request);
                break;
            case "rejected":
                rejected.push(request);
                break;
            default:
                console.log("withdraw request status not supported");
        }
    }
    return { pending, paid, rejected };
};

withdrawRequestsRouter.post(
    "/place-withdraw-request",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const user = req.user;

            const { amount, to, bank_account = {}, paypal_account = {} } = req.body;

            const { min_withdraw_amount = 5 } = await Setting.findOne();

            if (typeof amount !== "number" || amount <= 0)
                return res.status(401).json({ amount: "Invalid Withdraw Amount" });

            if (amount < min_withdraw_amount)
                return res.status(401).json({ amount: `£${min_withdraw_amount} is the minimum allowed amount` });

            if (amount > user.availableBalance) return res.status(401).json({ amount: `Insufficient Balance` });

            if (to !== "bank_account" && to !== "paypal_account")
                return res.status(401).json({ message: "Please select a payment method" });

            const errors = {};

            if (to === "bank_account") {
                if (!isObject(bank_account)) return res.status(401).json({ message: "Invalid Bank Account" });

                const { account_name, account_number, account_sort_code } = bank_account;

                const bank_account_errors = {};

                if (typeof account_name !== "string" || account_name.length === 0)
                    bank_account_errors.account_name = "Account name not valid";
                if (typeof account_number !== "string" || account_number.length === 0)
                    bank_account_errors.account_number = "Account number not valid";
                if (typeof account_sort_code !== "string" || account_sort_code.length === 0)
                    bank_account_errors.account_sort_code = "Account sort code not valid";
                if (Object.keys(bank_account_errors).length > 0) errors.bank_account = bank_account_errors;
            }

            if (to === "paypal_account") {
                if (!isObject(paypal_account)) return res.status(401).json({ message: "Invalid Paypal Account" });

                const { email } = paypal_account;

                const paypal_account_errors = {};

                if (!isEmail(email)) paypal_account_errors.email = "Email not valid";
                if (Object.keys(paypal_account_errors).length > 0) errors.paypal_account_errors = paypal_account_errors;
            }

            if (Object.keys(errors).length > 0) return res.status(401).json(errors);

            await new WithdrawRequest({
                user: user._id,
                amount,
                to: {
                    accountType: to,
                    bank_account: to === "bank_account" ? bank_account : null,
                    paypal_account: to === "paypal_account" ? paypal_account : null,
                },
            }).save();

            user.availableBalance -= amount;
            const savedUser = await user.save();

            sendEmail(withdrawRequestCreatedEmail({ email: user.email, name: user.name, amount }));

            const myRequests = await WithdrawRequest.find({ user: req.user._id }).sort({ createdAt: -1 });

            return res.status(200).json({ requests: mapWithdrawRequests(myRequests), user: savedUser });
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

withdrawRequestsRouter.get(
    "/list/mine",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const myRequests = await WithdrawRequest.find({ user: req.user._id }).sort({ createdAt: -1 });

            const user = await User.findById(req.user._id);

            return res.status(200).json({ requests: mapWithdrawRequests(myRequests), user });
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

withdrawRequestsRouter.post(
    "/cancel-withdraw-request",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const { withdrawRequestId } = req.body;
            const user = req.user;

            const wr = await WithdrawRequest.findById(withdrawRequestId);
            if (!wr || wr.user.toString() !== user._id.toString() || wr.status !== "pending")
                return res.status(401).json({ message: "Unauthorized" });

            const amount = wr.amount;

            await wr.remove();

            user.availableBalance += amount;
            const savedUser = await user.save();

            sendEmail(withdrawRequestCanceledEmail({ email: user.email, name: user.name }));

            const myRequests = await WithdrawRequest.find({ user: user._id }).sort({ createdAt: -1 });
            return res.status(200).json({ requests: mapWithdrawRequests(myRequests), user: savedUser });
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

export default withdrawRequestsRouter;
