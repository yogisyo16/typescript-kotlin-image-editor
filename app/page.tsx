"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Script from "next/script";
import { HonchoEditorClass } from "@/lib/HonchoEditorImpl";
import { AdjustType, Config, HonchoEditor, Listener } from "@/lib/HonchoEditor";
import cv from "@techstark/opencv-js";

const resizeMatToFit = (mat: cv.Mat, targetWidth: number, targetHeight: number): cv.Mat => {
  if (!mat || mat.empty()) {
    console.error("Invalid or empty Mat");
    return new cv.Mat();
  }

  const width = mat.cols;
  const height = mat.rows;
  const aspectRatio = width / height;
  const targetAspectRatio = targetWidth / targetHeight;

  let newWidth: number, newHeight: number;
  if (aspectRatio > targetAspectRatio) {
    newWidth = targetWidth;
    newHeight = Math.round(targetWidth / aspectRatio);
  } else {
    newHeight = targetHeight;
    newWidth = Math.round(targetHeight * aspectRatio);
  }

  const resizedMat = new cv.Mat();
  const dsize = new cv.Size(newWidth, newHeight);
  cv.resize(mat, resizedMat, dsize, 0, 0, cv.INTER_AREA);
  return resizedMat;
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<HonchoEditor | null>(null);
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [originalMat, setOriginalMat] = useState<cv.Mat | null>(null);
  const [adjustments, setAdjustments] = useState<Config>({
    Exposure: 0,
    Temperature: 0,
    Tint: 0,
    Highlights: 0,
    Shadow: 0,
    Black: 0,
    White: 0,
    Contrast: 0,
    Saturation: 0,
    Vibrance: 0,
  });

  const onOpenCVLoad = useCallback(() => {
    setIsCvLoaded(true);
  }, []);

  const listener = useRef<Listener>({
    onImageRendered: function (image: cv.Mat): void {
      if (canvasRef.current) cv.imshow(canvasRef.current, image);
    },
    onSyncConfigs: function (imageId: string, eventId: string, configs: Config[]): void {
      throw new Error("Function not implemented.");
    },
    onConfigChange: function (config: Config): void {
      setAdjustments(config);
    }
  });

  // Handle file upload
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Clean up existing Mat
      if (originalMat) {
        originalMat.delete();
        setOriginalMat(null);
      }

      const file = files[0];
      const img = new Image();

      img.onload = () => {
        if (isCvLoaded) {
          const mat = cv.imread(img);
          const resizedMat = resizeMatToFit(mat, 640, 360);
          mat.delete(); // Clean up original high-res Mat// will comment this after doing unit test later on after this projects
          setOriginalMat(resizedMat);

          if (!editorRef.current) {
            editorRef.current = new HonchoEditorClass(
              resizedMat,
              listener.current
            );
          }
          setImageLoaded(true);

          // Render original image
          if (originalCanvasRef.current) {
            cv.imshow(originalCanvasRef.current, resizedMat);
          }
        }
      };
      img.src = URL.createObjectURL(file);
    },
    [isCvLoaded, originalMat]
  );

  const handleReset = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.reset();
      setAdjustments({
        Exposure: 0,
        Temperature: 0,
        Tint: 0,
        Highlights: 0,
        Shadow: 0,
        Black: 0,
        White: 0,
        Contrast: 0,
        Saturation: 0,
        Vibrance: 0,
      });
    }
  }, [editorRef]);

  const handleUndo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.undo();
    }
  }, [editorRef]);

  const handleRedo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.redo();
    }
  }, [editorRef]);

  const saveHistory = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.configHistotrypush(adjustments);
    }
  }, [editorRef]);

  const handleAdjustmentChange = useCallback(
    (key: AdjustType, value: number) => {
      setAdjustments((prev) => ({ ...prev, [key]: value }));

      if (editorRef.current) {
        editorRef.current.adjust(key, value);
      }
    },
    [editorRef]
  );

  return (
    <div>
      <Script
        src="https://docs.opencv.org/4.10.0/opencv.js"
        strategy="afterInteractive"
        onLoad={onOpenCVLoad}
      />
      <main className="flex min-h-screen flex-col items-center mt-4">
        <h1 className="text-3xl">Honcho</h1>
        {!isCvLoaded && <p>Loading OpenCV.js...</p>}
        {isCvLoaded && (
          <div>
            <div className="flex flex-row items-center">
              <div className="flex flex-col mr-4 items-start">
                <label>
                  Upload Image:
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </label>
                <div className="flex gap-2 mt-2">
                  <button
                    className="p-2 bg-blue-500 text-white rounded hover:cursor-pointer hover:scale-125"
                    onClick={handleReset}>
                    Reset
                  </button>
                  <button
                    className="p-2 bg-blue-500 text-white rounded hover:cursor-pointer hover:scale-125"
                    onClick={handleUndo}>
                    Undo
                  </button>
                  <button
                    className="p-2 bg-blue-500 text-white rounded hover:cursor-pointer hover:scale-125"
                    onClick={handleRedo}>
                    Redo
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="ml-4">
                  <label>
                    Exposure: {adjustments.Exposure}
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      step="0.1"
                      value={adjustments.Exposure}
                      onChange={(e) =>
                        handleAdjustmentChange(AdjustType.Exposure, Number(e.target.value))
                      }/>
                  </label>
                </div>
                <div>
                  <label>
                    Temperature: {adjustments.Temperature}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Temperature}
                      onChange={(e) =>
                        handleAdjustmentChange(AdjustType.Temperature, Number(e.target.value))
                      }/>
                  </label>
                </div>
                <div>
                  <label>
                    Tint: {adjustments.Tint}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Tint}
                      onChange={(e) =>
                        handleAdjustmentChange(AdjustType.Tint, Number(e.target.value))
                      }/>
                  </label>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div>
                  <label>
                    Highlights: {adjustments.Highlights}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Highlights}
                      onChange={(e) =>
                        handleAdjustmentChange(AdjustType.Highlights, Number(e.target.value))
                      }/>
                  </label>
                </div>
                <div>
                  <label>
                    Shadows: {adjustments.Shadow}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Shadow}
                      onChange={(e) =>
                        handleAdjustmentChange(AdjustType.Shadow, Number(e.target.value))
                      }/>
                  </label>
                </div>
                <div>
                  <label>
                    Blacks: {adjustments.Black}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Black}
                      onChange={(e) =>
                        handleAdjustmentChange(AdjustType.Blacks, Number(e.target.value))
                      }/>
                  </label>
                </div>
                <div>
                  <label>
                    Whites: {adjustments.White}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.White}
                      onChange={(e) =>
                        handleAdjustmentChange(AdjustType.Whites, Number(e.target.value))
                      }/>
                  </label>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div>
                  <label>
                    Contrast: {adjustments.Contrast}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Contrast}
                      onChange={(e) =>
                        handleAdjustmentChange(AdjustType.Contrast, Number(e.target.value))
                      }/>
                  </label>
                </div>
                <div>
                  <label>
                    Saturation: {adjustments.Saturation}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Saturation}
                      onChange={(e) =>
                        handleAdjustmentChange(AdjustType.Saturation, Number(e.target.value))
                      }/>
                  </label>
                </div>
                <div>
                  <label>
                    Vibrance: {adjustments.Vibrance}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={adjustments.Vibrance}
                      onChange={(e) =>
                        handleAdjustmentChange(AdjustType.Vibrance, Number(e.target.value))
                      }/>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
              <div>
                <h3 className="text-sm">Original</h3>
                <canvas
                  ref={originalCanvasRef}
                  width={640}
                  height={360}
                />
              </div>
              <div>
                <h3 className="text-sm">Processed</h3>
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={360}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}