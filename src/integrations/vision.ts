/**
 * Fotoğraftan yemek tanıma — Claude API (Anthropic) ile gerçek entegrasyon.
 * Kullanıcının kendi API anahtarı gerekir (Profil › Entegrasyonlar). Anahtar yalnızca bu cihazda
 * (IndexedDB) saklanır ve istek doğrudan tarayıcıdan api.anthropic.com'a gider.
 * Anahtar yoksa analiz yapılmaz; fotoğraf manuel kayda eklenebilir.
 *
 * Fotoğraftan kalori tahmini kesin değildir: gizli yağ, sos, porsiyon derinliği görüntüden
 * anlaşılamaz. Sonuçlar kullanıcı onayı olmadan günlüğe eklenmez.
 */
import Anthropic from '@anthropic-ai/sdk';

import { VISION_MODEL } from './visionConfig';
export { VISION_MODEL };

export interface VisionItem {
  name: string;
  /** Veritabanında aramak için kısa Türkçe ad */
  searchName: string;
  grams: number;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface VisionResult {
  items: VisionItem[];
  notes: string;
}

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Görülen yiyeceğin Türkçe adı' },
          searchName: { type: 'string', description: 'Türk yemek veritabanında aranacak yalın ad, ör. "mercimek çorbası"' },
          grams: { type: 'number', description: 'Tahmini porsiyon ağırlığı (g)' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carb: { type: 'number' },
          fat: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['name', 'searchName', 'grams', 'kcal', 'protein', 'carb', 'fat', 'confidence'],
        additionalProperties: false,
      },
    },
    notes: { type: 'string', description: 'Kısa Türkçe not: belirsizlikler, görünmeyen yağ/sos uyarısı' },
  },
  required: ['items', 'notes'],
  additionalProperties: false,
} as const;

const PROMPT = `Bu fotoğraftaki yiyecek ve içecekleri ayrı ayrı belirle. Türk mutfağını iyi bilen bir diyetisyen gibi düşün.
Her biri için Türkçe ad, veritabanında aranacak yalın bir ad, görüntüdeki porsiyonun tahmini gramajı ve bu gramaj için tahmini kalori ile makroları ver.
Tabak/kase boyutu gibi ipuçlarından porsiyonu tahmin et. Emin olmadığın öğelerde güveni "low" yap.
Görselde yiyecek yoksa boş liste döndür. Notlarda görünmeyen yağ, sos veya şeker gibi belirsizlikleri kısaca belirt.`;

/** Görseli en fazla 1568 px kenara küçültür, JPEG olarak base64 döndürür */
export async function prepareImage(file: Blob): Promise<{ data: string; mediaType: 'image/jpeg' }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { data: dataUrl.split(',')[1], mediaType: 'image/jpeg' };
}

export type VisionOutcome = { ok: true; result: VisionResult } | { ok: false; message: string };

export async function analyzeFoodPhoto(apiKey: string, file: Blob, signal?: AbortSignal): Promise<VisionOutcome> {
  if (!apiKey) return { ok: false, message: 'Görsel analiz servisi yapılandırılmadı.' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, message: 'İnternet bağlantısı yok. Fotoğrafı manuel kayda ekleyebilirsin.' };
  const img = await prepareImage(file);
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  try {
    const response = await client.beta.messages.create(
      {
        model: VISION_MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      },
      { signal },
    );
    if (response.stop_reason === 'refusal') return { ok: false, message: 'Bu görsel analiz edilemedi. Yemeği manuel olarak ekleyebilirsin.' };
    if (response.stop_reason === 'max_tokens') return { ok: false, message: 'Yanıt yarıda kesildi; daha az öğe içeren bir fotoğrafla tekrar dene.' };
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return { ok: false, message: 'Servis boş yanıt döndürdü.' };
    const parsed = JSON.parse(text.text) as VisionResult;
    return { ok: true, result: { items: Array.isArray(parsed.items) ? parsed.items : [], notes: String(parsed.notes ?? '') } };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, message: 'API anahtarı geçersiz. Profil › Entegrasyonlar bölümünden kontrol et.' };
    if (error instanceof Anthropic.PermissionDeniedError) return { ok: false, message: 'Bu API anahtarının bu modele erişim izni yok.' };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, message: 'İstek sınırına ulaşıldı. Biraz sonra tekrar dene.' };
    if (error instanceof Anthropic.BadRequestError) return { ok: false, message: `İstek reddedildi: ${error.message}` };
    if (error instanceof Anthropic.APIConnectionError) return { ok: false, message: 'Servise bağlanılamadı. İnternet bağlantını kontrol et.' };
    if (error instanceof Anthropic.APIError) return { ok: false, message: `Servis hatası (${error.status ?? '?'}). Daha sonra tekrar dene.` };
    if ((error as Error).name === 'AbortError') return { ok: false, message: 'İptal edildi.' };
    return { ok: false, message: 'Yanıt işlenemedi.' };
  }
}
