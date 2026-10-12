/**
 * Kamera ile barkod okuma. Tarayıcının yerel BarcodeDetector API'si varsa onu,
 * yoksa ZXing kütüphanesini kullanır. Kamera yalnızca HTTPS (veya localhost) üzerinde ve
 * kullanıcı izin verirse çalışır.
 */
export type ScanStop = () => void;

export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && (typeof window === 'undefined' || window.isSecureContext);
}

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

export async function startScan(video: HTMLVideoElement, onCode: (code: string) => void, onError: (msg: string) => void): Promise<ScanStop> {
  if (!cameraSupported()) {
    onError('Bu tarayıcıda kamera kullanılamıyor (HTTPS bağlantısı ve kamera izni gerekir). Barkod numarasını elle girebilirsin.');
    return () => {};
  }
  const W = window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => DetectorLike };
  if (W.BarcodeDetector) {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (e) {
      onError(permissionMessage(e));
      return () => {};
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    const detector = new W.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) {
          onCode(codes[0].rawValue);
          return;
        }
      } catch {
        /* kare henüz hazır değil */
      }
      setTimeout(tick, 250);
    };
    tick();
    return () => {
      stopped = true;
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }
  // Yedek: ZXing (yalnızca gerektiğinde yüklenir)
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
      if (result) onCode(result.getText());
    });
    return () => controls.stop();
  } catch (e) {
    onError(permissionMessage(e));
    return () => {};
  }
}

function permissionMessage(e: unknown): string {
  const name = (e as Error)?.name;
  if (name === 'NotAllowedError') return 'Kamera izni verilmedi. Tarayıcı ayarlarından izin verebilir ya da barkodu elle girebilirsin.';
  if (name === 'NotFoundError') return 'Kamera bulunamadı. Barkod numarasını elle girebilirsin.';
  return 'Kamera başlatılamadı. Barkod numarasını elle girebilirsin.';
}
