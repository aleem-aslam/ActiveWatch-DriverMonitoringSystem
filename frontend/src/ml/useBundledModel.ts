// src/ml/useBundledModel.ts
// Drop-in replacement for useTensorflowModel(require('x.tflite'), []).
//
// Why: react-native-fast-tflite only reads http:// or file:// URLs. With Metro (debug) the
// require() resolves to an http URL, so it works. In a release APK it resolves to a bare
// Android resource name ("src_assets_models_x"), which fast-tflite cannot open, so the model
// never loads. Here that resource is first copied to the app's files folder and loaded from
// there as a file:// URL.
import { useEffect, useState } from 'react';
import { Image, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';

export type BundledModel =
  | { state: 'loading'; model: undefined; error?: undefined }
  | { state: 'loaded'; model: TfliteModel; error?: undefined }
  | { state: 'error'; model: undefined; error: Error };

async function resolveUrl(asset: number): Promise<string> {
  const uri = Image.resolveAssetSource(asset)?.uri ?? '';
  if (/^(https?|file):\/\//.test(uri)) return uri; // debug build via Metro
  if (Platform.OS !== 'android') return uri;
  // release: uri is the res/raw resource name; copy it out of the APK
  const dest = `${RNFS.DocumentDirectoryPath}/${uri}.tflite`;
  if (await RNFS.exists(dest)) {
    const st = await RNFS.stat(dest);
    if (Number(st.size) > 0) return 'file://' + dest;
  }
  await RNFS.copyFileRes(`${uri}.tflite`, dest);
  return 'file://' + dest;
}

export function useBundledModel(asset: number): BundledModel {
  const [state, setState] = useState<BundledModel>({ state: 'loading', model: undefined });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await resolveUrl(asset);
        const model = await loadTensorflowModel({ url }, []);
        if (!cancelled) setState({ state: 'loaded', model });
      } catch (e: any) {
        console.error('[model] failed to load', e);
        if (!cancelled) setState({ state: 'error', model: undefined, error: e instanceof Error ? e : new Error(String(e)) });
      }
    })();
    return () => { cancelled = true; };
  }, [asset]);

  return state;
}