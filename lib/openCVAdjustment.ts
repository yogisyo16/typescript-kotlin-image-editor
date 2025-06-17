import cv from "@techstark/opencv-js";
import modifyImageExposure from "@/lib/adjustImage/exposureAdjust";
import modifyImageTemperature from "@/lib/adjustImage/temperatureAdjust";
import modifyImageTint from "@/lib/adjustImage/tintAdjust";
import modifyImageHighlights from "@/lib/adjustImage/highlightAdjust";
import modifyImageShadows from "@/lib/adjustImage/shadowsAdjust";
import modifyImageBlacks from "@/lib/adjustImage/blacksAdjust";
import modifyImageWhites from "@/lib/adjustImage/whiteAdjust";
import modifyImageContrast from "@/lib/adjustImage/contrastAdjust";
import modifyImageSaturation from "@/lib/adjustImage/saturationAdjust";
import modifyImageVibrance from "@/lib/adjustImage/vibranceAdjust";

// This interface used on undo/redo method to called the right function
interface OpenCVAdjustments{
  modifyImageExposure(image: cv.Mat, score: number): Promise<cv.Mat>
  modifyImageContrast(image: cv.Mat, score: number): Promise<cv.Mat>
  modifyImageTemperature(image: cv.Mat, score: number): Promise<cv.Mat>
  modifyImageTint(image: cv.Mat, score: number): Promise<cv.Mat>
  modifyImageHighlights(image: cv.Mat, score: number): Promise<cv.Mat>
  modifyImageShadows(image: cv.Mat, score: number): Promise<cv.Mat>
  modifyImageBlacks(image: cv.Mat, score: number): Promise<cv.Mat>
  modifyImageWhites(image: cv.Mat, score: number): Promise<cv.Mat>
  modifyImageSaturation(image: cv.Mat, score: number): Promise<cv.Mat>
  modifyImageVibrance(image: cv.Mat, score: number): Promise<cv.Mat>
};

const openCVAdjustments: OpenCVAdjustments = {
  modifyImageExposure,
  modifyImageContrast,
  modifyImageTemperature,
  modifyImageTint,
  modifyImageHighlights,
  modifyImageShadows,
  modifyImageBlacks,
  modifyImageWhites,
  modifyImageSaturation,
  modifyImageVibrance
}

export default openCVAdjustments;