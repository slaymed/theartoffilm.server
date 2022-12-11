import express from "express";
import expressAsyncHandler from "express-async-handler";
import { available } from "../helpers/available.js";
import Artist from "../models/artistModel.js";
import Cast from "../models/castModel.js";
import Director from "../models/directorModel.js";
import Product from "../models/productModel.js";
import { isAuth, is_subscribed } from "../utils.js";
import { syncArtistes, syncCasts, syncDirectors } from "./tagsRouter.js";

const productRouter = express.Router();

productRouter.get(
    "/list/home",
    expressAsyncHandler(async (req, res) => {
        try {
            const products = await Product.find()
                .sort({ createdAt: -1 })
                .where("forSale", true)
                .where("visible", true)
                .where("sold", false)
                .populate("seller")
                .populate("directors")
                .populate("casts")
                .populate("artists")
                .limit(6);

            const sortedList = products.sort((a, b) => a.name.localeCompare(b.name));

            return res.status(200).json(sortedList);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

productRouter.post(
    "/shop/search",
    expressAsyncHandler(async (req, res) => {
        try {
            let { query = {}, requestedPageNumber, itemsPerPage } = req.body;
            const { name, director, cast, artist, origin, format, year, condition, price, filter } = query;

            const filters = {};

            if (name) filters.name = { $regex: name, $options: "i" };
            if (director) {
                const syncedDirector = await Director.findOne({ name: { $regex: director, $options: "i" } });
                if (syncedDirector) filters.directors = { $in: syncedDirector._id };
            }
            if (cast) {
                const syncedCast = await Cast.findOne({ name: { $regex: cast, $options: "i" } });
                if (syncedCast) filters.casts = { $in: syncedCast._id };
            }
            if (artist) {
                const syncedArtist = await Artist.findOne({ name: { $regex: artist, $options: "i" } });
                if (syncedArtist) filters.artists = { $in: syncedArtist._id };
            }
            if (origin) filters.origin = { $regex: origin, $options: "i" };
            if (format) filters.format = { $regex: format, $options: "i" };
            if (year) filters.year = { $eq: parseInt(year) };
            if (condition) filters.condition = { $regex: condition, $options: "i" };
            if (price) filters.price = { $gte: Number(price.split("-")[0]), $lte: Number(price.split("-")[1]) };
            filters.sold = { $eq: filter === "sold" };

            const products = await Product.find(filters)
                .populate("seller")
                .sort({ createdAt: -1, name: 1 })
                .where("forSale", true)
                .where("visible", true);

            for (let i = 0; i < products.length; i += 1) {
                const product = products[i];
                const subscribed = await is_subscribed(product.seller);
                if (subscribed) continue;
                products.splice(i, 1);
                i -= 1;
            }

            let totalCount = products.length;
            if (totalCount === 0) return res.status(404).json({ message: "No Poster Found" });
            if (itemsPerPage > totalCount) itemsPerPage = totalCount;
            const pagesCount = Math.ceil(totalCount / itemsPerPage);
            if (requestedPageNumber > pagesCount) requestedPageNumber = pagesCount;
            const skip = itemsPerPage * (requestedPageNumber - 1);

            const resData = {
                products: products.slice(skip, itemsPerPage),
                pagesCount,
                totalCount,
                currentPage: requestedPageNumber,
            };

            return res.status(200).json(resData);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

productRouter.get(
    "/origins",
    expressAsyncHandler(async (req, res) => {
        try {
            const origins = await Product.find().distinct("origin");
            res.status(200).json(origins);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

productRouter.get(
    "/formats",
    expressAsyncHandler(async (req, res) => {
        try {
            const formats = await Product.find().distinct("format");
            res.status(200).json(formats);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);
productRouter.get(
    "/conditions",
    expressAsyncHandler(async (req, res) => {
        try {
            const conditions = await Product.find().distinct("condition");
            res.status(200).json(conditions);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

productRouter.get(
    "/rolledFoldeds",
    expressAsyncHandler(async (req, res) => {
        try {
            const rolledFoldeds = await Product.find().distinct("rolledFolded");
            res.status(200).json(rolledFoldeds);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

productRouter.get(
    "/:productId",
    expressAsyncHandler(async (req, res) => {
        try {
            const { productId } = req.params;

            const errMsg = { message: "Product Not Found" };

            if (typeof productId !== "string" || productId.length < 24) return res.status(404).json(errMsg);

            const product = await Product.findById(productId)
                .populate("seller")
                .populate("directors")
                .populate("casts")
                .populate("artists");

            if (!product) return res.status(404).json(errMsg);

            return res.json(product);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

productRouter.get(
    "/list/mine",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const products = await Product.find({ seller: req.user._id })
                .sort({ createdAt: -1 })
                .where("sold", false)
                .populate("seller")
                .populate("casts")
                .populate("artists")
                .populate("directors");

            return res.status(200).json(products);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

productRouter.post(
    "/create",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const user = req.user;
            let { price, salePrice, casts, artistes, directors, forSale, name, rolledFolded, ...rest } = req.body;

            if (typeof name !== "string" || !name.trim())
                return res.status(401).json({ message: "Name must not be empty" });

            if (rolledFolded !== "Rolled" && rolledFolded !== "Folded")
                return res.status(401).json({ message: "Please Apply Rolled or Folded" });

            if (forSale) {
                if (typeof price !== "string" || !price.trim())
                    return res.status(401).json({ message: "Price must not be empty" });

                const priceFloat = parseFloat(price);
                if (typeof priceFloat !== "number" || isNaN(priceFloat))
                    return res.status(401).json({ message: "Invalid Price" });

                price = priceFloat;
            }

            let parsedSalePrice = null;

            if (typeof salePrice === "string" && salePrice.length > 0) {
                const salePriceFloat = parseFloat(salePrice);
                if (typeof salePriceFloat === "number" && !isNaN(salePriceFloat)) parsedSalePrice = salePriceFloat;
            }

            const syncedCasts = await syncCasts(Array.from(new Set(casts)));
            const syncedArtistes = await syncArtistes(Array.from(new Set(artistes)));
            const syncedDirectors = await syncDirectors(Array.from(new Set(directors)));

            const product = new Product({
                price: price || 0,
                forSale,
                salePrice: parsedSalePrice,
                casts: syncedCasts,
                artists: syncedArtistes,
                directors: syncedDirectors,
                name,
                rolledFolded,
                seller: user,
                ...rest,
            });

            return res.status(201).json(await product.save());
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

productRouter.post(
    "/update",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const user = req.user;
            let {
                price,
                salePrice,
                name,
                image,
                images,
                marketValue,
                casts,
                origin,
                year,
                format,
                condition,
                rolledFolded,
                countInStock,
                description,
                artistes,
                directors,
                visible,
                forSale,
                productId,
            } = req.body;

            if (typeof name !== "string" || !name.trim())
                return res.status(401).json({ message: "Name must not be empty" });

            if (rolledFolded !== "Rolled" && rolledFolded !== "Folded")
                return res.status(401).json({ message: "Please Apply Rolled or Folded" });

            const product = await Product.findById(productId)
                .populate("seller")
                .populate("directors")
                .populate("casts")
                .populate("artists");

            if (!product) return res.status(404).json({ message: "Poster not found", redirect: "/posters/seller" });
            if (product.seller._id.toString() !== user._id.toString())
                return res.status(401).json({ message: "Unauthorized" });
            if (product.sold)
                return res
                    .status(401)
                    .json({ message: "Poster Already Sold", redirect: `/product/${product._id.toString()}` });

            if (forSale) {
                if (typeof price !== "string" || !price.trim())
                    return res.status(401).json({ message: "Price must not be empty" });

                const priceFloat = parseFloat(price);
                if (typeof priceFloat !== "number" || isNaN(priceFloat))
                    return res.status(401).json({ message: "Invalid Price" });

                price = priceFloat;
            }

            let parsedSalePrice = null;

            if (typeof salePrice === "string" && salePrice.length > 0) {
                const salePriceFloat = parseFloat(salePrice);
                if (typeof salePriceFloat === "number" && !isNaN(salePriceFloat)) parsedSalePrice = salePriceFloat;
            }

            const syncedCasts = await syncCasts(Array.from(new Set(casts)));
            const syncedArtistes = await syncArtistes(Array.from(new Set(artistes)));
            const syncedDirectors = await syncDirectors(Array.from(new Set(directors)));

            if (available(name)) product.name = name;
            if (available(image)) product.image = image;
            if (available(images)) product.images = images;
            if (available(marketValue)) product.marketValue = marketValue;
            if (available(origin)) product.origin = origin;
            if (available(year)) product.year = year;
            if (available(format)) product.format = format;
            if (available(condition)) product.condition = condition;
            if (available(rolledFolded)) product.rolledFolded = rolledFolded;
            if (available(countInStock)) product.countInStock = countInStock;
            if (forSale) {
                product.price = price;
                product.salePrice = parsedSalePrice;
            }
            if (!forSale) {
                product.price = 0;
                product.salePrice = null;
            }
            if (available(description)) product.description = description;
            if (available(visible)) product.visible = visible;
            if (available(forSale)) product.forSale = forSale;

            product.casts = syncedCasts;
            product.artists = syncedArtistes;
            product.directors = syncedDirectors;

            return res.status(200).json(await product.save());
        } catch (error) {}
    })
);

productRouter.post(
    "/delete",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const { productId } = req.body;

            const product = await Product.findById(productId);
            if (!product) return res.status(404).json({ message: "Poster not found, please refresh posters list" });
            if (product.seller.toString() !== req.user._id.toString())
                return res.status(401).json({ message: "Unauthorized" });
            if (product.sold) return res.status(401).json({ message: "Can't Remove Already Sold Poster" });

            await product.remove();

            return res.status(200).json({ _id: productId });
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

productRouter.get(
    "/single/:productId",
    expressAsyncHandler(async (req, res) => {
        try {
            const { productId } = req.params;

            const errMsg = { message: "Product Not Found" };

            if (typeof productId !== "string" || productId.length < 24) return res.status(404).json(errMsg);

            const product = await Product.findById(productId)
                .populate("seller")
                .populate("directors")
                .populate("casts")
                .populate("artists");

            if (!product) return res.status(404).json(errMsg);

            return res.json(product);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

productRouter.post(
    "/:id/reviews",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        if (product) {
            const productId = req.params.id;
            const product = await Product.findById(productId);

            if (product.reviews.find((x) => x.name === req.user.name)) {
                return res.status(400).json({ message: "You already submitted a review" });
            }
            const review = {
                name: req.user.name,
                rating: Number(req.body.rating),
                comment: req.body.comment,
            };
            product.reviews.push(review);
            product.numReviews = product.reviews.length;
            product.rating = product.reviews.reduce((a, c) => c.rating + a, 0) / product.reviews.length;
            const updatedProduct = await product.save();
            res.status(201).json({
                message: "Review Created",
                review: updatedProduct.reviews[updatedProduct.reviews.length - 1],
            });
        } else {
            res.status(404).json({ message: "Product Not Found" });
        }
    })
);

export default productRouter;
