import cv from "@techstark/opencv-js";
import { convertTo16BitImage } from "@/lib/adjustExt/bitImageChecking";
import computeDelta from "@/lib/adjustExt/deltaLogic";
import { log } from "console";

// cleanAndExecuteAdjustment to remove the alpha from currentImageEdit
// and apply with new value apha
async function cleanAndExecuteAdjustment(
    currentValue: number,
    newValue: number,
    originalImage: cv.Mat,
    currentImageEdit: cv.Mat,
    action: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    if (currentValue === newValue) {
        return currentImageEdit;
    }

    let cleanUpCurrentDelta: cv.Mat | null = null;
    
    console.debug("newValue", newValue);
    const originalImage16Bit = new cv.Mat();
    const currentImage16Bit = new cv.Mat();

    originalImage.convertTo(originalImage16Bit, cv.CV_16SC3);
    currentImageEdit.convertTo(currentImage16Bit, cv.CV_16SC3);
    // before
    logImage(currentImageEdit, "before 1 ");
    // const testOri = ;
    if (currentValue !== 0) {
        // Get adjust value from original
        const currentAdjustImage = await action(originalImage, currentValue);

        logImage(currentAdjustImage, "currentAdjustImage 2 ");
        // TODO check this code if correct to remove alpha
        const currentValueImage = minusCvMat(currentAdjustImage, originalImage);

        logImage(currentValueImage, "currentValueImage 3 ");

        // let remove expousre value from currentImageEdit
        cleanUpCurrentDelta = minusCvMat(currentImageEdit, currentValueImage);

        logImage(cleanUpCurrentDelta, "cleanUpCurrentDelta 4 ");
        // currentValueImage.delete();
    } else {
        // no need to clean up, just use current image edit, since the value is 0
        // console.debug("no need to clean up");
        cleanUpCurrentDelta = currentImageEdit;
        logImage(cleanUpCurrentDelta, "cleanUpCurrentDelta 5 ");
    }

    // console.debug("current Edit: ", currentImageEdit);
    // console.debug(cleanUpCurrentDelta.type());

    // now imageEdit already 0 exposure and we add with new exposure value
    const resultDefaultValue = await action(originalImage, newValue);

    // +10 exposure clean
    const resultDeltaValue = minusCvMat(resultDefaultValue, originalImage);
    // console.debug("Pixel Matrix: ", resultDeltaValue.pixels());
    // save to currentImageEdit and publish to UI
    const plusDeltaValue = plusCvMath(cleanUpCurrentDelta, resultDeltaValue);
    const finalResult = new cv.Mat();

    plusDeltaValue.convertTo(finalResult, cv.CV_8UC3);

    logImage(finalResult, "after 6 ");
    return finalResult;
}

function minusCvMat(a: cv.Mat, b: cv.Mat): cv.Mat {
    const newMat = new cv.Mat();

    cv.subtract(a, b, newMat);

    return newMat;
}

function plusCvMath(a: cv.Mat, b: cv.Mat): cv.Mat {
    const newMat = new cv.Mat();

    cv.add(a, b, newMat);

    return newMat;
}


function logImage(a: cv.Mat, tag: string): void {
    const testRow = 200;
    const testCols = 310;
    const testRow1 = 270;
    const testCols1 = 430;
    const testRow2 = 310;
    const testCols2 = 450;
    console.log(tag + 'Debug finalHSV after conversion to BGR:');
    const finalPixel = a.ucharPtr(testRow, testCols);
    const finalPixel1 = a.ucharPtr(testRow1, testCols1);
    const finalPixel2 = a.ucharPtr(testRow2, testCols2);
    const [B, G, R, A] = finalPixel;
    const [B1, G1, R1, A1] = finalPixel1;
    const [B2, G2, R2, A2] = finalPixel2;
    console.log(tag + 'Final BGRA Channels: ', a.channels());
    console.log(tag + `Final BGRA Pixel Values: B=${B}, G=${G}, R=${R}, A=${A}`);
    console.log(tag +`Final BGRA Pixel Values: B=${B1}, G=${G1}, R=${R1}, A=${A1}`);
    console.log(tag + `Final BGRA Pixel Values: B=${B2}, G=${G2}, R=${R2}, A=${A2}`);
}

export default cleanAndExecuteAdjustment;
