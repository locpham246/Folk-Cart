import { StoreProduct } from '../models/StoreProduct.js';
import ProductModel from '../models/Product.js';
import { Store } from '../models/Store.js';
import mongoose from 'mongoose';

export const createStoreProduct = async (req, res) => {
    try {
        const { productId, storeId, price, stock, isAvailable, recommended, discount, storeSpecificImages } = req.body;

        if (!productId || !storeId || price === undefined || stock === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required fields for StoreProduct.' });
        }
        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(storeId)) {
            return res.status(400).json({ success: false, message: 'Invalid format for Product ID or Store ID.' });
        }
        const productExists = await ProductModel.findById(productId);
        const storeExists = await Store.findById(storeId);

        if (!productExists) {
            return res.status(404).json({ success: false, message: 'Common Product not found.' });
        }
        if (!storeExists) {
            return res.status(404).json({ success: false, message: 'Store not found.' });
        }

        const newStoreProduct = new StoreProduct({
            productId,
            storeId,
            price,
            stock,
            isAvailable,
            recommended,
            discount,
            storeSpecificImages
        });

        await newStoreProduct.save();

        const populatedStoreProduct = await StoreProduct.findById(newStoreProduct._id)
            .populate('productId')
            .populate('storeId');

        res.status(201).json({ success: true, message: 'Store Product created successfully.', storeProduct: populatedStoreProduct });

    } catch (error) {
        console.error("Error creating store product:", error);
        if (error.code === 11000 && error.keyPattern && error.keyPattern.productId && error.keyPattern.storeId) {
            return res.status(409).json({ success: false, message: 'This product already exists in this store.' });
        }
        if (error.name === 'CastError') {
             return res.status(400).json({ success: false, message: 'Invalid ID format in request body.' });
        }
        res.status(500).json({ success: false, message: error.message || 'An error occurred while creating the store product.' });
    }
};

export const getStoreProducts = async (req, res) => {
    try {
        const { storeId, category, recommended, discount, search } = req.query;
        let query = {};

        console.log("--- DEBUG getStoreProducts ---");
        console.log("Received query parameters:", req.query);

        if (storeId) {
            if (!mongoose.Types.ObjectId.isValid(storeId)) {
                console.error("Invalid storeId received:", storeId);
                return res.status(400).json({ success: false, message: 'Invalid Store ID format.' });
            }
            query.storeId = new mongoose.Types.ObjectId(storeId);
            console.log("Parsed storeId for query:", query.storeId);
        } else {
            console.log("No storeId provided in query. Fetching all available store products.");
        }

        if (recommended === 'true') {
            query.recommended = true;
        }
        if (discount === 'true') {
            query.discount = true;
        }

        console.log("Initial Mongoose query object:", query);

        let aggregatePipeline = [];

        if (Object.keys(query).length > 0) {
            aggregatePipeline.push({ $match: query });
            console.log("$match after initial query:", aggregatePipeline[0]);
        }
        aggregatePipeline.push({
            $lookup: {
                from: 'products',
                localField: 'productId',
                foreignField: '_id',
                as: 'productDetails'
            }
        });
        aggregatePipeline.push({ $unwind: '$productDetails' });

        aggregatePipeline.push({
            $lookup: {
                from: 'stores',
                localField: 'storeId',
                foreignField: '_id',
                as: 'storeDetails'
            }
        });
        aggregatePipeline.push({ $unwind: '$storeDetails' });

        if (category) {
            aggregatePipeline.push({ $match: { 'productDetails.category': category } });
            console.log("$match for category added.");
        }

        if (search) {
            aggregatePipeline.push({
                $match: {
                    'productDetails.name': { $regex: search, $options: 'i' }
                }
            });
            console.log("$match for search added.");
        }


        aggregatePipeline.push({
            $project: {
                _id: 1,
                price: 1,
                stock: 1,
                isAvailable: 1,
                recommended: 1,
                discount: 1,
                storeSpecificImages: 1,
                productId: '$productDetails',
                storeId: '$storeDetails',
                createdAt: 1,
                updatedAt: 1
            }
        });

        console.log("Final Aggregation Pipeline:", JSON.stringify(aggregatePipeline, null, 2));


        const storeProducts = await StoreProduct.aggregate(aggregatePipeline);

        console.log(`Found ${storeProducts.length} store products after aggregation.`);
        if (storeProducts.length > 0) {
            console.log("Example store product (first one) after aggregation:", JSON.stringify(storeProducts[0], null, 2));
        }

        res.status(200).json({ success: true, storeProducts });
    } catch (error) {
        console.error("Error in getStoreProducts:", error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred while fetching store products.' });
    }
};

export const getStoreProductById = async (req, res) => {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid Store Product ID format.' });
    }

    try {
        const storeProduct = await StoreProduct.findById(id).populate('productId').populate('storeId');

        if (!storeProduct) {
            console.log("Cannot find Store Product with ID:", id, "in DB.");
            return res.status(404).json({ success: false, message: 'Store Product not found.' });
        }
        console.log("Found Store Product:", storeProduct._id);
        res.status(200).json({ success: true, storeProduct });
    } catch (error) {
        console.error("Error fetching store product by ID:", error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred while fetching the store product.' });
    }
};

export const updateStoreProduct = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid Store Product ID format.' });
    }
    
    try {
        const updatedStoreProduct = await StoreProduct.findByIdAndUpdate(
            id,
            req.body,
            { new: true, runValidators: true }
        )
            .populate('productId')
            .populate('storeId');

        if (!updatedStoreProduct) {
            return res.status(404).json({ success: false, message: 'Store Product not found.' });
        }
        res.status(200).json({ success: true, message: 'Store Product updated successfully.', storeProduct: updatedStoreProduct });
    } catch (error) {
        console.error("Error updating store product:", error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred while updating the store product.' });
    }
};

