import cv from "@techstark/opencv-js";
import { sigmoid } from "@/lib/adjustImage/sigmoidAdjust";

function boostScaleForWhite(stdVal: number): number {
    const minBoost = 12.0;
    const maxBoost = 250.0;
    const decayFactor = 0.048;

    // exp(-decayFactor * stdVal).coerceAtMost(100.0) in Kotlin is Math.min(exp(...), 100.0)
    const exponentialPart = Math.min(Math.exp(-decayFactor * stdVal), 100.0);
    
    return minBoost + (maxBoost - minBoost) * exponentialPart;
}

function boostColourFromWhite(targetImg: cv.Mat, scaleRatio: number): cv.Mat {
    if (scaleRatio === 0) {
        return targetImg.clone();
    }

    const cleanup: cv.Mat[] = [];
    try {
        const labImg = new cv.Mat();
        cleanup.push(labImg);
        cv.cvtColor(targetImg, labImg, cv.COLOR_BGR2Lab);

        const labChannels = new cv.MatVector();
        cleanup.push(labChannels as any);
        cv.split(labImg, labChannels);
        const lum = labChannels.get(0);

        const lumFloat = new cv.Mat();
        cleanup.push(lumFloat);
        lum.convertTo(lumFloat, cv.CV_32F, 1.0 / 255.0); // Normalize in one step

        const lumScalingFactor = sigmoid(lumFloat, 12.0, 0.1, 5.0);
        cleanup.push(lumScalingFactor);

        const scaleMat = new cv.Mat();
        cleanup.push(scaleMat);
        const scaleRatioMat = new cv.Mat(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F, new cv.Scalar(scaleRatio));
        cleanup.push(scaleRatioMat);
        cv.multiply(lumScalingFactor, scaleRatioMat, scaleMat);
        
        const oneMat = cv.Mat.ones(scaleMat.rows, scaleMat.cols, cv.CV_32F);
        cleanup.push(oneMat);
        cv.add(oneMat, scaleMat, scaleMat); // Now scaleMat contains 1 + (scaleRatio * factor)

        const adjustedImageFloat = new cv.Mat();
        cleanup.push(adjustedImageFloat);
        targetImg.convertTo(adjustedImageFloat, cv.CV_32FC3);

        const bgrChannels = new cv.MatVector();
        cleanup.push(bgrChannels as any);
        cv.split(adjustedImageFloat, bgrChannels);

        // Multiply each channel by the same scaling matrix
        cv.multiply(bgrChannels.get(0), scaleMat, bgrChannels.get(0));
        cv.multiply(bgrChannels.get(1), scaleMat, bgrChannels.get(1));
        cv.multiply(bgrChannels.get(2), scaleMat, bgrChannels.get(2));

        cv.merge(bgrChannels, adjustedImageFloat);
        
        // Clipping is handled by convertTo cv.CV_8U
        const finalImage = new cv.Mat();
        adjustedImageFloat.convertTo(finalImage, cv.CV_8UC3);
        
        return finalImage;

    } finally {
        cleanup.forEach(mat => mat.delete());
    }
}

