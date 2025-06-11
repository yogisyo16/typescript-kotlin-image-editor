import cv from "@techstark/opencv-js";
import { Adjustment } from "@/lib/HonchoEditor";
import { convertTo16BitImage, convert8BitImage } from "@/lib/adjustExt/bitImageChecking";

// This function is now correct and does not need to change.
async function applyAllAdjustments(originalImage: cv.Mat, adjustmentPipeline: Adjustment[]): Promise<cv.Mat> {
    // const imageToProcess16S = new cv.Mat();
    const imageToProcess16S = convertTo16BitImage(originalImage);
    try {
        for (const adjustment of adjustmentPipeline) {
            if (adjustment.score !== 0) {
                const deltaMat = await computeDelta(imageToProcess16S, adjustment.score, adjustment.func);
                cv.add(originalImage, deltaMat, imageToProcess16S);
                // deltaMat.delete();
            }
        }

        const finalImage = convert8BitImage(imageToProcess16S);
        return finalImage;

    } catch (err) {
        console.error("An error occurred during the adjustment pipeline:", err);
        // imageToProcess16S.delete();
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
        const image8U_before = convert8BitImage(image16S); // 8-bit image
        
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
        const image16S_before = convertTo16BitImage(image8U_before);
        const image16S_after = convertTo16BitImage(image8U_after);
        const deltaMat = new cv.Mat();
        cv.subtract(image16S_after, image16S_before, deltaMat);
        console.debug(deltaMat.type());
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