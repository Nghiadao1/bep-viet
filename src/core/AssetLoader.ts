// ============================================================
// AssetLoader — Load images and audio files with progress
// ============================================================

export type ProgressCallback = (loaded: number, total: number) => void;

export interface AssetManifest {
  images: Record<string, string>;  // key → url
  audio: Record<string, string>;   // key → url
}

export class AssetLoader {
  private images = new Map<string, HTMLImageElement>();
  private audioBuffers = new Map<string, AudioBuffer>();
  private audioContext: AudioContext | null = null;

  /** Get a loaded image by key */
  getImage(key: string): HTMLImageElement {
    const img = this.images.get(key);
    if (!img) throw new Error(`Image not found: ${key}`);
    return img;
  }

  /** Get a loaded audio buffer by key */
  getAudio(key: string): AudioBuffer | undefined {
    return this.audioBuffers.get(key);
  }

  /** Check if an image exists */
  hasImage(key: string): boolean {
    return this.images.has(key);
  }

  /** Load a single image */
  async loadImage(key: string, url: string): Promise<HTMLImageElement> {
    if (this.images.has(key)) return this.images.get(key)!;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(key, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  /** Load a single audio file */
  async loadAudio(key: string, url: string): Promise<void> {
    if (this.audioBuffers.has(key)) return;
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.audioBuffers.set(key, audioBuffer);
    } catch {
      console.warn(`Failed to load audio: ${url}`);
    }
  }

  /** Load all assets from a manifest with progress tracking */
  async loadAll(manifest: AssetManifest, onProgress?: ProgressCallback): Promise<void> {
    const imageEntries = Object.entries(manifest.images);
    const audioEntries = Object.entries(manifest.audio);
    const total = imageEntries.length + audioEntries.length;
    let loaded = 0;

    const tasks: Promise<void>[] = [];

    for (const [key, url] of imageEntries) {
      tasks.push(
        this.loadImage(key, url).then(() => {
          loaded++;
          onProgress?.(loaded, total);
        })
      );
    }

    for (const [key, url] of audioEntries) {
      tasks.push(
        this.loadAudio(key, url).then(() => {
          loaded++;
          onProgress?.(loaded, total);
        })
      );
    }

    await Promise.all(tasks);
  }

  /** Create a simple colored rectangle as placeholder sprite */
  createPlaceholder(key: string, width: number, height: number, color: string): HTMLImageElement {
    if (this.images.has(key)) return this.images.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Fill with color
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    // Add border
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Add label
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.min(width, height) / 4}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = key.length > 8 ? key.slice(0, 8) : key;
    ctx.fillText(label, width / 2, height / 2);

    const img = new Image();
    img.src = canvas.toDataURL();
    this.images.set(key, img);
    return img;
  }
}
