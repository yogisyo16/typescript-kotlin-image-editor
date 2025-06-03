import cv from "@techstark/opencv-js";

// cleanAndExecuteAdjustment to remove the alpha from currentImageEdit
// and apply with new value apha
async function cleanAndExecuteAdjustment(
    currentValue: number,
    newValue: number,
    originalImage: cv.Mat, // Assuming this is CV_8U (e.g., CV_8UC3 or CV_8UC4)
    currentImageEdit: cv.Mat,
    action: (image: cv.Mat, value: number) => Promise<cv.Mat>, // Assuming this action also returns CV_8U
): Promise<cv.Mat> {
    // This variable will hold the image to be returned.
    // In the case of newValue !== 0, it's the image with the single new adjustment.
    // In the case of newValue === 0, it's the currentImageEdit (image with other adjustments).
    let resultingImageForThisStep: cv.Mat;

    if (newValue !== 0) {
        const currentAdjustImage = await action(originalImage, newValue); // This is the image with ONLY the current 'newValue' adjustment applied to 'originalImage'

        // --- START: DELTA CALCULATION AND LOGGING ---
        if (!originalImage.empty() && !currentAdjustImage.empty()) {
            let originalImageFloat: cv.Mat | null = null;
            let currentAdjustImageFloat: cv.Mat | null = null;
            let calculatedDelta: cv.Mat | null = null;
            let maskForMinMax: cv.Mat | null = null; // Optional mask for minMaxLoc

            try {
                // Convert both images to a floating-point type (e.g., CV_32F) for accurate subtraction
                // that can result in negative numbers.
                const targetDepth = cv.CV_32F; // Target depth for calculation

                if (originalImage.type() === currentAdjustImage.type()) {
                    originalImageFloat = new cv.Mat();
                    currentAdjustImageFloat = new cv.Mat();

                    originalImage.convertTo(originalImageFloat, targetDepth);
                    currentAdjustImage.convertTo(currentAdjustImageFloat, targetDepth);

                    calculatedDelta = new cv.Mat();
                    cv.subtract(currentAdjustImageFloat, originalImageFloat, calculatedDelta);

                    console.log("--- Delta Calculation ---");
                    console.log(`Original Image: ${originalImage.cols}x${originalImage.rows}, Channels: ${originalImage.channels()}, Type: ${originalImage.type()}`);
                    console.log(`Current Adjusted Image (single effect): ${currentAdjustImage.cols}x${currentAdjustImage.rows}, Channels: ${currentAdjustImage.channels()}, Type: ${currentAdjustImage.type()}`);
                    console.log(`Calculated Delta Mat: ${calculatedDelta.cols}x${calculatedDelta.rows}, Channels: ${calculatedDelta.channels()}, Type: ${calculatedDelta.type()}`);

                    // Log min/max values for each channel of the delta
                    if (calculatedDelta.channels() > 0) {
                        const deltaChannels = new cv.MatVector();
                        cv.split(calculatedDelta, deltaChannels);
                        maskForMinMax = new cv.Mat(); // Create an empty mask (no masking)

                        for (let i = 0; i < deltaChannels.size(); i++) {
                            const channelMat = deltaChannels.get(i);
                            
                            // Prepare variables to hold the output of minMaxLoc
                            // For numbers (minVal, maxVal), pass single-element arrays.
                            // For points (minLoc, maxLoc), pass cv.Point objects.
                            const minValArray: number[] = [-1]; // Initialize with a dummy value
                            const maxValArray: number[] = [-1]; // Initialize with a dummy value
                            const minLocPoint: cv.Point = new cv.Point(0, 0);
                            const maxLocPoint: cv.Point = new cv.Point(0, 0);

                            // Call minMaxLoc with arguments for output values
                            // The signature is typically: src, minVal, maxVal, minLoc, maxLoc, mask (optional)
                            cv.minMaxLoc(
                                channelMat,
                                minValArray,
                                maxValArray,
                                minLocPoint,
                                maxLocPoint,
                                maskForMinMax // Pass the empty mask
                            );
                            
                            console.log(`Delta Channel ${i}: Min = ${minValArray[0].toFixed(2)}, Max = ${maxValArray[0].toFixed(2)} at [${maxLocPoint.x}, ${maxLocPoint.y}] (MinLoc: [${minLocPoint.x}, ${minLocPoint.y}])`);
                            
                            if (channelMat) channelMat.delete(); // Clean up split channel
                        }
                        deltaChannels.delete();
                        if (maskForMinMax && !maskForMinMax.empty()) maskForMinMax.delete();
                    }
                    
                    // Log a few pixel values from the delta (e.g., first 12 float values, representing a few pixels)
                    // Note: .data32F accesses the underlying Float32Array.
                    if(calculatedDelta && !calculatedDelta.empty()) {
                        console.log("Sample Delta Values (first 12 floats):", calculatedDelta.data32F.slice(0, 12));
                    }
                    console.log("--- End Delta Calculation ---");

                } else {
                    console.warn("Delta Calculation Skipped: originalImage and currentAdjustImage have different types/channels.");
                }

            } catch (e) {
                console.error("Error during delta calculation for logging:", e);
            } finally {
                // Clean up intermediate Mats created for delta calculation
                if (originalImageFloat) originalImageFloat.delete();
                if (currentAdjustImageFloat) currentAdjustImageFloat.delete();
                if (calculatedDelta) calculatedDelta.delete();
                if (maskForMinMax && !maskForMinMax.empty()) maskForMinMax.delete(); // Ensure mask is deleted if created
            }
        }
        // --- END: DELTA CALCULATION AND LOGGING ---

        resultingImageForThisStep = currentAdjustImage.clone(); // This is what your function was assigning to deltaMat
        currentAdjustImage.delete(); // Clean up the image from the action
    } else {
        // If newValue is 0 (neutral), this function, in its current logic,
        // returns the currentImageEdit (which has all *other* adjustments).
        resultingImageForThisStep = currentImageEdit.clone(); 
    }

    // Your existing logging:
    // .data16U is for CV_16U type. If your originalImage is CV_8U, .data would be Uint8Array.
    // For CV_32F, it would be .data32F (Float32Array).
    // Be careful to use the correct data accessor for the Mat's type.
    console.log("originalImage data (first 10 values as Uint8): ", originalImage.data.slice(0,10));
    console.log("resultingImageForThisStep data (first 10 values as Uint8): ", resultingImageForThisStep.data.slice(0,10));
    
    const finalOutputMat = resultingImageForThisStep.clone();
    resultingImageForThisStep.delete(); 

    return finalOutputMat;
}

// This function is not directly used in cleanAndExecuteAdjustment's main path
// but is kept as it was in your original file.
function deltaValueCount(a: cv.Mat, b: cv.Mat): cv.Mat {
    const minusAlpha = new cv.Mat();
    // cv.divide(a, b, minusAlpha); // This line seems out of place if the goal is subtraction
    cv.subtract(a, b, minusAlpha);
    return minusAlpha;
}

export default cleanAndExecuteAdjustment;