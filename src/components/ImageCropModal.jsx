import { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Check, Move, RotateCcw } from 'lucide-react';

const ImageCropModal = ({ imageSrc, onClose, onCropComplete }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
        setPosition({ x: 0, y: 0 });
        setZoom(1);
      };
      img.src = imageSrc;
    }
  }, [imageSrc]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetPosition = () => {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleSaveCrop = () => {
    if (!imageRef.current || !containerRef.current) return;

    const canvas = document.createElement('canvas');
    const targetSize = 500; // 1:1 ratio 500x500 canvas
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    const container = containerRef.current.getBoundingClientRect();
    const img = imageRef.current;
    const imgRect = img.getBoundingClientRect();

    // Fill canvas background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, targetSize, targetSize);

    // Calculate scale factor between rendered container and target 500x500 canvas
    const scaleToCanvas = targetSize / container.width;

    const sourceX = (container.left - imgRect.left) * (img.naturalWidth / imgRect.width);
    const sourceY = (container.top - imgRect.top) * (img.naturalHeight / imgRect.height);
    const sourceWidth = container.width * (img.naturalWidth / imgRect.width);
    const sourceHeight = container.height * (img.naturalHeight / imgRect.height);

    ctx.drawImage(
      img,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, targetSize, targetSize
    );

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], `profile_crop_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCropComplete(croppedFile);
      }
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-base font-extrabold text-white">Adjust & Center Image (1:1 Ratio)</h3>
            <p className="text-xs text-slate-400">Drag to center face & adjust zoom level</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* 1:1 Crop Container Area */}
        <div className="p-6 flex flex-col items-center justify-center space-y-5">
          <div 
            ref={containerRef}
            className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 border-indigo-500/80 shadow-2xl cursor-grab active:cursor-grabbing bg-slate-950 select-none flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          >
            {/* Guide Grid Overlay */}
            <div className="absolute inset-0 pointer-events-none z-20 border border-white/20 rounded-full flex flex-col justify-between p-4">
              <div className="w-full border-t border-dashed border-white/15 my-auto" />
              <div className="w-full border-t border-dashed border-white/15 my-auto" />
            </div>

            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop target"
              className="max-w-none transition-transform duration-75 pointer-events-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain'
              }}
              draggable={false}
            />
          </div>

          {/* Controls Bar */}
          <div className="w-full space-y-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
              <span className="flex items-center gap-1.5"><ZoomIn size={14} className="text-indigo-400" /> Zoom Level</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <ZoomOut size={16} className="text-slate-400" />
              <input 
                type="range" 
                min="0.8" 
                max="3" 
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <ZoomIn size={16} className="text-slate-400" />
            </div>

            <div className="flex justify-between items-center pt-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Move size={12} /> Drag image to position center</span>
              <button 
                onClick={resetPosition} 
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex gap-3 justify-end">
          <button 
            onClick={onClose} 
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={handleSaveCrop} 
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer"
          >
            <Check size={16} /> Save & Crop (1:1 Ratio)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
