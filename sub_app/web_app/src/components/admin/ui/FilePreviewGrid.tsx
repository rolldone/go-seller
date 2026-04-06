import type { UploadFile } from "./FileUploadDropzone";

type Props = {
  files: UploadFile[];
  onRemove: (id: string) => void;
  onSetMain?: (id: string) => void;
  onReorder?: (files: UploadFile[]) => void;
  onEditFile?: (file: UploadFile) => void;
  editLabel?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function FilePreviewGrid({ files, onRemove, onSetMain, onEditFile, editLabel = "Edit" }: Props) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-medium text-slate-700">Selected Files ({files.length})</h4>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {files.map((uploadFile) => (
          <div
            key={uploadFile.id}
            className={`group relative rounded-lg border bg-white p-2 shadow-sm transition-all ${
              uploadFile.isMain ? "border-slate-600 ring-2 ring-slate-600" : "border-slate-200"
            }`}
          >
            {/* Preview */}
            <div className="relative aspect-square overflow-hidden rounded bg-slate-100">
              {uploadFile.preview ? (
                <img
                  src={uploadFile.preview}
                  alt={uploadFile.file.name}
                  className="h-full w-full object-cover"
                />
              ) : uploadFile.file.type.startsWith("video/") ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <svg
                    className="h-12 w-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <svg
                    className="h-12 w-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}

              {/* Main Badge */}
              {uploadFile.isMain && (
                <div className="absolute left-1 top-1 rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-white">
                  Main
                </div>
              )}

              {/* Actions Overlay */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {onEditFile && uploadFile.file.type.startsWith("image/") && (
                  <button
                    type="button"
                    onClick={() => onEditFile(uploadFile)}
                    className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    title="Edit image"
                  >
                    {editLabel}
                  </button>
                )}
                {onSetMain && !uploadFile.isMain && (
                  <button
                    type="button"
                    onClick={() => onSetMain(uploadFile.id)}
                    className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    title="Set as main image"
                  >
                    Set Main
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(uploadFile.id)}
                  className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600"
                  title="Remove file"
                >
                  Remove
                </button>
              </div>
            </div>

            {/* File Info */}
            <div className="mt-2">
              <p className="truncate text-xs font-medium text-slate-700" title={uploadFile.file.name}>
                {uploadFile.file.name}
              </p>
              <p className="text-xs text-slate-500">{formatFileSize(uploadFile.file.size)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
