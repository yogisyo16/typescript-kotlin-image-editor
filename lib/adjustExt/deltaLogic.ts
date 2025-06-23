import cv from "@techstark/opencv-js";
import { Config } from "@/lib/HonchoEditor";
import openCVAdjustments from "@/lib/openCVAdjustment"
import { logImage } from "../utills/logImageAdjustment";

export async function applyAllAdjustments(
    originalImage: cv.Mat,
    configScore: Config,
): Promise<cv.Mat> {
    try {
        // Create a 16-bit version of the original image to serve as our base.
        const newOriginalMat = new cv.Mat();
        const convert16Bit = originalImage.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3;
        originalImage.convertTo(newOriginalMat, convert16Bit);

        // Create a 16-bit accumulator, initialized to all zeros, to store the sum of all changes.
        const totalDelta = cv.Mat.zeros(originalImage.rows, originalImage.cols, convert16Bit);

        // Define the pipeline based on the incoming configScore object.
        const adjustmentPipeline = [
            { score: configScore.Exposure, func: openCVAdjustments.modifyImageExposure },
            { score: configScore.Contrast, func: openCVAdjustments.modifyImageContrast },
            { score: configScore.Highlights, func: openCVAdjustments.modifyImageHighlights },
            { score: configScore.Shadow, func: openCVAdjustments.modifyImageShadows },
            { score: configScore.Whites, func: openCVAdjustments.modifyImageWhites },
            { score: configScore.Blacks, func: openCVAdjustments.modifyImageBlacks },
            { score: configScore.Temperature, func: openCVAdjustments.modifyImageTemperature },
            { score: configScore.Tint, func: openCVAdjustments.modifyImageTint },
            { score: configScore.Vibrance, func: openCVAdjustments.modifyImageVibrance },
            { score: configScore.Saturation, func: openCVAdjustments.modifyImageSaturation },
        ];

        // Loop through each adjustment and calculate its delta.
        for (const adjustment of adjustmentPipeline) {
            if (adjustment.score !== 0) {
                // IMPORTANT: We call computeDelta with the pristine, 8-bit `originalImage`,
                // That's why not using the newOriginalMat
                // which is exactly what your existing function expects.
                const deltaMat = await computeDelta(originalImage, adjustment.score, adjustment.func);
                
                // Add this change to our running total.
                cv.add(totalDelta, deltaMat, totalDelta);
                
                deltaMat.delete();
            }
        }

        // Apply the total accumulated changes to our 16-bit base image.
        cv.add(newOriginalMat, totalDelta, newOriginalMat);
        
        // Convert the final 16-bit result back to a displayable 8-bit image.
        const finalImage = new cv.Mat();
        const conversionType8U = originalImage.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3;
        newOriginalMat.convertTo(finalImage, conversionType8U);

        return finalImage;

    } catch (err) {
        console.error("An error occurred during the adjustment pipeline:", err);
        return originalImage.clone();
    }
}

export async function computeDelta(
    originalImage: cv.Mat,
    value: number,
    action: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    try {
        // Create 16-bit versions of the original
        const originalImage16Bit = new cv.Mat();
        originalImage.convertTo(originalImage16Bit, cv.CV_16SC3);
        
        // Do the Adjustment Function
        const imageAdjusted = await action(originalImage, value);
        
        // Create 16-bit versions of the adjusted
        const imageAdjusted16Bit = new cv.Mat();
        imageAdjusted.convertTo(imageAdjusted16Bit, cv.CV_16SC3);
        
        const deltaMat = new cv.Mat();
        // Here is the function for originalImage - AdjustedImage
        cv.subtract(imageAdjusted16Bit, originalImage16Bit, deltaMat);

        // logImage(originalImage, "Original Image", value);
        // logImage(deltaMat, "Hasil delta", value);
        
        return deltaMat;
    } catch (err) {
        console.error("Failed inside computeDelta:", (err as Error).message);
        return new cv.Mat();
    }
}