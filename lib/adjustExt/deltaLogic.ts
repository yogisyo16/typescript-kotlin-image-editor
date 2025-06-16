import cv from "@techstark/opencv-js";
import { Config } from "@/lib/HonchoEditor";
import openCVAdjustments from "@/lib/openCVAdjustment"

export async function applyAllAdjustments(
    originalImage: cv.Mat, 
    configScore: Config,

): Promise<cv.Mat> {
    const newOriginalImage = new cv.Mat();

    originalImage.convertTo(newOriginalImage, cv.CV_16SC3);

    console.debug("Done 1");

    const totalDelta = cv.Mat.zeros(originalImage.rows, originalImage.cols, cv.CV_16SC3);

    console.debug("Total Delta Before Input:", totalDelta.channels(), " + ", totalDelta.type());

    try {
        console.debug("Done 2");
        const adjusting = [
          { score: configScore.Exposure, func: openCVAdjustments.modifyImageExposure },
          { score: configScore.Contrast, func: openCVAdjustments.modifyImageContrast },
          { score: configScore.Highlights, func: openCVAdjustments.modifyImageHighlights },
          { score: configScore.Shadow, func: openCVAdjustments.modifyImageShadows },
          { score: configScore.Whites, func: openCVAdjustments.modifyImageWhites },
          { score: configScore.Blacks, func: openCVAdjustments.modifyImageBlacks },
          { score: configScore.Temperature, func: openCVAdjustments.modifyImageTemperature },
          { score: configScore.Tint, func: openCVAdjustments.modifyImageTint },
          { score: configScore.Vibrance, func: openCVAdjustments.modifyImageVibrance },
          { score: configScore.Saturation, func: openCVAdjustments.modifyImageSaturation },
        ];


        console.debug("Done 3");
        for (const adjustment of adjusting) {
            console.debug("Adjustment:", adjustment.func.name, "Score:", adjustment.score);
            if (adjustment.score !== 0) {
                const deltaMat = await computeDelta(newOriginalImage, adjustment.score, adjustment.func);
                cv.add(totalDelta, deltaMat, totalDelta);
                deltaMat.delete();
            }
        }

        console.debug("Done 4");

        const finalImage16Bit = new cv.Mat();

        console.debug("Original Image Converter :", newOriginalImage.channels(), " + ", newOriginalImage.type());

        console.debug("Total Delta :", totalDelta.channels(), " + ", totalDelta.type());
        
        cv.add(newOriginalImage, totalDelta, finalImage16Bit);

        console.debug("Final Image after adding original :", finalImage16Bit);

        console.debug("Done 5");

        const finalImage = new cv.Mat();

        finalImage16Bit.convertTo(finalImage, cv.CV_8UC3);

        console.debug("Done 6");

        return finalImage;

    } catch (err) {
        console.error("An error occurred during the adjustment pipeline:", err);
        return originalImage.clone();
    }
}

export async function computeDelta(
    originalImage: cv.Mat,
    value: number,
    action: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    const cleanup: cv.Mat[] = [];
    try {
        
        const originalImage16Bit = new cv.Mat();
        originalImage.convertTo(originalImage16Bit, cv.CV_16SC3);
        
        const imageAdjusted = await action(originalImage, value);
        
        const imageAdjusted16Bit = new cv.Mat();
        imageAdjusted.convertTo(imageAdjusted16Bit, cv.CV_16SC3);
        
        const deltaMat = new cv.Mat();
        cv.subtract(imageAdjusted16Bit, originalImage16Bit, deltaMat);
        
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

// export default computeDelta;