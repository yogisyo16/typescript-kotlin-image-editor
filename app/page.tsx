"use client";
import { useEffect, useState, useRef } from "react";
import Script from "next/script";
import { HonchoEditorClass } from "@/lib/HonchoEditorImpl";
import cv from "@techstark/opencv-js";

export default function Home() {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const editorRef = useRef<HonchoEditorClass | null>(null);

  const [exposureScore, setExposureScore] = useState(0);
  const [temperatureScore, setTemperatureScore] = useState(0);
  const [tintScore, setTintScore] = useState(0);
  const [highlightsScore, setHighlightsScore] = useState(0);
  const [shadowsScore, setShadowsScore] = useState(0);
  const [blackScore, setBlackScore] = useState(0);
  const [whiteScore, setWhiteScore] = useState(0);
  const [contrastScore, setContrastScore] = useState(0);
  const [saturationScore, setSaturationScore] = useState(0);
  const [vibranceScore, setVibranceScore] = useState(0);

  const historyOn = [];
  const onOpenCVLoad = () => {
    setIsCvLoaded(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.readyState === FileReader.DONE && imgRef.current) {
        imgRef.current.src = evt.target.result as string;
        setImageLoaded(true);
      }
    };
    reader.readAsDataURL(file);
  };

  // Initialize editor
  useEffect(() => {
    if (isCvLoaded && imageLoaded && imgRef.current && canvasRef.current) {
      if (!editorRef.current) {
        editorRef.current = new HonchoEditorClass(
          imgRef.current,
          canvasRef.current
        );
      }
    }
  }, [isCvLoaded, imageLoaded]);

  // Apply adjustments when sliders change
  // useEffect(() => {
  //   if (
  //     editorRef.current &&
  //     isCvLoaded &&
  //     imageLoaded &&
  //     imgRef.current &&
  //     canvasRef.current
  //   ) {
  //     const applyAdjustments = async () => {
  //       let mat = cv.imread(imgRef.current!);
        
  //       if (exposureScore !== 0) {
  //         mat = await editorRef.current!.modify_image_exposure(exposureScore, mat);
  //       }
  //       if (temperatureScore !== 0) {
  //         mat = await editorRef.current!.modify_image_temperature(temperatureScore, mat);
  //       }
  //       if (tintScore !== 0) {
  //         mat = await editorRef.current!.modify_image_tint(tintScore, mat);
  //       }
  //       if (highlightsScore !== 0) {
  //         mat = await editorRef.current!.modify_image_highlights(highlightsScore, mat);
  //       }
  //       if (shadowsScore !== 0) {
  //         mat = await editorRef.current!.modify_image_shadows(shadowsScore, mat);
  //       }
  //       if (blackScore !== 0) {
  //         mat = await editorRef.current!.modify_image_blacks(blackScore, mat);
  //       }
  //       if (whiteScore !== 0) {
  //         mat = await editorRef.current!.modify_image_whites(whiteScore, mat);
  //       }
  //       if (contrastScore !== 0) {
  //         mat = await editorRef.current!.modify_image_contrast(contrastScore, mat);
  //       }
  //       if (saturationScore !== 0) {
  //         mat = await editorRef.current!.modify_image_saturation(saturationScore, mat);
  //       }
  //       if (vibranceScore !== 0) {
  //         mat = await editorRef.current!.modify_image_vibrance(vibranceScore, mat);
  //       }
  //       cv.imshow(canvasRef.current!, mat);
  //       mat.delete();
  //     };
  //     applyAdjustments();
  //   }
  // }, [
  //   exposureScore,
  //   temperatureScore,
  //   tintScore,
  //   highlightsScore,
  //   shadowsScore,
  //   blackScore,
  //   whiteScore,
  //   contrastScore,
  //   saturationScore,
  //   vibranceScore,
  //   isCvLoaded,
  //   imageLoaded,
  // ]);

  useEffect(() => {
    if (
      editorRef.current &&
      isCvLoaded &&
      imageLoaded &&
      imgRef.current &&
      canvasRef.current
    ) {
      // console.log("Adjusting image colors");
      editorRef.current.adjust_image_colors_merge(
        exposureScore,
        temperatureScore,
        tintScore,
        highlightsScore,
        shadowsScore,
        blackScore,
        whiteScore,
        contrastScore,
        saturationScore,
        vibranceScore,
        imgRef.current,
        canvasRef.current
      );
    }
  }, [
    exposureScore,
    temperatureScore,
    tintScore,
    highlightsScore,
    shadowsScore,
    blackScore,
    whiteScore,
    contrastScore,
    saturationScore,
    vibranceScore,
    imgRef,
    canvasRef,
    isCvLoaded,
    imageLoaded,
  ]);

  const saveHistory = () => {
    if (editorRef.current) {
      editorRef.current.configHistotrypush();
    }
  };

  const handleReset = () => {
    if (editorRef.current) {
      editorRef.current.reset();
      setExposureScore(editorRef.current["exposureValue"]);
      setTemperatureScore(editorRef.current["temperatureValue"]);
      setTintScore(editorRef.current["tintValue"]);
      setHighlightsScore(editorRef.current["highlightValue"]);
      setShadowsScore(editorRef.current["shadowValue"]);
      setBlackScore(editorRef.current["blackValue"]);
      setWhiteScore(editorRef.current["whiteValue"]);
      setContrastScore(editorRef.current["contrastValue"]);
      setVibranceScore(editorRef.current["vibranceValue"]);
      setSaturationScore(editorRef.current["saturationValue"]);
    }
  };

  const handleUndo = () => {
    if(editorRef.current) {
      editorRef.current.undo();
      setExposureScore(editorRef.current["exposureValue"]);
      setTemperatureScore(editorRef.current["temperatureValue"]);
      setTintScore(editorRef.current["tintValue"]);
      setHighlightsScore(editorRef.current["highlightValue"]);
      setShadowsScore(editorRef.current["shadowValue"]);
      setBlackScore(editorRef.current["blackValue"]);
      setWhiteScore(editorRef.current["whiteValue"]);
      setContrastScore(editorRef.current["contrastValue"]);
      setVibranceScore(editorRef.current["vibranceValue"]);
      setSaturationScore(editorRef.current["saturationValue"]);
    }
  }

  const handleRedo = () => {
    if (editorRef.current) {
      editorRef.current.redo();
      setExposureScore(editorRef.current["exposureValue"]);
      setTemperatureScore(editorRef.current["temperatureValue"]);
      setTintScore(editorRef.current["tintValue"]);
      setHighlightsScore(editorRef.current["highlightValue"]);
      setShadowsScore(editorRef.current["shadowValue"]);
      setBlackScore(editorRef.current["blackValue"]);
      setWhiteScore(editorRef.current["whiteValue"]);
      setContrastScore(editorRef.current["contrastValue"]);
      setVibranceScore(editorRef.current["vibranceValue"]);
      setSaturationScore(editorRef.current["saturationValue"]);
    }
  }

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
                    onClick={handleReset}
                  >
                    Reset
                  </button>
                  <button
                    className="p-2 bg-blue-500 text-white rounded hover:cursor-pointer hover:scale-125"
                    onClick={handleUndo}
                  >
                    Undo
                  </button>
                  <button
                    className="p-2 bg-blue-500 text-white rounded hover:cursor-pointer hover:scale-125"
                    onClick={handleRedo}
                  >
                    Redo
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="ml-4">
                  <label>
                    Exposure: {exposureScore}
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      step="0.1"
                      value={exposureScore}
                      onChange={(e) => setExposureScore(Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Temperature: {temperatureScore}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={temperatureScore}
                      onChange={(e) => setTemperatureScore(Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Tint: {tintScore}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={tintScore}
                      onChange={(e) => setTintScore(Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div>
                  <label>
                    Highlights: {highlightsScore}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={highlightsScore}
                      onChange={(e) => setHighlightsScore(Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Shadows: {shadowsScore}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={shadowsScore}
                      onChange={(e) => setShadowsScore(Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Blacks: {blackScore}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={blackScore}
                      onChange={(e) => setBlackScore(Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Whites: {whiteScore}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={whiteScore}
                      onChange={(e) => setWhiteScore(Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div>
                  <label>
                    Contrast: {contrastScore}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={contrastScore}
                      onChange={(e) => setContrastScore(Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Saturation: {saturationScore}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={saturationScore}
                      onChange={(e) => setSaturationScore(Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Vibrance: {vibranceScore}
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={vibranceScore}
                      onChange={(e) => setVibranceScore(Number(e.target.value))}
                      onMouseUp={saveHistory}
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
              <div>
                <h3 className="text-sm">Original</h3>
                <img ref={imgRef} alt="Original" width={640} height={360} />
              </div>
              <div>
                <h3 className="text-sm">Processed</h3>
                <canvas ref={canvasRef} width={640} height={360} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
