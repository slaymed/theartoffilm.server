import mongoose from "mongoose";

export const directorSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
    },
    {
        timestamps: true,
    }
);

const Director = mongoose.model("Director", directorSchema);

export default Director;
