import cv from "@techstark/opencv-js";

// In adjustmentProcessor.ts

async function computeDelta(
    originalImage: cv.Mat,
    value: number,
    adjustmentFunction: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    const cleanup: cv.Mat[] = [];
    let tempResultHolder: cv.Mat | null = null;
    try {
        let adjustedImage8U = await adjustmentFunction(originalImage.clone(), value);
        
        // This is your successful channel-correction logic
        if (originalImage.channels() === 4 && adjustedImage8U.channels() === 3) {
            tempResultHolder = adjustedImage8U; 
            adjustedImage8U = new cv.Mat(); 
            cv.cvtColor(tempResultHolder, adjustedImage8U, cv.COLOR_BGR2BGRA, 0);
            tempResultHolder.delete();
            tempResultHolder = null;
        }

        // REFINEMENT 2: Add the final version of the Mat to the cleanup array.
        cleanup.push(adjustedImage8U); 

        if (!adjustedImage8U || adjustedImage8U.empty()) {
            throw new Error(`Adjustment function returned an invalid or empty cv.Mat.`);
        }

        const originalMat16S = new cv.Mat();
        const adjustedMat16S = new cv.Mat();
        cleanup.push(originalMat16S, adjustedMat16S);

        // REFINEMENT 1: Use the correct 4-channel type for conversion.
        const conversionType = cv.CV_16SC4; // Always use 4-channel type now
        originalImage.convertTo(originalMat16S, conversionType);
        adjustedImage8U.convertTo(adjustedMat16S, conversionType);

        const deltaMat = new cv.Mat();
        cv.subtract(adjustedMat16S, originalMat16S, deltaMat);
        return deltaMat;

    } catch (err) {
        console.error("Failed inside computeDelta:", (err as Error).message);
        return new cv.Mat();
    } finally {
        cleanup.forEach(mat => {
            if (mat && !mat.isDeleted()) mat.delete();
        });
        if (tempResultHolder && !tempResultHolder.isDeleted()) {
            tempResultHolder.delete();
        }
    }
}

export default computeDelta;