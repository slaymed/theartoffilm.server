import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        comment: { type: String, required: true },
        rating: { type: Number, required: true },
    },
    {
        timestamps: true,
    }
);

const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        seller: { type: mongoose.Schema.Types.ObjectID, ref: "User", required: true },
        image: { type: String, required: false },
        images: [String],
        directors: [{ type: mongoose.Schema.Types.ObjectID, ref: "Director" }],
        casts: [{ type: mongoose.Schema.Types.ObjectID, ref: "Cast" }],
        artists: [{ type: mongoose.Schema.Types.ObjectID, ref: "Artist" }],
        origin: { type: String },
        year: { type: Number },
        format: { type: String },
        condition: { type: String },
        rolledFolded: { type: String },
        countInStock: { type: Number },
        price: { type: Number },
        marketValue: { type: Number },
        salePrice: { type: Number, default: null },
        description: { type: String },
        rating: { type: Number },
        numReviews: { type: Number },
        visible: { type: Boolean },
        forSale: { type: Boolean },
        sold: { type: Boolean, default: false },
        reviews: [reviewSchema],
    },
    {
        timestamps: true,
    }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
