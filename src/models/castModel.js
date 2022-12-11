import mongoose from "mongoose";

export const castSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
    },
    {
        timestamps: true,
    }
);

const Cast = mongoose.model("Cast", castSchema);

export default Cast;
