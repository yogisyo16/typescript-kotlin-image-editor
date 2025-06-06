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
                const deltaMat = await computeDelta(imageToProcess16S, adjustment.value, adjustment.func);
                cv.add(imageToProcess16S, deltaMat, imageToProcess16S);
                deltaMat.delete();
            }
        }

        const finalImage = new cv.Mat();
        const finalConversionType = originalImage.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3;
        imageToProcess16S.convertTo(finalImage, finalConversionType); // Convert back to 8-bit (to make sure is converted)
        imageToProcess16S.delete();
        return finalImage;

    } catch (err) {
        console.error("An error occurred during the adjustment pipeline:", err);
        imageToProcess16S.delete();
        return originalImage.clone();
    }
}

async function computeDelta(
    image16S: cv.Mat,
    value: number,
    adjustmentFunction: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    const cleanup: cv.Mat[] = [];
    try {
        const image8U_before = new cv.Mat(); // 8-bit image
        const conversionType8U = image16S.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3; // converter 8 bit checker
        image16S.convertTo(image8U_before, conversionType8U);
        cleanup.push(image8U_before);

        // Applying the adjustment
        let image8U_after = await adjustmentFunction(image8U_before, value);
        cleanup.push(image8U_after);

        // Converter for image8U_after
        // and in this where checking for channels for image8U_after
        // is it 4 or 3 channels after the adjustment
        if (image8U_before.channels() === 4 && image8U_after.channels() === 3) {
            const tempResult = image8U_after;
            image8U_after = new cv.Mat();
            cv.cvtColor(tempResult, image8U_after, cv.COLOR_BGR2BGRA, 0);
            cleanup.push(image8U_after);
            tempResult.delete();
        }

        // empty mat for later used on subtract of deltaMat logic
        const image16S_before = new cv.Mat();
        const image16S_after = new cv.Mat();
        cleanup.push(image16S_before, image16S_after);

        const conversionType16S = image16S.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3;
        image8U_before.convertTo(image16S_before, conversionType16S);
        image8U_after.convertTo(image16S_after, conversionType16S);
        
        const deltaMat = new cv.Mat();

        // damn it, it should be ez but it's not unfortunately
        // THIS IS the delta logic for the image
        cv.subtract(image16S_after, image16S_before, deltaMat);
        
        return deltaMat;

    } catch (err) {
        console.error("Failed inside computeDelta:", (err as Error).message);
        return new cv.Mat();
    } finally {
        // This ensures all temporary Mats created inside this function are deleted.
        cleanup.forEach(mat => {
            if (mat && !mat.isDeleted()) mat.delete();
        });
    }
}


export default applyAllAdjustments;