async function modifyImageWhites(src: cv.Mat, whitesValue: number): Promise<cv.Mat> {
    if (whitesValue === 0) {
        return src.clone();
    }

    const cleanup: cv.Mat[] = [];
    try {
        if (whitesValue > 0) {
            // --- POSITIVE WHITES LOGIC (YUV Method - Confirmed Working) ---
            const hsv = new cv.Mat();
            cleanup.push(hsv);
            cv.cvtColor(src, hsv, cv.COLOR_BGR2HSV);
            const hsvChannels = new cv.MatVector();
            cleanup.push(hsvChannels as any);
            cv.split(hsv, hsvChannels);

            const mean = new cv.Mat();
            const stdDev = new cv.Mat();
            cleanup.push(mean, stdDev);
            cv.meanStdDev(hsvChannels.get(2), mean, stdDev);
            const stdVal = stdDev.data64F[0];

            const whiteBoostRatio = (whitesValue / 30.0) * (boostScaleForWhite(stdVal) / 100.0);
            
            const highlightTonePercent = 0.75;
            const highlightAmountPercent = whitesValue / -1.0;
            const highlightTone = 255 - highlightTonePercent * 255;
            const highlightGain = 1.0 + highlightAmountPercent * 3.0;

            const yuvImg = new cv.Mat();
            cleanup.push(yuvImg);
            cv.cvtColor(src, yuvImg, cv.COLOR_BGR2YUV);
            
            const yuvChannels = new cv.MatVector();
            cleanup.push(yuvChannels as any);
            cv.split(yuvImg, yuvChannels);
            const [imgY, imgU, imgV] = [yuvChannels.get(0), yuvChannels.get(1), yuvChannels.get(2)];

            const imgYFloat = new cv.Mat();
            cleanup.push(imgYFloat);
            imgY.convertTo(imgYFloat, cv.CV_32F);

            const highlightMap = new cv.Mat(); cleanup.push(highlightMap);
            const highlightMapTerm = new cv.Mat(); cleanup.push(highlightMapTerm);
            const fullWhite = new cv.Mat(imgY.rows, imgY.cols, cv.CV_32F, new cv.Scalar(255.0)); cleanup.push(fullWhite);
            cv.subtract(fullWhite, imgYFloat, highlightMapTerm);

            // --- THIS IS THE FIX ---
            // Create a full matrix for the scalar multiplication to satisfy TypeScript
            const highlightScalarMat = new cv.Mat(highlightMapTerm.rows, highlightMapTerm.cols, highlightMapTerm.type(), new cv.Scalar(255.0 / (255.0 - highlightTone)));
            cleanup.push(highlightScalarMat); // Add to cleanup array
            cv.multiply(highlightMapTerm, highlightScalarMat, highlightMapTerm);
            // --- END OF FIX ---

            cv.subtract(fullWhite, highlightMapTerm, highlightMap);
            const mask = new cv.Mat(); cleanup.push(mask);
            cv.threshold(imgY, mask, highlightTone, 255, cv.THRESH_BINARY_INV);
            highlightMap.setTo(new cv.Scalar(0), mask);

            const lutData = new Float32Array(256).map((_, i) => Math.max(0, Math.min(255, Math.pow(i / 255.0, highlightGain) * 255.0)));
            const lut = new cv.Mat(1, 256, cv.CV_32F); cleanup.push(lut);
            lut.data32F.set(lutData);
            
            const adjustedY = new cv.Mat(); cleanup.push(adjustedY);
            cv.LUT(imgY, lut, adjustedY);
            adjustedY.convertTo(adjustedY, cv.CV_32F);
            highlightMap.convertTo(highlightMap, cv.CV_32F, 1.0 / 255.0);

            const finalY = new cv.Mat(); cleanup.push(finalY);
            const oneMinusMask = new cv.Mat(); cleanup.push(oneMinusMask);
            cv.subtract(cv.Mat.ones(highlightMap.size(), cv.CV_32F), highlightMap, oneMinusMask);
            const term1 = new cv.Mat(); cleanup.push(term1);
            const term2 = new cv.Mat(); cleanup.push(term2);
            cv.multiply(imgYFloat, oneMinusMask, term1);
            cv.multiply(adjustedY, highlightMap, term2);
            cv.add(term1, term2, finalY);
            finalY.convertTo(finalY, cv.CV_8U);

            const adjustedYuvChannels = new cv.MatVector(); cleanup.push(adjustedYuvChannels as any);
            adjustedYuvChannels.push_back(finalY);
            adjustedYuvChannels.push_back(imgU);
            adjustedYuvChannels.push_back(imgV);
            const adjustedYuv = new cv.Mat(); cleanup.push(adjustedYuv);
            cv.merge(adjustedYuvChannels, adjustedYuv);
            const adjustedImage = new cv.Mat(); cleanup.push(adjustedImage);
            cv.cvtColor(adjustedYuv, adjustedImage, cv.COLOR_YUV2BGR);

            const boostedImage = boostColourFromWhite(adjustedImage, whiteBoostRatio); cleanup.push(boostedImage);

            const resultHsv = new cv.Mat(); cleanup.push(resultHsv);
            const srcHsv = hsv; // Reuse from above
            cv.cvtColor(boostedImage, resultHsv, cv.COLOR_BGR2HSV);
            const resultHsvChannels = new cv.MatVector(); cleanup.push(resultHsvChannels as any);
            cv.split(resultHsv, resultHsvChannels);

            const finalHsvChannels = new cv.MatVector(); cleanup.push(finalHsvChannels as any);
            finalHsvChannels.push_back(hsvChannels.get(0));
            finalHsvChannels.push_back(resultHsvChannels.get(1));
            finalHsvChannels.push_back(resultHsvChannels.get(2));
            const finalHsv = new cv.Mat(); cleanup.push(finalHsv);
            cv.merge(finalHsvChannels, finalHsv);

            const finalImage = new cv.Mat();
            cv.cvtColor(finalHsv, finalImage, cv.COLOR_HSV2BGR);
            return finalImage;

        } else {
            // --- NEGATIVE WHITES LOGIC (LAB Method - from Kotlin reference) ---
            const labImg = new cv.Mat();
            cleanup.push(labImg);
            cv.cvtColor(src, labImg, cv.COLOR_BGR2Lab);

            const labChannels = new cv.MatVector();
            cleanup.push(labChannels as any);
            cv.split(labImg, labChannels);
            const lum = labChannels.get(0);

            const lumFloat = new cv.Mat();
            cleanup.push(lumFloat);
            lum.convertTo(lumFloat, cv.CV_32F, 1.0 / 255.0); // Normalize to 0-1

            const adjustedWhite = whitesValue / 200.0; // Using /100 from Kotlin
            const contrastFactor = 0.1 * (1 - Math.exp(-Math.abs(adjustedWhite / 0.4)));

            const reducedContrastLum = new cv.Mat();
            cleanup.push(reducedContrastLum);
            const contrastMat = new cv.Mat(lumFloat.rows, lumFloat.cols, lumFloat.type(), new cv.Scalar(1.0 - contrastFactor));
            cleanup.push(contrastMat);
            const offsetMat = new cv.Mat(lumFloat.rows, lumFloat.cols, lumFloat.type(), new cv.Scalar(0.9 * contrastFactor));
            cleanup.push(offsetMat);

            cv.multiply(lumFloat, contrastMat, reducedContrastLum);
            cv.add(reducedContrastLum, offsetMat, reducedContrastLum);

            const lumScalingFactor = sigmoid(reducedContrastLum, 12.0, 0.5, 1.2);
            cleanup.push(lumScalingFactor);

            const scale = new cv.Mat();
            cleanup.push(scale);
            const adjustedWhiteMat = new cv.Mat(lumFloat.rows, lumFloat.cols, lumFloat.type(), new cv.Scalar(adjustedWhite));
            cleanup.push(adjustedWhiteMat);
            cv.multiply(lumScalingFactor, adjustedWhiteMat, scale);
            cv.add(cv.Mat.ones(scale.rows, scale.cols, scale.type()), scale, scale);

            const srcFloat = new cv.Mat();
            cleanup.push(srcFloat);
            src.convertTo(srcFloat, cv.CV_32FC3);

            const srcChannels = new cv.MatVector();
            cleanup.push(srcChannels as any);
            cv.split(srcFloat, srcChannels);

            cv.multiply(srcChannels.get(0), scale, srcChannels.get(0));
            cv.multiply(srcChannels.get(1), scale, srcChannels.get(1));
            cv.multiply(srcChannels.get(2), scale, srcChannels.get(2));

            const finalImageFloat = new cv.Mat();
            cleanup.push(finalImageFloat);
            cv.merge(srcChannels, finalImageFloat);

            const finalImage = new cv.Mat();
            finalImageFloat.convertTo(finalImage, cv.CV_8UC3);

            return finalImage;
        }
    } catch (err) {
        console.error("Error in modifyImageWhites:", err);
        throw new Error("Failed to modify image whites.");
    } finally {
        cleanup.forEach(mat => {
            if (mat && !mat.isDeleted()) {
                mat.delete();
            }
        });
    }
}

export default modifyImageWhites;