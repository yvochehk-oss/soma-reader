const SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G";

const COVERS = [
  { slug: 'savannahs-secret', cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5KU0hgC_gXe0ESmgb0p_tIqKNAktoA9rICpHgOUoWq8q87VpXba10iF0gNweyB-NTlyVRydrDZqB5ounoEdwy4-DqN9clHm6eVfd0NXcWpoZEiB2B-OFKfA-6LmnMrOtlST7gWT-YSLJzxJFwGx7SbReje7hThQeekz5HskJFTOyL-_zkyGBnrkqKgYjt0wpGa9j8JT51IDBc7j6zSK0uuWgzKnTzdEfLOHUduboiRkwcP8WvTtfs1jN1n4lWxDqiHOvUwTq2TTQ' },
  { slug: 'neon-savannah', cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAf0_k4UIITTLiyvZcwrKyKHl553duj7H7QIlfEaqfz1jP4UHbt8KVN1nonFJi2-X7rOh_CPUxKil6jBNphKPpmwlc2OX2af_qmTgPX0WKotRFVoQbQjGmp_Sxrt7zWaOxT9O7KGD5cSs56M1CiBlzeOImeHY2rle0qnUbNX9cau4Qs9G-Dk4sC31filn8csqtSD41TRffCHKaFZIuZcHBO2QyKoERa3ynpieOVchCZN87KPd8O88Gbq6C3LiDXLnpQoLrrwCaHi78' },
  { slug: 'tides-of-zanzibar', cover_url: '/covers/tides_of_zanzibar.jpg' },
  { slug: 'spirits-in-the-court', cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDjox9T1ibt3KMx1-vWhhTQ-sa9JcsMp14dmoxg5Q8J8kxA8_fFmHe3k0y7GWCPq-ECWMFfLz5ALu-9It0T3O_SIOZ0u_2PH0fEXzqB3V4ZzThlNNhdPqtXN876IP4x6MvhnPZgin1UtoqxdTMBr-hEv4MXxwUk_almi1xihT9DPUAttzcUDegGIZJnDaohNY1sgGLFZcBXkmqKKxouwDjERiRsZ8MELhtIKDGpAoBYp7lrCxFUY9UDaovVlst9V49lGZfQMb0IHOA' },
  { slug: 'city-of-embers', cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuArpKl5Gu90J8D4LiiW9OHkhHF7rFKyoKrocaGIlXms93fJycvoXz7VqFV0KTu2fsQBKTSB1rck-nD9otRi9wFiFvdSwkQ77xh_XeXJahey974LrD3dngolS_6fmkitabqG1yMl1CB93iZACuUGrNDAGYZ2cu97DoTQUKfwBtuXKBf3G3hY8rB3l4bp_QrYQDRqXN8zzyuKWqZRjuogDKIMANC2W6wnVtYXfe4bfGjWh9GqsLCQdJZh0HK1MAN6G-5SJmc-vL81W0I' },
  { slug: 'coffee-and-confessions', cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5MU15cZnYdlkJr2c94oPOtGIhlOmu3hu1Qd7TaLiriZUEkPsmptvr_TkFL5AVe2ZwlA92fFmgZriDdxfyOC1LHTHQEduwrUGay5jaP109zDXNcXaXnrsY1fwAfZophy_Pk23En71013q5BANmCedZCzni4332hZogZQBgQPr6LBHaNc4quHH_NHfkA0dKOTK61MrNq3T7hWYiU9EZWo7jHEU3LPHL-8TSOT_FCdaL2hHZcQ875r4ntTHKqsVKQWZHBqhnnK9DApE' },
  { slug: 'watcher-in-westlands', cover_url: '/covers/watcher_in_westlands.jpg' },
  { slug: 'wings-of-the-rift', cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbDrdAch_pOy9VnEOZe_L0NiqS1BIHQ3rj1kO6mfzxVAvTLm7Ux24kCxK28Bn643N2ei9zbWmkoYNpMUG3uSsEGaJP4Wyq29_Zv1mVye8NmleiwdC0NLQidXlHtytQLG_6zmKNw5VMHQiNyd5Nq31CyB398U7-MdO0HYvYDzI9Cb7XSlrE_tI2obGHvfba6PY5RDr3mty9L0C7cHvcZXStC5jTKqJelVtabj_sBJLoXBnqEDA77HxDvP5sjK9Wz_U5U8YuyoU6mnY' },
  { slug: 'voice-of-the-voiceless', cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAhGWqSM0z5gfoN-PLS7aF72Lhh5IkwN7F_GLtqAYoAH8XDEoOLYl4Brp21BjdhKNU_INFipJhV6Jd3_VCEImG5WUr-2kzksoKOslyN7C7DsbY98M1HUxguzMgnvl2jJ2nQurMzaeBQHjXIT3nVSjUTyDFtx-uUg3ioF3GHklRKt4A-GHHHUE5XoNGlIyN8sVS5C2KPiX8JVkvvsEDfz-RBWMue-GT1C893OvZAkuWUL57jG7dZS06GgGM6i-LAQxVQnS7Y5Lv3OZo' },
];

async function run() {
  console.log("🚀 Restoring original AI Studio covers in Supabase...");
  for (const item of COVERS) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/books?slug=eq.${item.slug}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ cover_url: item.cover_url }),
    });
    if (res.ok) {
      console.log(`  ✓ Restored cover for ${item.slug}`);
    } else {
      console.log(`  ! Status for ${item.slug}:`, res.status);
    }
  }
  console.log("🎉 Original AI Studio covers fully restored in Supabase!");
}

run().catch(console.error);
