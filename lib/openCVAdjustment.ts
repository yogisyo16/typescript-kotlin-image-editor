import modifyImageContrast from "@/lib/adjustImage/contrastAdjust";
import modifyImageExposure from "./adjustImage/exposureAdjust";

Object OpenCVAdjustments(){
  modifyImageExposure(src: cv.Mat, value: number): Promise<cv.Mat>
  modifyImageContrast(src: cv.Mat, contrastScore: number): Promise<cv.Mat>
};