import React, { useRef, useState } from 'react';
import { Upload, Link as LinkIcon, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

export const PRESET_PHOTOS = [
  { url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80', label: 'Suite Classic' },
  { url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80', label: 'Earthy Luxury' },
  { url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80', label: 'Tropical Vista' },
  { url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80', label: 'Cozy Organic' },
];

interface RoomImagePickerProps {
  images: string[];
  onChange: (images: string[]) => void;
  previewAlt?: string;
}

export const RoomImagePicker: React.FC<RoomImagePickerProps> = ({ images, onChange, previewAlt }) => {
  const { t } = useTranslation();
  const [imageUrl, setImageUrl]   = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) onChange([URL.createObjectURL(file)]);
  };

  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-3">{t('rooms.uploadImage')}</label>
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
        className={cn('aspect-video bg-stone-100 rounded-2xl overflow-hidden border border-dashed border-stone-300 hover:border-primary/40 cursor-pointer transition-all flex flex-col items-center justify-center relative group',
          isDragging && 'border-primary bg-teal-50', images[0] && 'border-solid border-stone-200')}
      >
        <input type="file" ref={fileRef} accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {images[0] ? (
          <>
            <img src={images[0]} alt={previewAlt ?? 'preview'} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all gap-2">
              <Upload className="w-5 h-5 text-white" />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">{t('rooms.uploadImage')}</span>
            </div>
            <button type="button" onClick={e => { e.stopPropagation(); onChange([]); }}
              className="absolute top-3 right-3 bg-black/60 p-1.5 rounded-lg text-red-400 z-10">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <div className="text-center p-4">
            <Upload className="w-8 h-8 opacity-30 mx-auto mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{t('rooms.dragDropImage')}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3">
        {PRESET_PHOTOS.map((p, i) => (
          <button key={i} type="button" onClick={() => onChange([p.url])}
            className={cn('h-14 rounded-xl overflow-hidden relative border transition-all',
              images[0] === p.url ? 'border-primary ring-1 ring-primary' : 'border-stone-200 hover:border-stone-400')}>
            <img src={p.url} alt={p.label} className="w-full h-full object-cover opacity-70" />
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <div className="flex items-center gap-2 text-[9px] font-bold text-on-surface-variant/40 uppercase shrink-0">
          <LinkIcon className="w-3 h-3" /> URL
        </div>
        <input type="text" placeholder="https://..." value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          className="flex-1 h-9 px-3 bg-stone-50 border border-stone-200 rounded-lg text-xs outline-none focus:border-primary transition-all" />
        <button type="button"
          onClick={() => { if (imageUrl.startsWith('http')) { onChange([imageUrl]); setImageUrl(''); } }}
          className="px-3 h-9 bg-stone-100 text-on-surface-variant rounded-lg text-[9px] font-bold uppercase hover:bg-stone-200 transition-all">
          {t('common.apply')}
        </button>
      </div>
    </div>
  );
};
