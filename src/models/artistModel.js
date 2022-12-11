import mongoose from "mongoose";

export const artistSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
    },
    {
        timestamps: true,
    }
);

const Artist = mongoose.model("Artist", artistSchema);

export default Artist;
