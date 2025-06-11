import cv from "@techstark/opencv-js";
import { Adjustment } from "@/lib/HonchoEditor";
import { convertTo16BitImage, convert8BitImage } from "@/lib/adjustExt/bitImageChecking";

async function applyAllAdjustments(originalImage: cv.Mat, adjustmentPipeline: Adjustment[]): Promise<cv.Mat> {
    const newOriginalImage = convertTo16BitImage(originalImage);
    let plusDelta = new cv.Mat();

    try {
        for (const adjustment of adjustmentPipeline) {
            if (adjustment.score !== 0) {
                const deltaMat = await computeDelta(newOriginalImage, adjustment.score, adjustment.func);
                plusDelta = await addTotalDelta(newOriginalImage, deltaMat);
                // deltaMat.delete();
            }
        }
        const finalImage = convert8BitImage(plusDelta);
        return finalImage;

    } catch (err) {
        console.error("An error occurred during the adjustment pipeline:", err);
        return originalImage.clone();
    }
}

async function computeDelta(
    originalImage: cv.Mat,
    value: number,
    action: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    const cleanup: cv.Mat[] = [];
    try {
        console.debug("Compute Delta 1 ")
        const originalImage16Bit = new cv.Mat();
        originalImage.convertTo(originalImage16Bit, cv.CV_16SC3);
        console.debug("Compute Delta 2 ")
        const imageAdjusted = await action(originalImage, value);
        console.debug("Compute Delta 3 ")
        const imageAdjusted16Bit = new cv.Mat();
        imageAdjusted.convertTo(imageAdjusted16Bit, cv.CV_16SC3);
        console.debug("Compute Delta 4 ")
        const deltaMat = new cv.Mat();
        cv.subtract(imageAdjusted16Bit, originalImage16Bit, deltaMat);
        console.debug("Compute Delta 5 ")
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

async function addTotalDelta(originalImage: cv.Mat, adjustedImage: cv.Mat): Promise<cv.Mat> {
    const deltaMat = new cv.Mat();
    cv.add(originalImage, adjustedImage, deltaMat);
    return deltaMat;
}

export default computeDelta;