import express from "express";
import expressAsyncHandler from "express-async-handler";

import getSettings from "../helpers/getSettings.js";

const settingsRouter = express.Router();

settingsRouter.get(
    "/website-settings",
    expressAsyncHandler(async (_, res) => {
        try {
            return res.status(200).json(await getSettings());
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

export default settingsRouter;
