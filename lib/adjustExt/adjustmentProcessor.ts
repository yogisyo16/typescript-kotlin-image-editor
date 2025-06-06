// In adjustmentProcessor.ts

import cv from "@techstark/opencv-js";
import { Adjustment } from "@/lib/HonchoEditor";

// This function is now correct and does not need to change.
async function applyAllAdjustments(originalImage: cv.Mat, adjustmentPipeline: Adjustment[]): Promise<cv.Mat> {
    const imageToProcess16S = new cv.Mat();
    const conversionType = originalImage.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3;
    originalImage.convertTo(imageToProcess16S, conversionType);

    try {
        for (const adjustment of adjustmentPipeline) {
            if (adjustment.value !== 0) {
                console.log("Applying delta for:", adjustment.name);
                // Call our new, smarter computeDelta
                const deltaMat = await computeDelta(imageToProcess16S, adjustment.value, adjustment.func);
                cv.add(imageToProcess16S, deltaMat, imageToProcess16S);
                deltaMat.delete();
            }
        }

        const finalImage = new cv.Mat();
        const finalConversionType = originalImage.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3;
        imageToProcess16S.convertTo(finalImage, finalConversionType);
        imageToProcess16S.delete();
        return finalImage;

    } catch (err) {
        console.error("An error occurred during the adjustment pipeline:", err);
        imageToProcess16S.delete();
        return originalImage.clone();
    }
}


// --- THIS IS THE FULLY REWRITTEN AND CORRECTED FUNCTION ---
async function computeDelta(
    image16S: cv.Mat, // Renamed for clarity: this is a 16-bit signed Mat
    value: number,
    adjustmentFunction: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    const cleanup: cv.Mat[] = [];
    try {
        // 1. TRANSLATE a copy of the incoming 16-bit image to 8-bit, because the
        //    adjustment functions (like exposure) are designed to work on 8-bit images.
        const image8U_before = new cv.Mat();
        const conversionType8U = image16S.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3;
        image16S.convertTo(image8U_before, conversionType8U);
        cleanup.push(image8U_before);

        // 2. NOW, call the adjustment function with the 8-bit image it expects.
        //    It will return an 8-bit result.
        let image8U_after = await adjustmentFunction(image8U_before, value); // No clone needed
        cleanup.push(image8U_after);

        // This logic handles cases where the adjustment function incorrectly drops an alpha channel.
        if (image8U_before.channels() === 4 && image8U_after.channels() === 3) {
            const tempResult = image8U_after;
            image8U_after = new cv.Mat();
            cv.cvtColor(tempResult, image8U_after, cv.COLOR_BGR2BGRA, 0);
            cleanup.push(image8U_after); // Add the *new* mat to cleanup
            tempResult.delete();
        }

        // 3. To calculate the delta accurately, we need both the "before" and "after"
        //    images in the high-precision 16-bit signed format.
        const image16S_before = new cv.Mat();
        const image16S_after = new cv.Mat();
        cleanup.push(image16S_before, image16S_after);

        const conversionType16S = image16S.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3;
        image8U_before.convertTo(image16S_before, conversionType16S);
        image8U_after.convertTo(image16S_after, conversionType16S);
        
        // 4. Now we can safely subtract to get the final delta.
        const deltaMat = new cv.Mat();
        cv.subtract(image16S_after, image16S_before, deltaMat);
        
        return deltaMat;

    } catch (err) {
        console.error("Failed inside computeDelta:", (err as Error).message);
        return new cv.Mat(); // Return an empty Mat on failure
    } finally {
        // This ensures all temporary Mats created inside this function are deleted.
        cleanup.forEach(mat => {
            if (mat && !mat.isDeleted()) mat.delete();
        });
    }
}


export default applyAllAdjustments;