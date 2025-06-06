import cv from "@techstark/opencv-js";

export async function computeDelta(
    originalImage: cv.Mat,
    value: number,
    adjustmentFunction: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    const cleanup: cv.Mat[] = [];
    const originalChannels = originalImage.channels();

    let tempResultHolder: cv.Mat | null = null;
    let resultOfThisStep = new cv.Mat();
    try {
        // Run the adjustment function to get the temporary adjusted image
        const adjustedImage8U = await adjustmentFunction(originalImage, value);
        resultOfThisStep = adjustedImage8U;
        
        // Validate the result from the adjustment function
        if (!adjustedImage8U || adjustedImage8U.empty()) {
            throw new Error(`Adjustment function returned an invalid or empty cv.Mat.`);
        }
        cleanup.push(adjustedImage8U);

        if (originalChannels === 4 && resultOfThisStep.channels() === 3) {
            // console.log(`Restoring 4-channel format after '${adjustment.name}'`);
            // Hold the 3-channel result temporarily
            tempResultHolder = resultOfThisStep; 
            
            // Create a new Mat for the 4-channel output
            resultOfThisStep = new cv.Mat(); 
            
            // Convert the 3-channel BGR result to a 4-channel BGRA image.
            // This adds a new, fully opaque alpha channel.
            cv.cvtColor(tempResultHolder, resultOfThisStep, cv.COLOR_BGR2BGRA, 0);
            
            // The original 3-channel result is no longer needed
            tempResultHolder.delete();
            tempResultHolder = null;
        }

        // Create destination matrices for high-precision conversion
        const originalMat16S = new cv.Mat();
        const adjustedMat16S = new cv.Mat();
        // cleanup.push(originalMat16S, adjustedMat16S);

        // Convert both to a signed 16-bit format to handle potential negative delta values
        originalImage.convertTo(originalMat16S, cv.CV_16SC3);
        resultOfThisStep.convertTo(adjustedMat16S, cv.CV_16SC3);

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