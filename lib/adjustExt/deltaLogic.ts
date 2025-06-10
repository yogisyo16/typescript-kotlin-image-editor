import cv from "@techstark/opencv-js";
import { Adjustment } from "@/lib/HonchoEditor";
import { convertTo16BitImage, convert8BitImage } from "@/lib/adjustExt/bitImageChecking";

// This function is now correct and does not need to change.
async function applyAllAdjustments(originalImage: cv.Mat, adjustmentPipeline: Adjustment[]): Promise<cv.Mat> {
    const imageToProcess16S = new cv.Mat();

    console.debug("Image Original: ", originalImage.type());
    console.debug("Image type: ", imageToProcess16S.type());
    try {
        for (const adjustment of adjustmentPipeline) {
            if (adjustment.score !== 0) {
                const deltaMat = await computeDelta(originalImage, adjustment.score, adjustment.func);
                cv.add(originalImage, deltaMat, imageToProcess16S);
                deltaMat.delete();
            }
        }

        const finalImage = convert8BitImage(imageToProcess16S);
        return finalImage;

    } catch (err) {
        console.error("An error occurred during the adjustment pipeline:", err);
        imageToProcess16S.delete();
        return originalImage.clone();
    }
}

async function computeDelta(
    image16S: cv.Mat,
    score: number,
    adjustmentFunction: (image: cv.Mat, score: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    const cleanup: cv.Mat[] = [];
    try {
        const image8U_before = new cv.Mat(); // 8-bit image
        const conversionType8U = image16S.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3; // converter 8 bit checker
        image16S.convertTo(image8U_before, conversionType8U);
        cleanup.push(image8U_before);
        console.debug("Image Original on computeDelta: ", image16S.type());
        console.debug("Image type on computeDelta: ", image8U_before.type());

        // Applying the adjustment
        let image8U_after = await adjustmentFunction(image16S, score);
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