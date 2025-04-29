import type { Attachment } from 'ai';
import { X } from 'lucide-react';
import { LoaderIcon } from './icons';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;

  return (
    <div className="relative">
      <div className="w-20 h-16 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center overflow-hidden">
        {contentType ? (
          contentType.startsWith('image') ? (
            // NOTE: it is recommended to use next/image for images
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={name ?? 'An image attachment'}
              className="rounded-md size-full object-cover"
            />
          ) : (
            <div className="" />
          )
        ) : (
          <div className="" />
        )}

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <div className="animate-spin text-zinc-500">
              <LoaderIcon />
            </div>
          </div>
        )}

        {!isUploading && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute top-1 right-1 p-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
};