export const deleteStoreProduct = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid Store Product ID format.' });
    }
    
    try {
        const deletedStoreProduct = await StoreProduct.findByIdAndDelete(id);
        if (!deletedStoreProduct) {
            return res.status(404).json({ success: false, message: 'Store Product not found.' });
        }
        res.status(200).json({ success: true, message: 'Store Product deleted successfully.' });
    } catch (error) {
        console.error("Error deleting store product:", error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred while deleting the store product.' });
    }
};

export const getProductSearchSummary = async (req, res) => {
    try {
        const { category, search } = req.query;
        let pipeline = [];


        pipeline.push({ $match: { isAvailable: true } });


        pipeline.push({
            $lookup: {
                from: 'products',
                localField: 'productId',
                foreignField: '_id',
                as: 'productDetails'
            }
        });
        pipeline.push({ $unwind: '$productDetails' });

        if (category) {
            pipeline.push({ $match: { 'productDetails.category': category } });
        }
        if (search) {
            pipeline.push({
                $match: {
                    'productDetails.name': { $regex: search, $options: 'i' }
                }
            });
        }

        pipeline.push({
            $group: {
                _id: '$productId',
                name: { $first: '$productDetails.name' },
                description: { $first: '$productDetails.description' },
                images: { $first: '$productDetails.images' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
                sampleStoreProductId: { $first: '$_id' }
            }
        });

        pipeline.push({
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                images: 1,
                minPrice: 1,
                maxPrice: 1,
                sampleStoreProductId: 1
            }
        });

        const productSummaries = await StoreProduct.aggregate(pipeline);

        res.status(200).json({ success: true, productSummaries });
    } catch (error) {
        console.error("Error fetching product search summary:", error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred while fetching product search summary.' });
    }
};

export const getStoreOptionsForProduct = async (req, res) => {
    console.log("Attempting to fetch store options for productId:", req.params.productId);
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, message: 'Valid Product ID is required.' });
    }
    
    try {
        

        const storeProducts = await StoreProduct.find({ productId: productId })
            .populate('productId')
            .populate('storeId');

        if (!storeProducts || storeProducts.length === 0) {
            console.log("No store products found for product ID:", productId);
            return res.status(404).json({ success: false, message: 'No store options found for this product.' });
        }

        res.status(200).json({ success: true, storeProducts });

    } catch (error) {
        console.error("Error fetching store options for product:", error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred while fetching store options.' });
    }
};
