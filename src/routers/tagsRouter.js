import express from "express";
import expressAsyncHandler from "express-async-handler";

import Artist from "../models/artistModel.js";
import Cast from "../models/castModel.js";
import Director from "../models/directorModel.js";
import { isAuth } from "../utils.js";

const tagsRouter = express.Router();

tagsRouter.get(
    "/lists",
    expressAsyncHandler(async (req, res) => {
        try {
            const casts = await Cast.find();
            const artistes = await Artist.find();
            const directors = await Director.find();

            return res.status(200).json({ casts, artistes, directors });
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

tagsRouter.post(
    "/create",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const { name, type } = req.body;

            let created;

            switch (type) {
                case "Cast":
                    created = await Cast.findOne({ name });
                    if (!created) created = new Cast({ name }).save();
                    break;
                case "Artiste":
                    created = await Artist.findOne({ name });
                    if (!created) created = new Artist({ name }).save();
                    break;
                case "Director":
                    created = await Director.findOne({ name });
                    if (!created) created = new Director({ name }).save();
                    break;
            }

            return res.status(200).json(created);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

export const syncCasts = async (casts) => {
    if (!Array.isArray(casts)) return;

    const syncedCasts = [];

    for (const castName of casts) {
        let cast = await Cast.findOne({ name: castName.toLowerCase() });
        if (!cast) cast = await new Cast({ name: castName.toLowerCase() }).save();

        syncedCasts.push(cast);
    }

    return syncedCasts;
};

export const syncDirectors = async (directors) => {
    if (!Array.isArray(directors)) return;

    const syncedDirectors = [];

    for (const directorName of directors) {
        let director = await Director.findOne({ name: directorName.toLowerCase() });
        if (!director) director = await new Director({ name: directorName.toLowerCase() }).save();

        syncedDirectors.push(director);
    }

    return syncedDirectors;
};

export const syncArtistes = async (artistes) => {
    if (!Array.isArray(artistes)) return;

    const syncedArtistes = [];

    for (const artisteName of artistes) {
        let artiste = await Artist.findOne({ name: artisteName.toLowerCase() });
        if (!artiste) artiste = await new Artist({ name: artisteName.toLowerCase() }).save();

        syncedArtistes.push(artiste);
    }

    return syncedArtistes;
};

export default tagsRouter;
