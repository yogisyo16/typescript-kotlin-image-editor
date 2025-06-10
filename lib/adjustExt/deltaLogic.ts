import cv from "@techstark/opencv-js";
import { Adjustment } from "@/lib/HonchoEditor";
import { convertTo16BitImage, convert8BitImage } from "@/lib/adjustExt/bitImageChecking";

async function applyAllAdjustments(originalImage: cv.Mat, adjustmentPipeline: Adjustment[]): Promise<cv.Mat> {
    const newOriginalImage = convertTo16BitImage(originalImage);

    try {
        for (const adjustment of adjustmentPipeline) {
            if (adjustment.score !== 0) {
                const deltaMat = await computeDelta(newOriginalImage, adjustment.score, adjustment.func);
                cv.add(newOriginalImage, deltaMat, newOriginalImage);
                deltaMat.delete();
            }
        }
        const finalImage = convert8BitImage(newOriginalImage);
        return finalImage;

    } catch (err) {
        console.error("An error occurred during the adjustment pipeline:", err);
        return originalImage.clone();
    }
}

async function computeDelta(
    originalImage: cv.Mat,
    value: number,
    adjustmentFunction: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    const cleanup: cv.Mat[] = [];
    try {
        const imageAdjusted = await adjustmentFunction(originalImage, value);

        const deltaMat = new cv.Mat();
        cv.subtract(imageAdjusted, originalImage, deltaMat);
        
        return deltaMat;
    } catch (err) {
        console.error("Failed inside computeDelta:", (err as Error).message);
        return new cv.Mat();
    } finally {
        cleanup.forEach(mat => {
            if (mat && !mat.isDeleted()) mat.delete();
        });
    }
}

export default applyAllAdjustments;