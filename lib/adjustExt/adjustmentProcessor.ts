import cv from "@techstark/opencv-js";
import { Adjustment } from "@/lib/HonchoEditor";

async function applyAllAdjustments(originalImage: cv.Mat, adjustmentPipeline: Adjustment[]): Promise<cv.Mat> {
    console.log("Pipeline: ", adjustmentPipeline);
    let imageToProcess = originalImage.clone();
    try {
      for (const adjustment of adjustmentPipeline) {
        if (adjustment.value !== 0) {
          console.log("Applying:", adjustment.name, "with value:", adjustment.value);

          // 1. Apply the adjustment function to the current image in the pipeline.
          const resultOfThisStep = await adjustment.func(imageToProcess, adjustment.value);

          // 2. (RE-ENABLED) Calculate the delta based on the original image.
          //    This is useful for analysis but doesn't affect the final image.
          const deltaValue = await computeDelta(imageToProcess, adjustment.value, adjustment.func);

          // 4. The result of the adjustment becomes the input for the next step.
          imageToProcess.delete(); 
          imageToProcess = deltaValue;
        }
      }
      // Return the final, fully processed image.
      return imageToProcess;

    } catch (err) {
      console.error("An error occurred during the adjustment pipeline:", err);
      if (imageToProcess) imageToProcess.delete();
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
        let adjustedImage8U = await adjustmentFunction(originalImage.clone(), value);
        let tempResultHolder: cv.Mat | null = null;
        cleanup.push(adjustedImage8U); // Add to cleanup right away
        let originalChannels = originalImage.channels();
        let resultOfThisStep = adjustedImage8U.channels();
        if (!adjustedImage8U || adjustedImage8U.empty()) {
            throw new Error(`Adjustment function returned an invalid or empty cv.Mat.`);
        }

        if (originalChannels === 4 && resultOfThisStep === 3) {
            //   console.log(`Restoring 4-channel format after '${adjustment.name}'`);
              // Hold the 3-channel result temporarily
              tempResultHolder = adjustedImage8U; 
              
              // Create a new Mat for the 4-channel output
              adjustedImage8U = new cv.Mat(); 
              
              // Convert the 3-channel BGR result to a 4-channel BGRA image.
              // This adds a new, fully opaque alpha channel.
              cv.cvtColor(tempResultHolder, adjustedImage8U, cv.COLOR_BGR2BGRA, 0);
              
              // The original 3-channel result is no longer needed
              tempResultHolder.delete();
              tempResultHolder = null;
          }

        // --- START DIAGNOSTIC LOGS ---
        console.log(`[computeDelta] Original Image -> Dims: ${originalImage.rows}x${originalImage.cols}, Channels: ${originalImage.channels()}, Type: ${originalImage.type()}`);
        console.log(`[computeDelta] Adjusted Image -> Dims: ${adjustedImage8U.rows}x${adjustedImage8U.cols}, Channels: ${adjustedImage8U.channels()}, Type: ${adjustedImage8U.type()}`);
        // --- END DIAGNOSTIC LOGS ---

        const originalMat16S = new cv.Mat();
        const adjustedMat16S = new cv.Mat();
        cleanup.push(originalMat16S, adjustedMat16S);

        originalImage.convertTo(originalMat16S, cv.CV_16SC3);
        adjustedImage8U.convertTo(adjustedMat16S, cv.CV_16SC3);

        // The error happens here if the logs above show any mismatch
        const deltaMat = new cv.Mat();
        cv.subtract(adjustedMat16S, originalMat16S, deltaMat);
        console.log("Subtraction successful. Delta mat created.");

        // The calling function (`applyAllAdjustments`) is responsible for cleaning up deltaMat
        return deltaMat; // <-- IMPORTANT: You should return the delta!

    } catch (err) {
        console.error("Failed inside computeDelta:", (err as Error).message);
        // On failure, return an empty Mat that the caller can check.
        return new cv.Mat();
    } finally {
        // IMPORTANT: Ensure all intermediate mats are cleaned up to prevent memory leaks.
        cleanup.forEach(mat => {
            if (mat && !mat.isDeleted()) mat.delete();
        });
    }
}

export default computeDelta;