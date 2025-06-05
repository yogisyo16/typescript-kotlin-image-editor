import cv from "@techstark/opencv-js";

export async function computeDelta(
    originalImage: cv.Mat,
    adjustmentFunction: (image: cv.Mat, value: number) => Promise<cv.Mat>,
    value: number,
): Promise<cv.Mat> {
    const cleanup: cv.Mat[] = [];
    try {
        // Run the adjustment function to get the temporary adjusted image
        const adjustedImage8U = await adjustmentFunction(originalImage, value);
        
        // Validate the result from the adjustment function
        if (!adjustedImage8U || adjustedImage8U.empty()) {
            throw new Error(`Adjustment function returned an invalid or empty cv.Mat.`);
        }
        cleanup.push(adjustedImage8U);

        // Create destination matrices for high-precision conversion
        const originalMat16S = new cv.Mat();
        const adjustedMat16S = new cv.Mat();
        cleanup.push(originalMat16S, adjustedMat16S);

        // Convert both to a signed 16-bit format to handle potential negative delta values
        originalImage.convertTo(originalMat16S, cv.CV_16SC3);
        adjustedImage8U.convertTo(adjustedMat16S, cv.CV_16SC3);

        // Calculate the delta: Adjusted - Original
        const deltaMat = new cv.Mat();
        cv.subtract(adjustedMat16S, originalMat16S, deltaMat);

        // The calling function (`applyAllAdjustments`) is responsible for cleaning up the returned deltaMat
        return deltaMat;

    } catch (err) {
        console.error("Failed inside computeDelta:", (err as Error).message);
        throw new Error("Failed to compute delta.");
    } finally {
        cleanup.forEach(mat => {
            if (mat && !mat.isDeleted()) mat.delete();
        });
    }
}