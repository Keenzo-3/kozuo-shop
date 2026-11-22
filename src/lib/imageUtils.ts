export interface PresetThumbnail {
  id: string;
  label: string;
  categoryHint: string;
  url: string;
}

export const CODM_FILES_PHOTO = '/assets/aistudio/images__6__a8f12f9b.jpeg';
export const MLBB_FILES_PHOTO = '/assets/aistudio/images__7__8eda4eb3.jpeg';
export const GCASH_LOGO_PHOTO =
  '/assets/aistudio/gcash-logo-square-rounded-gcash-logo-free-download-gcash-logo-free-png_c2b56b92.png';

export const PRESET_THUMBNAILS: PresetThumbnail[] = [
  {
    id: 'codm-banner',
    label: 'CODM Official Cover',
    categoryHint: 'CODM Files',
    url: CODM_FILES_PHOTO,
  },
  {
    id: 'mlbb-icon',
    label: 'MLBB Official Emblem',
    categoryHint: 'MLBB Upass',
    url: MLBB_FILES_PHOTO,
  },
  {
    id: 'codm-mythic',
    label: 'CODM Mythic Armory',
    categoryHint: 'CODM Clean',
    url: '/src/assets/images/codm_clean_mythic_1795329141451.jpg',
  },
  {
    id: 'codm-sniper',
    label: 'CODM Sniper Bench',
    categoryHint: 'CODM Not Clean',
    url: '/src/assets/images/codm_notclean_sniper_1795329141812.jpg',
  },
];

/**
 * Compresses an uploaded image file to a compact JPEG data URL
 * so up to 7 detail photos fit safely within Firestore's 1MB document limit.
 */
export async function compressImageToDataUrl(
  file: File,
  maxWidth = 640,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Unable to initialize canvas for image compression.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let currentQuality = quality;
        let dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        while (dataUrl.length > 105000 && currentQuality > 0.3) {
          currentQuality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        }
        if (dataUrl.length > 150000) {
          reject(
            new Error(
              'Image is too large even after compression. Please use a smaller screenshot or paste an image URL.'
            )
          );
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
