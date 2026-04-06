import { useCallback, useState } from "react";

export type UploadFile = {
  file: File;
  preview?: string;
  id: string;
  isMain?: boolean;
  displayOrder?: number;
};

type Props = {
  onFilesAdded: (files: UploadFile[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
};

export default function FileUploadDropzone({ onFilesAdded, accept = "image/*,video/*", maxFiles = 10, maxSizeMB = 10 }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      const validFiles: UploadFile[] = [];
      const errors: string[] = [];

      files.forEach((file) => {
        if (file.size > maxSizeBytes) {
          errors.push(`${file.name} exceeds ${maxSizeMB}MB limit`);
          return;
        }

        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const uploadFile: UploadFile = {
          file,
          id,
          isMain: false,
          displayOrder: 0,
        };

        // Generate preview for images
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            uploadFile.preview = e.target?.result as string;
          };
          reader.readAsDataURL(file);
        }

        validFiles.push(uploadFile);
      });

      if (errors.length > 0) {
        alert(errors.join("\n"));
      }

      if (validFiles.length > 0) {
        if (maxFiles && validFiles.length > maxFiles) {
          alert(`Maximum ${maxFiles} files allowed. Only first ${maxFiles} will be selected.`);
          onFilesAdded(validFiles.slice(0, maxFiles));
        } else {
          onFilesAdded(validFiles);
        }
      }
    },
    [maxSizeMB, maxFiles, onFilesAdded]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
      // Reset input value so same file can be selected again
      e.target.value = "";
    },
    [processFiles]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        isDragging ? "border-slate-500 bg-slate-50" : "border-slate-300 bg-white"
      }`}
    >
      <input
        type="file"
        multiple
        accept={accept}
        onChange={handleFileInputChange}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
      <div className="pointer-events-none">
        <svg
          className="mx-auto h-12 w-12 text-slate-400"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Multiple files supported (Max {maxSizeMB}MB each, up to {maxFiles} files)
        </p>
      </div>
    </div>
  );
}
