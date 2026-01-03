
import React, { useRef } from 'react';
import { ImageSource } from '../types';

interface ImageUploaderProps {
  onImageSelected: (source: ImageSource) => void;
  currentImage: string | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, currentImage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageSelected({
          base64: reader.result as string,
          mimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div 
        onClick={triggerFileInput}
        className={`relative aspect-square md:aspect-video rounded-2xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:border-rose-400 transition-all bg-white group shadow-sm`}
      >
        {currentImage ? (
          <>
            <img src={currentImage} alt="Selected" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <span className="text-white font-medium px-4 py-2 bg-rose-600 rounded-full text-sm">Change Image</span>
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4 mx-auto">
              <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-stone-600 font-medium">Click to upload reference photo</p>
            <p className="text-stone-400 text-sm mt-1">PNG, JPG up to 10MB</p>
          </div>
        )}
      </div>
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
};
