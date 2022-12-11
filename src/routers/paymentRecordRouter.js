import express from "express";
import expressAsyncHandler from "express-async-handler";

import { isAuth } from "../utils.js";
import PaymentRecord from "../models/paymentRecordModal.js";

const paymentRecordRouter = express.Router();

paymentRecordRouter.get(
    "/mine",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const paid = await PaymentRecord.find({ by: req.user._id, collected: true })
                .populate("to")
                .populate("by")
                .sort({ collected_at: -1 });
            const income = await PaymentRecord.find({ to: req.user._id, collected: true })
                .populate("to")
                .populate("by")
                .sort({ collected_at: -1 });

            return res.status(200).json({ paid, income });
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

export default paymentRecordRouter;
