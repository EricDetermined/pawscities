'use client';

import React, { useState, useRef, useCallback } from 'react';

interface PhotoUploadProps {
  onPhotosChange: (urls: string[]) => void;
  existingPhotos?: string[];
  maxPhotos?: number;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export function PhotoUpload({
  onPhotosChange,
  existingPhotos = [],
  maxPhotos = 5,
}: PhotoUploadProps) {
  const [photos, setPhotos] = useState<Array<{ id: string; url: string; isUploading?: boolean }>>(
    existingPhotos.map((url, idx) => ({ id: `existing-${idx}`, url }))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Invalid file type. Please use JPG, PNG, or WebP.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File is too large. Maximum size is 5MB.`;
    }
    return null;
  };

  const uploadFiles = useCallback(
    async (files: FileList) => {
      const newFiles = Array.from(files);
      const validationErrors = newFiles
        .map((file) => validateFile(file))
        .filter((err) => err !== null);

      if (validationErrors.length > 0) {
        setError(validationErrors[0]);
        return;
      }

      if (photos.length + newFiles.length > maxPhotos) {
        setError(`Maximum ${maxPhotos} photos allowed. You can upload ${maxPhotos - photos.length} more.`);
        return;
      }

      setError(null);

      // Create temporary preview URLs and track upload progress
      const newPhotos = newFiles.map((file) => ({
        id: `temp-${Date.now()}-${Math.random()}`,
        url: URL.createObjectURL(file),
        isUploading: true,
        file,
      }));

      setPhotos((prev) => [...prev, ...newPhotos]);

      // Upload files to the server
      for (const photo of newPhotos) {
        try {
          const formData = new FormData();
          formData.append('file', photo.file!);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Upload failed');
          }

          const data = await response.json();
          const uploadedUrl = data.urls?.[0];

          if (!uploadedUrl) {
            throw new Error('No URL returned from upload');
          }

          // Update the photo with the actual URL
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === photo.id
                ? { ...p, url: uploadedUrl, isUploading: false }
                : p
            )
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Upload failed';
          setError(errorMsg);

          // Remove the failed upload
          setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
        }
      }
    },
    [photos.length, maxPhotos]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFiles(e.target.files);
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setError(null);
  };

  // Update parent component whenever photos change
  React.useEffect(() => {
    const uploadedPhotos = photos
      .filter((p) => !p.isUploading)
      .map((p) => p.url);
    onPhotosChange(uploadedPhotos);
  }, [photos, onPhotosChange]);

  const canUploadMore = photos.length < maxPhotos;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {canUploadMore && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-orange-500 bg-orange-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={!canUploadMore}
          />

          <div className="flex flex-col items-center gap-2">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-700">
                Drag and drop your photos here
              </p>
              <p className="text-xs text-gray-500 mt-1">
                or click to select ({photos.length}/{maxPhotos})
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              JPG, PNG, or WebP up to 5MB each
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Photo Preview Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group"
            >
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={photo.url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                {photo.isUploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                    <div className="animate-spin">
                      <svg
                        className="w-6 h-6 text-white"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Remove Button */}
              {!photo.isUploading && (
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                  title="Remove photo"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Capacity Message */}
      {!canUploadMore && (
        <p className="text-sm text-gray-600 text-center">
          Maximum of {maxPhotos} photos reached
        </p>
      )}
    </div>
  );
}
