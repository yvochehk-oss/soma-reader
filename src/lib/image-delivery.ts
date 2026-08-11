const SUPABASE_OBJECT_PATH = '/storage/v1/object/public/';

export function optimizedCoverUrl(source: string, width: number) {
  try {
    const url = new URL(source);
    if (!url.hostname.endsWith('.supabase.co') || !url.pathname.includes(SUPABASE_OBJECT_PATH)) return source;

    const version = url.searchParams.get('v');
    url.pathname = url.pathname.replace(SUPABASE_OBJECT_PATH, '/storage/v1/render/image/public/');
    url.search = '';
    if (version) url.searchParams.set('v', version);
    url.searchParams.set('width', String(width));
    url.searchParams.set('quality', '76');
    return url.toString();
  } catch {
    return source;
  }
}

export function responsiveCoverSourceSet(source: string) {
  const widths = [240, 360, 480];
  return widths.map((width) => `${optimizedCoverUrl(source, width)} ${width}w`).join(', ');
}
