import cv from "@techstark/opencv-js";

// cleanAndExecuteAdjustment to remove the alpha from currentImageEdit
// and apply with new value apha
async function cleanAndExecuteAdjustment(
    currentValue: number,
    newValue: number,
    originalImage: cv.Mat,
    currentImageEdit: cv.Mat,
    action: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    let cleanUpCurrentExposure: cv.Mat | null = null;
    if (currentValue !== 0) {
        // Get adjust value from original
        const currentAdjustImage = await action(originalImage, currentValue);

        // TODO check this code if correct to remove alpha
        const currentValueImage = minusCvMat(currentAdjustImage, originalImage);
        currentAdjustImage.delete();
        originalImage.delete();

        // let remove expousre value from currentImageEdit
        cleanUpCurrentExposure = minusCvMat(currentImageEdit, currentValueImage);
        currentValueImage.delete();
    } else {
        // no need to clean up, just use current image edit, since the value is 0
        cleanUpCurrentExposure = currentImageEdit;
    }

    // now imageEdit already 0 exposure and we add with new exposure value
    const resultExposureImage = await action(cleanUpCurrentExposure, newValue);
    cleanUpCurrentExposure.delete();

    // save to currentImageEdit and publish to UI
    return resultExposureImage.clone();
}

function minusCvMat(a: cv.Mat, b: cv.Mat): cv.Mat {
    // TODO please change to correct logi
    // minus from a - b
    return a;
}

export default cleanAndExecuteAdjustment;
